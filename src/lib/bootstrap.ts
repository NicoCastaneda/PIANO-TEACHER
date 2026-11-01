import { audioEngine } from '../core/audio/AudioEngine'
import { emitNote, inputBus } from '../core/midi/inputBus'
import { midiService } from '../core/midi/MidiService'
import { useChordTrainer } from '../state/chordTrainer'
import { useEarTrainer } from '../state/earTrainer'
import { useLibrary, useProgress } from '../state/library'
import { useSettings } from '../state/settings'

/**
 * Arranque de servicios globales:
 *  - Aplica la configuración guardada a MIDI y audio.
 *  - Reconecta el MIDI automáticamente si el permiso ya fue concedido.
 *  - "Sonificador": hace sonar en la app las notas del ratón / teclado del ordenador /
 *    simulador. Las notas del Casio NO suenan en la app por defecto (el Casio ya suena
 *    por sí mismo; evita eco), salvo que el usuario active "monitorizar entrada MIDI".
 *  - Teclado del ordenador como entrada alternativa (A W S E D F T G Y H U J K…).
 */

export const COMPUTER_KEYMAP: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
}

let computerOctave = 60
export function getComputerOctave() {
  return computerOctave
}

export async function bootstrap() {
  await useSettings.getState().load()
  await Promise.all([useLibrary.getState().load(), useProgress.getState().load(), useChordTrainer.getState().load(), useEarTrainer.getState().load()]).catch((e) => console.error('[db]', e))
  const apply = () => {
    const s = useSettings.getState()
    document.documentElement.dataset.theme = s.theme
    midiService.inputTranspose = s.inputTranspose
    midiService.outputChannel = s.midiOutputChannel
    midiService.setPreferred(s.preferredInput, s.preferredOutput)
    audioEngine.destination = s.playbackDestination
    audioEngine.setVolume(s.volumeDb)
    audioEngine.setMetronomeVolume(s.metronomeDb)
    if (audioEngine.timbre !== s.timbre) void audioEngine.setTimbre(s.timbre)
  }
  apply()
  useSettings.subscribe(apply)
  void midiService.autoConnectIfGranted()

  // Sonificador
  inputBus.subscribe((e) => {
    if (e.type !== 'noteon' && e.type !== 'noteoff') return
    const s = useSettings.getState()
    if (e.source === 'midi' && !s.monitorMidiInput) return
    // Las notas tocadas por el usuario con ratón/teclado suenan en la app (o en el Casio si así se eligió).
    const dest = e.source === 'midi' ? 'app' : s.playbackDestination === 'none' ? 'app' : s.playbackDestination
    if (e.type === 'noteon') {
      if (!audioEngine.isStarted) void audioEngine.start().then(() => audioEngine.noteOn(e.note, e.velocity, dest))
      else audioEngine.noteOn(e.note, e.velocity, dest)
    } else audioEngine.noteOff(e.note, dest)
  })

  // Teclado del ordenador
  const down = new Map<string, number>()
  const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
  window.addEventListener('keydown', (ev) => {
    if (!useSettings.getState().computerKeyboard || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || isTyping(ev.target)) return
    if (ev.code === 'KeyZ') return void (computerOctave = Math.max(36, computerOctave - 12))
    if (ev.code === 'KeyX') return void (computerOctave = Math.min(84, computerOctave + 12))
    const off = COMPUTER_KEYMAP[ev.code]
    if (off === undefined || down.has(ev.code)) return
    down.set(ev.code, computerOctave + off)
    emitNote('computer-keyboard', 'noteon', computerOctave + off, 90, ev.timeStamp || performance.now())
  })
  window.addEventListener('keyup', (ev) => {
    const note = down.get(ev.code)
    if (note === undefined) return
    down.delete(ev.code)
    emitNote('computer-keyboard', 'noteoff', note, 0, ev.timeStamp || performance.now())
  })
  window.addEventListener('blur', () => {
    down.clear()
    inputBus.releaseAll('computer-keyboard')
  })
}
