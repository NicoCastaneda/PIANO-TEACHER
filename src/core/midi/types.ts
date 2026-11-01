/**
 * Tipos de eventos de entrada musical.
 *
 * `source` identifica SIEMPRE de dónde viene el evento. Los eventos simulados
 * (modo diagnóstico) se marcan como 'simulated' y la UI los muestra como tales:
 * nunca se presentan como si procedieran del Casio.
 */
export type InputSource = 'midi' | 'mouse' | 'computer-keyboard' | 'simulated'

export interface NoteOnEvent {
  type: 'noteon'
  note: number
  velocity: number
  channel: number
  /** ms en el reloj de performance.now() */
  time: number
  source: InputSource
  device?: string
}

export interface NoteOffEvent {
  type: 'noteoff'
  note: number
  /** velocidad de liberación (el CT-S300 envía siempre 64) */
  velocity: number
  channel: number
  time: number
  source: InputSource
  device?: string
}

export interface ControlChangeEvent {
  type: 'cc'
  controller: number
  value: number
  channel: number
  time: number
  source: InputSource
  device?: string
}

export interface PitchBendEvent {
  type: 'pitchbend'
  /** -1 … +1 */
  value: number
  channel: number
  time: number
  source: InputSource
  device?: string
}

export interface ProgramChangeEvent {
  type: 'program'
  program: number
  channel: number
  time: number
  source: InputSource
  device?: string
}

export type MusicEvent = NoteOnEvent | NoteOffEvent | ControlChangeEvent | PitchBendEvent | ProgramChangeEvent

export type NoteEvent = NoteOnEvent | NoteOffEvent

export const SOURCE_LABEL: Record<InputSource, string> = {
  midi: 'Teclado MIDI',
  mouse: 'Ratón (teclado virtual)',
  'computer-keyboard': 'Teclado del ordenador',
  simulated: 'SIMULADO',
}
