import { inputBus } from './inputBus'
import { midiBytes, parseMidiMessage } from './parse'

/**
 * Servicio de conexión Web MIDI.
 *
 * - Solicita permiso (desde Chrome 124 cualquier acceso MIDI muestra un aviso de permiso).
 * - No pide SysEx: no es necesario para leer notas y evita un permiso más fuerte.
 * - Detecta el Casio por nombre ("CASIO USB-MIDI" según el manual del CT-S300).
 * - Escucha `statechange` para detectar desconexiones y reconectar automáticamente.
 * - Requiere contexto seguro: http://localhost en desarrollo, HTTPS en despliegue.
 */

export type MidiStatus = 'unsupported' | 'insecure' | 'idle' | 'requesting' | 'denied' | 'ready' | 'error'

export interface MidiPortInfo {
  id: string
  name: string
  manufacturer: string
  state: MIDIPortDeviceState
  isCasio: boolean
}

export interface MidiState {
  status: MidiStatus
  error?: string
  inputs: MidiPortInfo[]
  outputs: MidiPortInfo[]
  selectedInputId: string | null
  selectedOutputId: string | null
  /** true si la entrada seleccionada está conectada */
  inputConnected: boolean
  outputConnected: boolean
  lastActivity: number
}

type StateListener = (s: MidiState) => void

const CASIO_RE = /casio|ct-s300|ct-s/i

function portInfo(p: MIDIPort): MidiPortInfo {
  const name = p.name ?? 'Dispositivo sin nombre'
  const manufacturer = p.manufacturer ?? ''
  return { id: p.id, name, manufacturer, state: p.state, isCasio: CASIO_RE.test(name) || CASIO_RE.test(manufacturer) }
}

class MidiService {
  private access: MIDIAccess | null = null
  private boundInput: MIDIInput | null = null
  private listeners = new Set<StateListener>()
  /** Desplazamiento para compensar "MIDI Out Octave Shift" del teclado (semitonos). */
  inputTranspose = 0
  /** Canal por el que se envían notas al teclado (1–16). */
  outputChannel = 1
  private preferredInputName: string | null = null
  private preferredOutputName: string | null = null

  state: MidiState = {
    status: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator ? 'idle' : 'unsupported',
    inputs: [],
    outputs: [],
    selectedInputId: null,
    selectedOutputId: null,
    inputConnected: false,
    outputConnected: false,
    lastActivity: 0,
  }

  constructor() {
    if (typeof window !== 'undefined' && !window.isSecureContext && this.state.status !== 'unsupported') {
      this.state.status = 'insecure'
    }
  }

  subscribe(fn: StateListener): () => void {
    this.listeners.add(fn)
    fn(this.state)
    return () => this.listeners.delete(fn)
  }

