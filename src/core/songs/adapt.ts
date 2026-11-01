import { CTS300_HIGHEST, CTS300_LOWEST, midiToName } from '../music/notes'
import { chordPitchClasses, parseChordSymbol } from '../music/theory'
import type { ExpectedNote, Hand } from '../scoring/types'
import { beatsToSeconds, type Arrangement, type Difficulty, type SongNote } from './schema'

/**
 * Ajusta un arreglo al rango del teclado (por defecto CT-S300, C2–C7).
 * 1) Si toda la parte de una mano cabe desplazándola por octavas, se desplaza entera
 *    (conserva la forma melódica).
 * 2) Si no, cada nota fuera de rango se pliega por octavas hacia dentro.
 * Devuelve el arreglo y la lista de adaptaciones realizadas (para explicarlas).
 */
export function fitToRange(a: Arrangement, low = CTS300_LOWEST, high = CTS300_HIGHEST): { arrangement: Arrangement; changes: string[] } {
  const out = structuredClone(a)
  const changes: string[] = []
  for (const hand of ['R', 'L'] as const) {
    const notes = out.notes.filter((n) => n.hand === hand)
    if (!notes.length) continue
    const min = Math.min(...notes.map((n) => n.midi))
    const max = Math.max(...notes.map((n) => n.midi))
    if (min >= low && max <= high) continue
    const label = hand === 'R' ? 'derecha' : 'izquierda'
    if (max - min <= high - low) {
      let shift = 0
      while (min + shift < low) shift += 12
      while (max + shift > high) shift -= 12
      if (min + shift >= low && max + shift <= high) {
        notes.forEach((n) => (n.midi += shift))
        changes.push(`Mano ${label} transpuesta ${shift > 0 ? '+' : ''}${shift / 12} octava(s) para caber en ${midiToName(low)}–${midiToName(high)}.`)
        continue
      }
    }
    let folded = 0
    for (const n of notes) {
      while (n.midi < low) {
        n.midi += 12
        folded++
      }
      while (n.midi > high) {
        n.midi -= 12
        folded++
      }
    }
    if (folded) changes.push(`${folded} nota(s) de la mano ${label} reubicadas por octava para respetar el rango del teclado.`)
  }
  out.adaptations = [...out.adaptations, ...changes]
  return { arrangement: out, changes }
}

/** Nota más aguda de cada grupo simultáneo (para obtener la melodía). */
function topLine(notes: SongNote[]): SongNote[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start || b.midi - a.midi)
  const out: SongNote[] = []
  for (const n of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.start - n.start) < 0.03) continue
    out.push({ ...n })
  }
  // Recorta solapamientos para que la melodía sea una sola voz
  for (let i = 0; i < out.length - 1; i++) out[i].duration = Math.min(out[i].duration, out[i + 1].start - out[i].start)
  return out.filter((n) => n.duration > 0.05)
}

function quantize(v: number, grid: number) {
  return Math.round(v / grid) * grid
}

/**
 * Crea una versión de dificultad a partir de un arreglo completo (determinista).
 * - Principiante: solo la melodía (mano derecha, una voz), ritmo cuantizado a corchea,
 *   tempo sugerido 70 %.
 * - Intermedio: melodía + mano izquierda con la fundamental de cada acorde (o el bajo).
 * - Avanzado: arreglo completo.
 */
