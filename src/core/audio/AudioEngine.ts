import * as Tone from 'tone'
import { midiService } from '../midi/MidiService'

/**
 * Motor de audio de la aplicación.
 *
 * Distinción importante:
 *  - "app"   → sonido generado aquí (Tone.js + muestras Salamander Grand Piano, CC-BY 3.0).
 *  - "casio" → se envían mensajes MIDI al CT-S300 y él lo reproduce con sus propios sonidos.
 *  - El sonido físico del Casio NO viaja por USB (el CT-S300 solo transmite MIDI por USB).
 *
 * El destino es configurable para evitar duplicar el mismo ejercicio por dos salidas (eco).
 */

export type Timbre = 'piano' | 'epiano' | 'organ' | 'strings'
export type OutputDestination = 'app' | 'casio' | 'both' | 'none'

export const TIMBRES: { id: Timbre; name: string; kind: 'muestras' | 'síntesis'; gmProgram: number }[] = [
  { id: 'piano', name: 'Piano de cola (Salamander)', kind: 'muestras', gmProgram: 0 },
  { id: 'epiano', name: 'Piano eléctrico', kind: 'síntesis', gmProgram: 4 },
  { id: 'organ', name: 'Órgano', kind: 'síntesis', gmProgram: 16 },
  { id: 'strings', name: 'Cuerdas suaves', kind: 'síntesis', gmProgram: 48 },
]

const SAMPLE_NOTES = ['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7', 'D#7', 'F#7', 'A7', 'C8']

type Voice = { triggerAttack: (n: string | number, t?: number, v?: number) => unknown; triggerRelease: (n: string | number, t?: number) => unknown; releaseAll?: (t?: number) => unknown }

class AudioEngine {
  private started = false
  private loadingPromise: Promise<void> | null = null
  private instruments = new Map<Timbre, Voice>()
  private master!: Tone.Volume
  private metroVol!: Tone.Volume
  private clickHi!: Tone.Synth
  private clickLo!: Tone.Synth
  timbre: Timbre = 'piano'
  destination: OutputDestination = 'app'
  pianoLoaded = false
  private loadListeners = new Set<() => void>()
  /** notas que suenan ahora mismo por la app (para teclas "sonando" en demos) */
  private sounding = new Map<number, number>()

