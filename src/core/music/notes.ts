/**
 * Conversión robusta entre números de nota MIDI y nombres de notas.
 *
 * La numeración de octavas NO es universal:
 *  - Convención científica / Casio / la mayoría de DAWs: MIDI 60 = C4 (Do central).
 *  - Convención Yamaha / algunos programas: MIDI 60 = C3.
 *  - Algunos programas antiguos: MIDI 60 = C5.
 * Por eso la convención se recibe como parámetro (configurable en Ajustes).
 */

export type OctaveConvention = 'C4' | 'C3' | 'C5'
export type NamingStyle = 'english' | 'latin'
export type Accidental = 'sharp' | 'flat'

/** Desfase que se suma a floor(midi/12) para obtener el número de octava. */
const OCTAVE_OFFSET: Record<OctaveConvention, number> = { C4: -1, C3: -2, C5: 0 }

export const PITCH_CLASSES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const PITCH_CLASSES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const LATIN: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' }

/** Teclas negras dentro de una octava (clases de altura). */
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

/**
 * Rango del Casio CT-S300 en su configuración por defecto.
 * 61 teclas, C2–C7 según el manual (Do central = C4 = MIDI 60) → MIDI 36–96.
 * Si el usuario cambia "MIDI Out Octave Shift" en el teclado, el rango
 * transmitido se desplaza: por eso el rango efectivo es configurable.
 */
export const CTS300_LOWEST = 36
export const CTS300_HIGHEST = 96
export const CTS300_KEY_COUNT = CTS300_HIGHEST - CTS300_LOWEST + 1 // 61

export interface NoteNameOptions {
  convention?: OctaveConvention
  style?: NamingStyle
  accidental?: Accidental
  withOctave?: boolean
}

export function isValidMidi(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 127
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PCS.has(pitchClass(midi))
}

export function octaveOf(midi: number, convention: OctaveConvention = 'C4'): number {
  return Math.floor(midi / 12) + OCTAVE_OFFSET[convention]
}

export function pitchClassName(pc: number, accidental: Accidental = 'sharp', style: NamingStyle = 'english'): string {
  const raw = (accidental === 'flat' ? PITCH_CLASSES_FLAT : PITCH_CLASSES_SHARP)[pitchClass(pc)]
  if (style === 'english') return raw
  return LATIN[raw[0]] + raw.slice(1).replace('#', '♯').replace('b', '♭')
}

export function midiToName(midi: number, opts: NoteNameOptions = {}): string {
  if (!isValidMidi(midi)) throw new RangeError(`Nota MIDI inválida: ${midi}`)
  const { convention = 'C4', style = 'english', accidental = 'sharp', withOctave = true } = opts
  const name = pitchClassName(midi, accidental, style)
  return withOctave ? `${name}${octaveOf(midi, convention)}` : name
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const LATIN_LETTER: Record<string, string> = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' }

/** Convierte un nombre de nota de texto ("C#4", "Eb3", "Do4", "sol#2") en clase de altura (+ octava si existe). */
export function parseNoteName(
  text: string,
  convention: OctaveConvention = 'C4',
): { pc: number; midi: number | null } | null {
  const m = /^\s*(do|re|mi|fa|sol|la|si|[A-Ga-g])\s*([#♯b♭]{0,2})\s*(-?\d+)?\s*$/i.exec(text)
  if (!m) return null
  const letterRaw = m[1].toLowerCase()
  const letter = LATIN_LETTER[letterRaw] ?? letterRaw.toUpperCase()
  let acc = 0
  for (const ch of m[2]) acc += ch === '#' || ch === '♯' ? 1 : -1
  const pc = pitchClass(LETTER_PC[letter] + acc)
  if (m[3] === undefined) return { pc, midi: null }
  const octave = Number(m[3])
  // La octava la fija la letra natural (B#3 = C4, Cb4 = B3).
  const midi = (octave - OCTAVE_OFFSET[convention]) * 12 + LETTER_PC[letter] + acc
  return { pc, midi: isValidMidi(midi) ? midi : null }
}

export function nameToMidi(text: string, convention: OctaveConvention = 'C4'): number {
  const r = parseNoteName(text, convention)
  if (!r || r.midi === null) throw new Error(`No se puede convertir "${text}" a nota MIDI`)
  return r.midi
}

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12)
}

/** Lista de teclas (MIDI) para un rango, por defecto el CT-S300. */
export function keyRange(low = CTS300_LOWEST, high = CTS300_HIGHEST): number[] {
  const out: number[] = []
  for (let n = low; n <= high; n++) out.push(n)
  return out
}

export function inRange(midi: number, low = CTS300_LOWEST, high = CTS300_HIGHEST): boolean {
  return midi >= low && midi <= high
}