export function makeDifficultyVersion(full: Arrangement, level: Difficulty): Arrangement {
  const a = structuredClone(full)
  a.difficulty = level
  a.id = `${full.groupId ?? full.id}-${level}`
  a.groupId = full.groupId ?? full.id
  if (level === 'advanced') return a

  const rh = full.notes.filter((n) => n.hand === 'R')
  const melody = topLine(rh.length ? rh : full.notes).map((n) => ({ ...n, hand: 'R' as Hand }))
  if (level === 'beginner') {
    const q = melody.map((n) => ({ ...n, start: quantize(n.start, 0.5), duration: Math.max(0.5, quantize(n.duration, 0.5)) }))
    for (let i = 0; i < q.length - 1; i++) q[i].duration = Math.max(0.25, Math.min(q[i].duration, q[i + 1].start - q[i].start))
    a.notes = dedupeStarts(q)
    a.bpm = Math.round(full.bpm * 0.7)
    a.adaptations = [...a.adaptations, 'Versión principiante: solo melodía con la mano derecha, ritmo simplificado a corcheas y tempo al 70 %.']
    return a
  }
  // intermedio
  let left: SongNote[] = []
  if (full.chords.length) {
    for (const c of full.chords) {
      const p = parseChordSymbol(c.symbol)
      if (!p) continue
      const bassPc = p.bassPc ?? p.rootPc
      // Bajo entre G#2 y G3: cómodo para la mano izquierda
      left.push({ midi: 48 + bassPc - (bassPc > 7 ? 12 : 0), start: c.start, duration: c.duration, velocity: 70, hand: 'L' })
    }
  } else {
    const lh = full.notes.filter((n) => n.hand === 'L')
    const sorted = [...lh].sort((x, y) => x.start - y.start || x.midi - y.midi)
    const bass: SongNote[] = []
    for (const n of sorted) {
      const last = bass[bass.length - 1]
      if (last && Math.abs(last.start - n.start) < 0.03) continue
      bass.push({ ...n })
    }
    left = bass
  }
  a.notes = [...melody, ...left].sort((x, y) => x.start - y.start || x.midi - y.midi)
  a.bpm = Math.round(full.bpm * 0.85)
  a.adaptations = [...a.adaptations, 'Versión intermedia: melodía con la derecha y bajo (fundamental del acorde) con la izquierda; tempo al 85 %.']
  return a
}

function dedupeStarts(notes: SongNote[]): SongNote[] {
  const out: SongNote[] = []
  for (const n of notes) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.start - n.start) < 1e-6) continue
    out.push(n)
  }
  return out
}

export interface PracticeSelection {
  hands: 'both' | 'R' | 'L'
  /** 1 = tempo original */
  tempoFactor: number
  /** rango en pulsos (para practicar una sección) */
  fromBeat?: number
  toBeat?: number
}

/**
 * Convierte el arreglo en notas esperadas en SEGUNDOS REALES (tempo de práctica aplicado),
 * relativas al inicio del fragmento. Las notas de la mano no practicada se devuelven
 * aparte para que la aplicación las reproduzca como acompañamiento.
 */
export function toTimeline(a: Arrangement, sel: PracticeSelection) {
  const from = sel.fromBeat ?? 0
  const to = sel.toBeat ?? Infinity
  const bpm = a.bpm * sel.tempoFactor
  const inRange = a.notes.filter((n) => n.start >= from - 1e-6 && n.start < to - 1e-6)
  const chordKey = (n: SongNote) => `${n.hand}-${Math.round(n.start * 1000)}`
  const counts = new Map<string, number>()
  inRange.forEach((n) => counts.set(chordKey(n), (counts.get(chordKey(n)) ?? 0) + 1))
  const mk = (n: SongNote, i: number): ExpectedNote => ({
    id: `n${i}-${n.midi}-${n.start}`,
    midi: n.midi,
    start: beatsToSeconds(n.start - from, bpm),
    duration: beatsToSeconds(Math.min(n.duration, to - n.start), bpm),
    hand: n.hand,
    velocity: n.velocity,
    chordId: (counts.get(chordKey(n)) ?? 0) >= 2 ? chordKey(n) : undefined,
  })
  const all = inRange.map(mk)
  const played = all.filter((n) => sel.hands === 'both' || n.hand === sel.hands)
  const accompaniment = all.filter((n) => !(sel.hands === 'both' || n.hand === sel.hands))
  const endBeat = Math.min(to, Math.max(...a.notes.map((n) => n.start + n.duration), ...a.sections.map((s) => s.end)))
  return {
    expected: played,
    accompaniment,
    bpm,
    beatSeconds: 60 / bpm,
    lengthSec: beatsToSeconds(endBeat - from, bpm),
    chords: a.chords
      .filter((c) => c.start >= from - 1e-6 && c.start < to - 1e-6)
      .map((c) => ({ symbol: c.symbol, start: beatsToSeconds(c.start - from, bpm), duration: beatsToSeconds(c.duration, bpm), pcs: chordPitchClasses(c.symbol) ?? [] })),
    sections: a.sections
      .filter((s) => s.end > from && s.start < to)
      .map((s) => ({ id: s.id, name: s.name, start: beatsToSeconds(Math.max(s.start, from) - from, bpm), end: beatsToSeconds(Math.min(s.end, to) - from, bpm) })),
  }
}

export type Timeline = ReturnType<typeof toTimeline>