  /** Debe llamarse tras un gesto del usuario (política de autoplay del navegador). */
  async start(): Promise<void> {
    if (!this.started) {
      await Tone.start()
      this.started = true
      this.master = new Tone.Volume(-6).toDestination()
      this.metroVol = new Tone.Volume(-8).toDestination()
      this.clickHi = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } }).connect(this.metroVol)
      this.clickLo = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 } }).connect(this.metroVol)
      Tone.getContext().lookAhead = 0.02
    }
    await this.ensureInstrument(this.timbre)
  }

  get isStarted() {
    return this.started
  }

  onLoaded(fn: () => void) {
    this.loadListeners.add(fn)
    return () => this.loadListeners.delete(fn)
  }

  private ensureInstrument(t: Timbre): Promise<void> {
    if (this.instruments.has(t)) return Promise.resolve()
    if (t === 'piano') {
      if (this.loadingPromise) return this.loadingPromise
      this.loadingPromise = new Promise<void>((resolve) => {
        const urls: Record<string, string> = {}
        for (const n of SAMPLE_NOTES) urls[n] = `${n.replace('#', 's')}.mp3`
        const sampler = new Tone.Sampler({
          urls,
          baseUrl: `${import.meta.env.BASE_URL}samples/salamander/`,
          release: 1.2,
          onload: () => {
            this.pianoLoaded = true
            this.loadListeners.forEach((l) => l())
            resolve()
          },
          onerror: (e) => {
            console.error('[Audio] error cargando muestras', e)
            resolve()
          },
        }).connect(this.master)
        this.instruments.set('piano', sampler)
      })
      return this.loadingPromise
    }
    let synth: Voice
    if (t === 'epiano') {
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 10,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1.6, sustain: 0.15, release: 0.9 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.1, release: 0.5 },
        volume: -10,
      }).connect(this.master)
    } else if (t === 'organ') {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'custom', partials: [1, 0.6, 0.35, 0, 0.25, 0, 0, 0.15] },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.08 },
        volume: -14,
      }).connect(this.master)
    } else {
      const filter = new Tone.Filter(2200, 'lowpass').connect(this.master)
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
        envelope: { attack: 0.25, decay: 0.3, sustain: 0.8, release: 1.2 },
        volume: -20,
      }).connect(filter)
    }
    this.instruments.set(t, synth)
    return Promise.resolve()
  }

  async setTimbre(t: Timbre) {
    this.timbre = t
    if (this.started) await this.ensureInstrument(t)
    const gm = TIMBRES.find((x) => x.id === t)?.gmProgram ?? 0
    if (this.destination === 'casio' || this.destination === 'both') midiService.sendProgram(gm)
  }

  setVolume(db: number) {
    if (this.master) this.master.volume.value = db
  }

  setMetronomeVolume(db: number) {
    if (this.metroVol) this.metroVol.volume.value = db
  }

  /** Tiempo de audio actual (s). */
  now(): number {
    return Tone.now()
  }

  /** Convierte un instante de performance.now() (ms) a tiempo del AudioContext (s). */
  perfToAudio(perfMs: number): number {
    const ctx = Tone.getContext().rawContext as AudioContext
    const ts = ctx.getOutputTimestamp?.()
    if (ts && ts.performanceTime && ts.contextTime !== undefined) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000
    }
    return ctx.currentTime + (perfMs - performance.now()) / 1000
  }

  /** Latencia de salida estimada por el navegador (s). */
  outputLatency(): number {
    const ctx = Tone.getContext().rawContext as AudioContext
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
  }

  private get voice(): Voice | undefined {
    const t: Timbre = this.instruments.has(this.timbre) ? this.timbre : 'piano'
    // El sampler lanza un error si se dispara antes de terminar de cargar las muestras.
    if (t === 'piano' && !this.pianoLoaded) return undefined
    return this.instruments.get(t)
  }

  private toApp(dest = this.destination) {
    return dest === 'app' || dest === 'both'
  }

  private toCasio(dest = this.destination) {
    return dest === 'casio' || dest === 'both'
  }

  /** Inicio de nota inmediato (teclado virtual con ratón). */
  noteOn(midi: number, velocity = 90, dest = this.destination) {
    if (this.toApp(dest) && this.started) {
      this.voice?.triggerAttack(Tone.Frequency(midi, 'midi').toFrequency(), undefined, velocity / 127)
      this.sounding.set(midi, (this.sounding.get(midi) ?? 0) + 1)
    }
    if (this.toCasio(dest)) midiService.sendNoteOn(midi, velocity)
  }

  noteOff(midi: number, dest = this.destination) {
    if (this.toApp(dest) && this.started) {
      this.voice?.triggerRelease(Tone.Frequency(midi, 'midi').toFrequency())
      this.sounding.delete(midi)
    }
    if (this.toCasio(dest)) midiService.sendNoteOff(midi)
  }

  /**
   * Programa una nota en un instante del reloj performance.now() (ms).
   * Se usa para reproducción sincronizada (canciones, demos, ejercicios).
   */
  scheduleNote(midi: number, startPerfMs: number, durationMs: number, velocity = 90, dest = this.destination) {
    const dur = Math.max(0.03, durationMs / 1000)
    if (this.toApp(dest) && this.started) {
      const freq = Tone.Frequency(midi, 'midi').toFrequency()
      const t = Math.max(this.now(), this.perfToAudio(startPerfMs))
      const v = this.voice
      if (v) {
        v.triggerAttack(freq, t, velocity / 127)
        v.triggerRelease(freq, t + dur)
      }
    }
    if (this.toCasio(dest)) {
      const at = Math.max(performance.now(), startPerfMs)
      midiService.sendNoteOn(midi, velocity, at)
      midiService.sendNoteOff(midi, at + dur * 1000)
    }
  }

  /** Clic de metrónomo programado en el reloj performance.now(). */
  scheduleClick(atPerfMs: number, accent: boolean) {
    if (!this.started) return
    const t = Math.max(this.now(), this.perfToAudio(atPerfMs))
    ;(accent ? this.clickHi : this.clickLo).triggerAttackRelease(accent ? 1760 : 1175, 0.03, t, accent ? 1 : 0.6)
  }

  /** Reproduce un acorde/nota/arpegio de demostración. */
  async demo(notes: number[], opts: { arpeggio?: boolean; gapMs?: number; durationMs?: number; velocity?: number } = {}) {
    await this.start()
    const { arpeggio = false, gapMs = 280, durationMs = 900, velocity = 85 } = opts
    const t0 = performance.now() + 60
    notes.forEach((n, i) => this.scheduleNote(n, t0 + (arpeggio ? i * gapMs : 0), arpeggio ? Math.max(durationMs, gapMs) : durationMs, velocity))
    return t0
  }

  stopAll() {
    for (const v of this.instruments.values()) v.releaseAll?.(this.started ? this.now() : undefined)
    this.sounding.clear()
    if (this.toCasio()) midiService.panic()
  }
}

export const audioEngine = new AudioEngine()
