import { describe, expect, it } from 'vitest'
import { midiBytes, parseMidiMessage } from './parse'
import { inputBus } from './inputBus'
import type { MusicEvent } from './types'

describe('parseMidiMessage', () => {
  it('Note On con velocidad', () => {
    expect(parseMidiMessage([0x90, 60, 100], 1000)).toMatchObject({ type: 'noteon', note: 60, velocity: 100, channel: 1, time: 1000, source: 'midi' })
  })
  it('Note On con velocidad 0 = Note Off', () => {
    expect(parseMidiMessage([0x90, 60, 0], 5)).toMatchObject({ type: 'noteoff', note: 60 })
  })
  it('Note Off 8nH con velocidad 64 (como envía el CT-S300)', () => {
    expect(parseMidiMessage([0x80, 64, 64], 5)).toMatchObject({ type: 'noteoff', note: 64, velocity: 64 })
  })
  it('canal y transposición (MIDI Out Octave Shift)', () => {
    expect(parseMidiMessage([0x93, 60, 80], 0, 'midi', undefined, -12)).toMatchObject({ channel: 4, note: 48 })
  })
  it('sustain CC64 y pitch bend', () => {
    expect(parseMidiMessage([0xb0, 64, 127], 0)).toMatchObject({ type: 'cc', controller: 64, value: 127 })
    expect(parseMidiMessage([0xe0, 0, 64], 0)).toMatchObject({ type: 'pitchbend', value: 0 })
    expect((parseMidiMessage([0xe0, 127, 127], 0) as { value: number }).value).toBeCloseTo(1, 3)
  })
  it('ignora mensajes de sistema (active sensing, clock, sysex)', () => {
    expect(parseMidiMessage([0xfe], 0)).toBeNull()
    expect(parseMidiMessage([0xf8], 0)).toBeNull()
    expect(parseMidiMessage([0xf0, 0x7e, 0xf7], 0)).toBeNull()
  })
  it('genera bytes de salida correctos', () => {
    expect(midiBytes.noteOn(60, 100, 1)).toEqual([0x90, 60, 100])
    expect(midiBytes.noteOff(60, 2)).toEqual([0x81, 60, 64])
    expect(midiBytes.programChange(4, 1)).toEqual([0xc0, 4])
  })
})

describe('inputBus', () => {
  it('lleva la cuenta de notas mantenidas e ignora noteoff huérfanos', () => {
    const seen: MusicEvent[] = []
    const off = inputBus.subscribe((e) => seen.push(e))
    inputBus.emit({ type: 'noteon', note: 60, velocity: 90, channel: 1, time: 0, source: 'simulated' })
    inputBus.emit({ type: 'noteon', note: 64, velocity: 90, channel: 1, time: 1, source: 'simulated' })
    expect(inputBus.heldNotes()).toEqual([60, 64])
    inputBus.emit({ type: 'noteoff', note: 67, velocity: 0, channel: 1, time: 2, source: 'simulated' })
    inputBus.releaseAll()
    expect(inputBus.heldNotes()).toEqual([])
    expect(seen.map((e) => e.type)).toEqual(['noteon', 'noteon', 'noteoff', 'noteoff'])
    off()
  })
})
