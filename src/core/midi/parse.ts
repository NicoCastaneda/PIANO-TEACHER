import type { InputSource, MusicEvent } from './types'

/**
 * Interpreta un mensaje MIDI de canal (bytes crudos) y lo convierte en un evento tipado.
 * - Note On con velocidad 0 se trata como Note Off (práctica estándar MIDI).
 * - El CT-S300 envía Note Off como 8nH con velocidad 64 (Implementation Chart).
 * - Mensajes de sistema (clock, active sensing 0xFE, SysEx) se ignoran: devuelve null.
 * - Soporta running status solo a nivel de mensaje completo (Web MIDI entrega mensajes completos).
 */
export function parseMidiMessage(
  data: ArrayLike<number>,
  time: number,
  source: InputSource = 'midi',
  device?: string,
  transpose = 0,
): MusicEvent | null {
  if (!data || data.length === 0) return null
  const status = data[0]
  if (status < 0x80 || status >= 0xf0) return null
  const kind = status & 0xf0
  const channel = (status & 0x0f) + 1
  const d1 = data[1] ?? 0
  const d2 = data[2] ?? 0
  const base = { channel, time, source, device }
  switch (kind) {
    case 0x90: {
      const note = d1 + transpose
      if (note < 0 || note > 127) return null
      return d2 === 0 ? { ...base, type: 'noteoff', note, velocity: 0 } : { ...base, type: 'noteon', note, velocity: d2 }
    }
    case 0x80: {
      const note = d1 + transpose
      if (note < 0 || note > 127) return null
      return { ...base, type: 'noteoff', note, velocity: d2 }
    }
    case 0xb0:
      return { ...base, type: 'cc', controller: d1, value: d2 }
    case 0xc0:
      return { ...base, type: 'program', program: d1 }
    case 0xe0: {
      const raw = (d2 << 7) | d1 // 0…16383, centro 8192
      return { ...base, type: 'pitchbend', value: Math.max(-1, Math.min(1, (raw - 8192) / 8192)) }
    }
    default:
      return null // aftertouch, poly pressure: no relevantes para la evaluación
  }
}

/** Bytes para enviar al teclado. */
export const midiBytes = {
  noteOn: (note: number, velocity: number, channel = 1) => [0x90 | ((channel - 1) & 0x0f), note & 0x7f, Math.max(1, Math.min(127, Math.round(velocity)))],
  noteOff: (note: number, channel = 1) => [0x80 | ((channel - 1) & 0x0f), note & 0x7f, 64],
  programChange: (program: number, channel = 1) => [0xc0 | ((channel - 1) & 0x0f), program & 0x7f],
  controlChange: (cc: number, value: number, channel = 1) => [0xb0 | ((channel - 1) & 0x0f), cc & 0x7f, value & 0x7f],
  allNotesOff: (channel = 1) => [0xb0 | ((channel - 1) & 0x0f), 123, 0],
  allSoundOff: (channel = 1) => [0xb0 | ((channel - 1) & 0x0f), 120, 0],
}

export const CC_NAMES: Record<number, string> = {
  0: 'Bank Select MSB',
  1: 'Modulación',
  6: 'Data Entry MSB',
  7: 'Volumen',
  10: 'Panorama',
  11: 'Expresión',
  32: 'Bank Select LSB',
  38: 'Data Entry LSB',
  64: 'Pedal de sostenido (Sustain)',
  66: 'Sostenuto',
  67: 'Pedal suave (Soft)',
  72: 'Release Time',
  100: 'RPN LSB',
  101: 'RPN MSB',
  120: 'All Sound Off',
  121: 'Reset All Controllers',
  123: 'All Notes Off',
}