  private setState(patch: Partial<MidiState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  get isSupported() {
    return this.state.status !== 'unsupported'
  }

  setPreferred(inputName: string | null, outputName: string | null) {
    this.preferredInputName = inputName
    this.preferredOutputName = outputName
  }

  /** Solicita acceso MIDI. Debe llamarse preferiblemente tras un gesto del usuario. */
  async connect(): Promise<void> {
    if (this.state.status === 'unsupported' || this.state.status === 'insecure') return
    if (this.access) {
      this.refreshPorts()
      return
    }
    this.setState({ status: 'requesting', error: undefined })
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
      this.access.onstatechange = () => this.refreshPorts()
      this.setState({ status: 'ready' })
      this.refreshPorts()
    } catch (err) {
      const e = err as DOMException
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        this.setState({ status: 'denied', error: 'El navegador denegó el permiso MIDI.' })
      } else {
        this.setState({ status: 'error', error: e?.message ?? String(err) })
      }
    }
  }

  /** Comprueba (sin pedir) si el permiso ya fue concedido, para reconectar al arrancar. */
  async autoConnectIfGranted(): Promise<void> {
    try {
      const perm = await navigator.permissions?.query({ name: 'midi' as PermissionName })
      if (perm?.state === 'granted') await this.connect()
    } catch {
      /* algunos navegadores no soportan consultar 'midi' */
    }
  }

  private refreshPorts() {
    if (!this.access) return
    const inputs = [...this.access.inputs.values()].map(portInfo)
    const outputs = [...this.access.outputs.values()].map(portInfo)

    let selIn = this.state.selectedInputId
    // La entrada elegida desapareció o no hay: buscamos preferida → Casio → primera
    const inputStillThere = inputs.find((i) => i.id === selIn && i.state === 'connected')
    if (!inputStillThere) {
      const pick =
        inputs.find((i) => i.state === 'connected' && this.preferredInputName && i.name === this.preferredInputName) ??
        inputs.find((i) => i.state === 'connected' && i.isCasio) ??
        inputs.find((i) => i.state === 'connected')
      selIn = pick?.id ?? (inputs.find((i) => i.id === selIn) ? selIn : null)
    }
    let selOut = this.state.selectedOutputId
    if (!outputs.find((o) => o.id === selOut && o.state === 'connected')) {
      const pick =
        outputs.find((o) => o.state === 'connected' && this.preferredOutputName && o.name === this.preferredOutputName) ??
        outputs.find((o) => o.state === 'connected' && o.isCasio)
      selOut = pick?.id ?? (outputs.find((o) => o.id === selOut) ? selOut : null)
    }
    this.setState({
      inputs,
      outputs,
      selectedInputId: selIn,
      selectedOutputId: selOut,
      inputConnected: !!inputs.find((i) => i.id === selIn && i.state === 'connected'),
      outputConnected: !!outputs.find((o) => o.id === selOut && o.state === 'connected'),
    })
    this.bindInput(selIn)
  }

  selectInput(id: string | null) {
    this.setState({ selectedInputId: id })
    this.preferredInputName = this.state.inputs.find((i) => i.id === id)?.name ?? null
    this.refreshPorts()
  }

  selectOutput(id: string | null) {
    this.preferredOutputName = this.state.outputs.find((o) => o.id === id)?.name ?? null
    this.setState({ selectedOutputId: id, outputConnected: !!this.state.outputs.find((o) => o.id === id && o.state === 'connected') })
  }

  private bindInput(id: string | null) {
    const input = id && this.access ? this.access.inputs.get(id) ?? null : null
    const live = input && input.state === 'connected' ? input : null
    if (this.boundInput === live) return
    if (this.boundInput) {
      this.boundInput.onmidimessage = null
      inputBus.releaseAll('midi') // evita notas "colgadas" al desconectar
    }
    this.boundInput = live
    if (live) {
      const device = live.name ?? undefined
      live.onmidimessage = (msg: MIDIMessageEvent) => {
        if (!msg.data) return
        // msg.timeStamp usa el mismo reloj que performance.now(): marca de tiempo real de llegada.
        const ev = parseMidiMessage(msg.data, msg.timeStamp || performance.now(), 'midi', device, this.inputTranspose)
        if (ev) {
          this.state.lastActivity = ev.time
          inputBus.emit(ev)
        }
      }
    }
  }

  private get output(): MIDIOutput | null {
    const id = this.state.selectedOutputId
    if (!id || !this.access) return null
    const o = this.access.outputs.get(id)
    return o && o.state === 'connected' ? o : null
  }

  get canSend() {
    return !!this.output
  }

  /** Envía una nota al teclado. `atPerfMs` = instante en el reloj performance.now() (opcional). */
  sendNoteOn(note: number, velocity: number, atPerfMs?: number) {
    this.output?.send(midiBytes.noteOn(note, velocity, this.outputChannel), atPerfMs)
  }

  sendNoteOff(note: number, atPerfMs?: number) {
    this.output?.send(midiBytes.noteOff(note, this.outputChannel), atPerfMs)
  }

  sendProgram(program: number) {
    this.output?.send(midiBytes.programChange(program, this.outputChannel))
  }

  panic() {
    const out = this.output
    if (!out) return
    try {
      (out as MIDIOutput & { clear?: () => void }).clear?.()
    } catch {
      /* clear() no está en todos los navegadores */
    }
    out.send(midiBytes.allNotesOff(this.outputChannel))
    out.send(midiBytes.allSoundOff(this.outputChannel))
  }
}

export const midiService = new MidiService()
