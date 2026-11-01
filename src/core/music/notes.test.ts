import { describe, expect, it } from 'vitest'
import { CTS300_HIGHEST, CTS300_KEY_COUNT, CTS300_LOWEST, isBlackKey, midiToName, nameToMidi, octaveOf, parseNoteName } from './notes'

describe('conversión de notas MIDI', () => {
  it('MIDI 60 es C4 en la convención por defecto (Casio / científica)', () => {
    expect(midiToName(60)).toBe('C4')
    expect(midiToName(69)).toBe('A4')
  })
  it('respeta otras convenciones de octava', () => {
    expect(midiToName(60, { convention: 'C3' })).toBe('C3')
    expect(midiToName(60, { convention: 'C5' })).toBe('C5')
    expect(octaveOf(36, 'C4')).toBe(2)
  })
  it('nombres latinos y bemoles', () => {
    expect(midiToName(61, { style: 'latin' })).toBe('Do♯4')
    expect(midiToName(70, { accidental: 'flat' })).toBe('Bb4')
    expect(midiToName(70, { accidental: 'flat', style: 'latin' })).toBe('Si♭4')
  })
  it('rango del CT-S300: 61 teclas C2–C7', () => {
    expect(CTS300_KEY_COUNT).toBe(61)
    expect(midiToName(CTS300_LOWEST)).toBe('C2')
    expect(midiToName(CTS300_HIGHEST)).toBe('C7')
  })
  it('lee nombres en texto, incluidos enarmónicos en el límite de octava', () => {
    expect(nameToMidi('C4')).toBe(60)
    expect(nameToMidi('Eb3')).toBe(51)
    expect(nameToMidi('sol#2')).toBe(44)
    expect(nameToMidi('B#3')).toBe(60)
    expect(nameToMidi('Cb4')).toBe(59)
    expect(nameToMidi('C3', 'C3')).toBe(60)
    expect(parseNoteName('F#')).toEqual({ pc: 6, midi: null })
    expect(parseNoteName('H4')).toBeNull()
  })
  it('round-trip para todas las notas MIDI', () => {
    for (let n = 0; n < 128; n++) expect(nameToMidi(midiToName(n))).toBe(n)
  })
  it('teclas negras', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([false, true, false, true, false, false, true])
  })
})
