import { mergeRepeatedChords } from '../scoring/comping'
import { leftHandFromChords, type LeftHandStyle } from './notation'
import { beatsPerBar, type Arrangement } from './schema'

/**
 * ACOMPAÑAR CON CIFRADOS
 * La app toca la melodía (mano derecha de la canción) y tú acompañas con la izquierda
 * leyendo solo los acordes. El patrón elegido sirve de referencia (escuchar / ver notas),
 * pero la evaluación es armónica: vale cualquier posición del acorde (ver scoring/comping.ts).
 */

export type CompingPattern = 'root' | 'block' | 'ballad' | 'arpeggio' | 'pop' | 'waltz'

export const COMPING_PATTERNS: { id: CompingPattern; name: string; description: string; style: LeftHandStyle }[] = [
  { id: 'root', name: 'Solo el bajo', description: 'Una nota por acorde: la del cifrado (o la que va tras la «/»). Ideal para empezar.', style: 'root' },
  { id: 'block', name: 'Bloque', description: 'El acorde entero, una vez por cambio, y lo mantienes.', style: 'block' },
  { id: 'pop', name: 'Pop', description: 'El acorde en cada pulso, como una guitarra rasgueando negras.', style: 'pulse' },
  { id: 'ballad', name: 'Balada', description: 'Bajo – quinta – octava – quinta en negras (1-5-8-5).', style: 'ballad' },
  { id: 'arpeggio', name: 'Arpegio', description: 'Las notas del acorde una a una, en negras.', style: 'broken' },
  { id: 'waltz', name: 'Bajo y acorde (vals)', description: 'Bajo en el 1 y acorde en los demás pulsos: «um-pa-pa» en 3/4, «um-pa-pa-pa» en 4/4.', style: 'bass-chord' },
]

/** Una canción se puede acompañar si tiene al menos dos acordes y algo de melodía o de estructura. */
export function canAccompany(a: Arrangement): boolean {
  return a.chords.length >= 2
}

export function compingArrangement(song: Arrangement, pattern: CompingPattern): Arrangement {
  const style = COMPING_PATTERNS.find((p) => p.id === pattern)!.style
  const melody = song.notes.filter((n) => n.hand === 'R')
  const lh = leftHandFromChords(song.chords, style)
  const notes = [...melody, ...lh].sort((a, b) => a.start - b.start || a.midi - b.midi)
  const end = Math.max(...song.chords.map((c) => c.start + c.duration), ...notes.map((n) => n.start + n.duration))
  const sections = song.sections.length ? song.sections : [{ id: 'all', name: 'Completa', start: 0, end }]
  return { ...song, id: `acomp:${song.id}:${pattern}`, title: `${song.title} · acompañamiento`, notes, sections }
}

/** Compases con sus acordes, para dibujar la hoja de cifrados. */
export function chordChart(song: Arrangement): { bar: number; chords: { symbol: string; beat: number }[] }[] {
  const beatsBar = beatsPerBar(song.timeSignature)
  const bars = new Map<number, { symbol: string; beat: number }[]>()
  const chords = mergeRepeatedChords(song.chords)
  const lastBar = Math.max(0, ...chords.map((c) => Math.floor((c.start + c.duration - 1e-6) / beatsBar)))
  for (let b = 0; b <= lastBar; b++) bars.set(b, [])
  for (const c of chords) {
    const bar = Math.floor(c.start / beatsBar + 1e-6)
    bars.get(bar)!.push({ symbol: c.symbol, beat: Math.round((c.start - bar * beatsBar) * 100) / 100 })
  }
  return [...bars.entries()].map(([bar, chords]) => ({ bar, chords }))
}
