import { pitchClass } from '../music/notes'
import { parseChordSymbol } from '../music/theory'
import type { PlayedNote } from './types'

/**
 * EVALUACIÓN DE ACOMPAÑAMIENTO CON CIFRADOS
 *
 * Cuando solo ves los acordes (C – G/B – Am – F) puedes tocarlos en cualquier posición,
 * octava o patrón. Por eso aquí no se comparan notas exactas, sino:
 *   - armonía: qué parte de lo que tocas durante cada acorde pertenece a ese acorde;
 *   - puntualidad: si la primera nota del acorde nuevo llega dentro de la ventana de tolerancia;
 *   - bajo (informativo): si la nota más grave del primer golpe es la que pide el cifrado.
 * Los acordes repetidos seguidos cuentan como uno solo.
 * Puntuación = 100 × (0,55 × armonía + 0,45 × puntualidad). El bajo no resta.
 */

export type CompStatus = 'ok' | 'early' | 'late' | 'wrong' | 'missed'

export interface CompChord {
  /** s, reloj de la canción */
  start: number
  duration: number
  symbol: string
  pcs: number[]
}

export interface CompOutcome {
  symbol: string
  start: number
  status: CompStatus
  /** ms; positivo = tarde */
  offsetMs: number | null
  onTime: boolean
  /** notas tocadas durante el acorde y cuántas pertenecen a él */
  notes: number[]
  chordTones: number
  bassOk: boolean | null
}

export interface CompingResult {
  outcomes: CompOutcome[]
  score: number
  harmony: number
  punctuality: number
  bassAccuracy: number | null
  /** desfase medio (ms) en los cambios de acorde, sin contar el primero */
  meanLagMs: number | null
  counts: Record<CompStatus, number> & { chords: number }
  windowMs: number
  formula: string
}

/**
 * Un mismo acorde repetido seguido (C:2 C:2) es un solo acorde para quien acompaña:
 * mantenerlo no debe contar como «sin tocar» el segundo.
 */
export function mergeRepeatedChords<T extends { start: number; duration: number; symbol: string }>(chords: T[]): T[] {
  const out: T[] = []
  for (const c of [...chords].sort((a, b) => a.start - b.start)) {
    const prev = out[out.length - 1]
    if (prev && prev.symbol === c.symbol && Math.abs(prev.start + prev.duration - c.start) < 1e-3) out[out.length - 1] = { ...prev, duration: c.start + c.duration - prev.start }
    else out.push({ ...c })
  }
  return out
}

export const COMP_FORMULA = '100 × (0,55 × armonía + 0,45 × puntualidad)'

export function evaluateComping(chords: CompChord[], played: PlayedNote[], o: { windowMs: number; groupMs?: number; minToneRatio?: number }): CompingResult {
  const w = o.windowMs / 1000
  const groupS = (o.groupMs ?? 150) / 1000
  const minRatio = o.minToneRatio ?? 0.75
  const cs = mergeRepeatedChords(chords)
  const onsets = [...played].sort((a, b) => a.start - b.start)
  // cada acorde "recoge" las notas desde un poco antes de su inicio (anticipación) hasta el siguiente
  const reach = (i: number) => Math.min(2 * w, i > 0 ? 0.4 * cs[i - 1].duration : 2 * w)
  const begins = cs.map((c, i) => c.start - reach(i))
  const outcomes: CompOutcome[] = cs.map((c, i) => {
    const from = begins[i]
    const to = i + 1 < cs.length ? begins[i + 1] : c.start + c.duration + 0.3
    const notes = onsets.filter((p) => p.start >= from - 1e-9 && p.start < to - 1e-9)
    const base = { symbol: c.symbol, start: c.start }
    if (!notes.length) return { ...base, status: 'missed', offsetMs: null, onTime: false, notes: [], chordTones: 0, bassOk: null }
    const tones = notes.filter((p) => c.pcs.includes(pitchClass(p.midi)))
    const ratio = tones.length / notes.length
    const first = tones[0] ?? notes[0]
    const offsetMs = Math.round((first.start - c.start) * 1000)
    const onTime = tones.length > 0 && Math.abs(offsetMs) <= o.windowMs
    const group = notes.filter((p) => p.start - first.start <= groupS && p.start >= first.start - 1e-9)
    const parsed = parseChordSymbol(c.symbol)
    const bassPc = parsed ? (parsed.bassPc ?? parsed.rootPc) : null
    const bassOk = bassPc === null ? null : pitchClass(Math.min(...group.map((p) => p.midi))) === bassPc
    const status: CompStatus = ratio < minRatio ? 'wrong' : offsetMs < -o.windowMs ? 'early' : offsetMs > o.windowMs ? 'late' : 'ok'
    return { ...base, status, offsetMs, onTime, notes: notes.map((p) => p.midi), chordTones: tones.length, bassOk }
  })
  const n = Math.max(1, outcomes.length)
  const harmony = outcomes.reduce((s, x) => s + (x.notes.length ? x.chordTones / x.notes.length : 0), 0) / n
  const punctuality = outcomes.filter((x) => x.onTime).length / n
  const withBass = outcomes.filter((x) => x.bassOk !== null)
  const lags = outcomes.slice(1).filter((x) => x.chordTones > 0 && x.offsetMs !== null)
  const counts = { chords: outcomes.length, ok: 0, early: 0, late: 0, wrong: 0, missed: 0 }
  for (const x of outcomes) counts[x.status]++
  return {
    outcomes,
    score: outcomes.length ? Math.round(1000 * (0.55 * harmony + 0.45 * punctuality)) / 10 : 0,
    harmony,
    punctuality,
    bassAccuracy: withBass.length ? withBass.filter((x) => x.bassOk).length / withBass.length : null,
    meanLagMs: lags.length ? lags.reduce((s, x) => s + x.offsetMs!, 0) / lags.length : null,
    counts,
    windowMs: o.windowMs,
    formula: COMP_FORMULA,
  }
}
