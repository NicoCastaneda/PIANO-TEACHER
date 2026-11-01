import { pitchClass } from '../music/notes'
import { tempoScale } from './tolerance'
import type {
  ChordOutcome,
  DurationClass,
  EvaluationOptions,
  EvaluationResult,
  ExpectedNote,
  ExpectedOutcome,
  PlayedNote,
  SectionStat,
  TimingClass,
  Tolerance,
} from './types'

/**
 * MOTOR DE EVALUACIÓN DETERMINISTA
 * ────────────────────────────────
 * 1. Ventana efectiva por nota: tolerancia del nivel × escala por tempo, limitada
 *    a la mitad del intervalo con la siguiente/anterior nota de la MISMA altura
 *    (así dos notas repetidas nunca comparten ventana).
 * 2. Emparejamiento por altura con programación dinámica (alineamiento monótono):
 *    maximiza aciertos y minimiza el error temporal, respetando el orden. Una nota
 *    tocada solo puede emparejarse con una esperada (sin dobles conteos) y las notas
 *    repetidas no se cruzan entre sí.
 * 3. Notas sobrantes de ambos lados que coinciden en el tiempo se emparejan como
 *    "nota incorrecta" (o "octava equivocada" si es la misma clase de altura).
 * 4. Lo que queda: esperadas → omitidas; tocadas → adicionales.
 * 5. Puntuación transparente:
 *      N = aciertos / (esperadas + λ · adicionales)
 *      Total = 100 · N · (w_n + w_r·R + w_d·D + w_v·V) / (w_n + w_r + w_d + w_v)
 *    donde R, D y V son las medias (0–1) de precisión rítmica, de duración y de dinámica
 *    de las notas acertadas. Las dimensiones desactivadas no entran en la fórmula.
 */

const CHORD_CLUSTER_S = 0.03
const MIN_WINDOW_MS = 35

export function effectiveWindowsMs(expected: ExpectedNote[], tol: Tolerance, beatSeconds?: number): Map<string, number> {
  const base = tol.hitWindowMs * tempoScale(beatSeconds)
  const byPitch = new Map<number, ExpectedNote[]>()
  for (const e of expected) {
    const arr = byPitch.get(e.midi) ?? []
    arr.push(e)
    byPitch.set(e.midi, arr)
  }
  const out = new Map<string, number>()
  for (const arr of byPitch.values()) {
    arr.sort((a, b) => a.start - b.start)
    arr.forEach((e, i) => {
      let gap = Infinity
      if (i > 0) gap = Math.min(gap, e.start - arr[i - 1].start)
      if (i < arr.length - 1) gap = Math.min(gap, arr[i + 1].start - e.start)
      const halfGapMs = (gap * 1000) / 2
      out.set(e.id, Math.max(MIN_WINDOW_MS, Math.min(base, halfGapMs)))
    })
  }
  return out
}

/** Alineamiento monótono óptimo entre notas esperadas y tocadas de una misma altura. */
export function alignSamePitch(E: ExpectedNote[], P: PlayedNote[], windows: Map<string, number>): [ExpectedNote, PlayedNote][] {
  const n = E.length
  const m = P.length
  if (!n || !m) return []
  const W = m + 1
  const dp = new Float64Array((n + 1) * W)
  const move = new Uint8Array((n + 1) * W) // 1 = salto E, 2 = salto P, 3 = emparejar
  for (let i = 1; i <= n; i++) {
    dp[i * W] = i
    move[i * W] = 1
  }
  for (let j = 1; j <= m; j++) {
    dp[j] = j
    move[j] = 2
  }
  for (let i = 1; i <= n; i++) {
    const e = E[i - 1]
    const w = windows.get(e.id) ?? 100
    for (let j = 1; j <= m; j++) {
      let best = dp[(i - 1) * W + j] + 1
      let mv = 1
      const skipP = dp[i * W + j - 1] + 1
      if (skipP < best) {
        best = skipP
        mv = 2
      }
      const dtMs = Math.abs(P[j - 1].start - e.start) * 1000
      if (dtMs <= w) {
        const c = dp[(i - 1) * W + j - 1] + dtMs / w
        if (c < best) {
          best = c
          mv = 3
        }
      }
      dp[i * W + j] = best
      move[i * W + j] = mv
    }
  }
  const pairs: [ExpectedNote, PlayedNote][] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const mv = move[i * W + j]
    if (mv === 3) {
      pairs.push([E[i - 1], P[j - 1]])
      i--
      j--
    } else if (mv === 1) i--
    else j--
  }
  return pairs.reverse()
}

function timingScoreFor(dtMs: number, windowMs: number, perfectMs: number): number {
  const a = Math.abs(dtMs)
  const perfect = Math.min(perfectMs, windowMs)
  if (a <= perfect) return 1
  if (windowMs <= perfect) return 0.25
  return Math.max(0.25, 1 - (0.75 * (a - perfect)) / (windowMs - perfect))
}

function timingClassFor(dtMs: number, perfectMs: number): TimingClass {
  if (dtMs < -perfectMs) return 'early'
  if (dtMs > perfectMs) return 'late'
  return 'on-time'
}

export function durationEval(expectedDur: number, playedDur: number, tol: number): { score: number; cls: DurationClass; ratio: number } {
  const allowed = Math.max(expectedDur * tol, 0.08)
  const err = playedDur - expectedDur
  const ratio = expectedDur > 0 ? playedDur / expectedDur : 1
  if (Math.abs(err) <= allowed) return { score: 1, cls: 'ok', ratio }
  const score = Math.max(0, 1 - (Math.abs(err) - allowed) / (allowed * 2))
  return { score, cls: err < 0 ? 'short' : 'long', ratio }
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function stdDev(xs: number[]): number | null {
  if (xs.length < 2) return null
  const m = mean(xs)!
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

/** Agrupa las notas esperadas en acordes (por chordId o por simultaneidad dentro de la misma mano). */
export function groupChords(expected: ExpectedNote[]): Map<string, ExpectedNote[]> {
  const groups = new Map<string, ExpectedNote[]>()
  const withId = expected.filter((e) => e.chordId)
  for (const e of withId) {
    const g = groups.get(e.chordId!) ?? []
    g.push(e)
    groups.set(e.chordId!, g)
  }
  for (const hand of ['L', 'R'] as const) {
    const rest = expected.filter((e) => !e.chordId && e.hand === hand).sort((a, b) => a.start - b.start)
    let cluster: ExpectedNote[] = []
    const flush = () => {
      if (cluster.length >= 2) groups.set(`auto-${hand}-${cluster[0].id}`, cluster)
      cluster = []
    }
    for (const e of rest) {
      if (cluster.length && e.start - cluster[0].start > CHORD_CLUSTER_S) flush()
      cluster.push(e)
    }
    flush()
  }
  for (const [k, g] of groups) if (g.length < 2) groups.delete(k)
  return groups
}

export function evaluatePerformance(
  expectedIn: ExpectedNote[],
  playedIn: PlayedNote[],
  opts: EvaluationOptions,
  endTime?: number,
): EvaluationResult {
  const tol = opts.tolerance
  const expected = [...expectedIn].sort((a, b) => a.start - b.start || a.midi - b.midi)
  const played = [...playedIn].sort((a, b) => a.start - b.start || a.midi - b.midi)
  const sessionEnd = endTime ?? Math.max(0, ...expected.map((e) => e.start + e.duration), ...played.map((p) => p.end ?? p.start))
  const windows = effectiveWindowsMs(expected, tol, opts.beatSeconds)

  // ── 2. Emparejamiento por altura
  const ePitch = new Map<number, ExpectedNote[]>()
  const pPitch = new Map<number, PlayedNote[]>()
  for (const e of expected) ePitch.set(e.midi, [...(ePitch.get(e.midi) ?? []), e])
  for (const p of played) pPitch.set(p.midi, [...(pPitch.get(p.midi) ?? []), p])
  const matchE = new Map<string, PlayedNote>()
  const usedP = new Set<string>()
  for (const [pitch, E] of ePitch) {
    const P = pPitch.get(pitch)
    if (!P) continue
    for (const [e, p] of alignSamePitch(E, P, windows)) {
      matchE.set(e.id, p)
      usedP.add(p.id)
    }
  }

  // ── 3. Notas incorrectas / octava equivocada
  const uE = expected.filter((e) => !matchE.has(e.id))
  const uP = played.filter((p) => !usedP.has(p.id))
  const candidates: { e: ExpectedNote; p: PlayedNote; cost: number; octave: boolean }[] = []
  for (const e of uE) {
    const w = windows.get(e.id)!
    for (const p of uP) {
      const dtMs = Math.abs(p.start - e.start) * 1000
      if (dtMs > w) continue
      const octave = pitchClass(p.midi) === pitchClass(e.midi)
      candidates.push({ e, p, cost: dtMs / w + (octave ? 0 : 0.5) + Math.abs(p.midi - e.midi) / 1000, octave })
    }
  }
  candidates.sort((a, b) => a.cost - b.cost)
  const wrongE = new Map<string, { p: PlayedNote; octave: boolean }>()
  const wrongP = new Set<string>()
  for (const c of candidates) {
    if (wrongE.has(c.e.id) || wrongP.has(c.p.id)) continue
    wrongE.set(c.e.id, { p: c.p, octave: c.octave })
    wrongP.add(c.p.id)
  }

  // ── 4. Resultado por nota
  const outcomes: ExpectedOutcome[] = expected.map((e) => {
    const windowMs = windows.get(e.id)!
    const p = matchE.get(e.id)
    if (p) {
      const dtMs = (p.start - e.start) * 1000
      const o: ExpectedOutcome = {
        expected: e,
        status: 'hit',
        played: p,
        windowMs,
        timingMs: dtMs,
        timingClass: timingClassFor(dtMs, tol.perfectWindowMs),
        timingScore: timingScoreFor(dtMs, windowMs, tol.perfectWindowMs),
      }
      if (opts.evaluateDuration) {
        const playedDur = Math.max(0, (p.end ?? sessionEnd) - p.start)
        const d = durationEval(e.duration, playedDur, tol.durationTolerance)
        o.durationScore = d.score
        o.durationClass = d.cls
        o.durationRatio = d.ratio
      } else o.durationClass = 'n/a'
      if (opts.evaluateDynamics && e.velocity !== undefined) {
        const dv = Math.abs(p.velocity - e.velocity)
        o.dynamicsScore = dv <= tol.velocityTolerance ? 1 : Math.max(0, 1 - (dv - tol.velocityTolerance) / (tol.velocityTolerance * 2))
      }
      return o
    }
    const w = wrongE.get(e.id)
    if (w) return { expected: e, status: w.octave ? 'octave' : 'wrong', played: w.p, windowMs, timingMs: (w.p.start - e.start) * 1000 }
    return { expected: e, status: 'missed', windowMs }
  })
  const extras = uP.filter((p) => !wrongP.has(p.id))

  // ── Estadísticas
  const hits = outcomes.filter((o) => o.status === 'hit')
  const dts = hits.map((o) => o.timingMs!)
  const counts = {
    expected: expected.length,
    hits: hits.length,
    wrong: outcomes.filter((o) => o.status === 'wrong').length,
    octave: outcomes.filter((o) => o.status === 'octave').length,
    missed: outcomes.filter((o) => o.status === 'missed').length,
    extra: extras.length,
    early: hits.filter((o) => o.timingClass === 'early').length,
    late: hits.filter((o) => o.timingClass === 'late').length,
    onTime: hits.filter((o) => o.timingClass === 'on-time').length,
    shortReleases: hits.filter((o) => o.durationClass === 'short').length,
    longReleases: hits.filter((o) => o.durationClass === 'long').length,
  }

  // Acordes
  const chordOutcomes: ChordOutcome[] = []
  const outcomeById = new Map(outcomes.map((o) => [o.expected.id, o]))
  for (const [chordId, notes] of groupChords(expected)) {
    const start = Math.min(...notes.map((n) => n.start))
    const os = notes.map((n) => outcomeById.get(n.id)!)
    const hitOs = os.filter((o) => o.status === 'hit')
    const w = Math.max(...notes.map((n) => windows.get(n.id)!)) / 1000
    const extraMidis = [
      ...extras.filter((p) => Math.abs(p.start - start) <= w).map((p) => p.midi),
      ...os.filter((o) => o.status === 'wrong' || o.status === 'octave').map((o) => o.played!.midi),
    ]
    const starts = hitOs.map((o) => o.played!.start)
    const spreadMs = starts.length >= 2 ? (Math.max(...starts) - Math.min(...starts)) * 1000 : starts.length === 1 ? 0 : null
    const complete = hitOs.length === notes.length
    chordOutcomes.push({
      chordId,
      start,
      expectedMidis: notes.map((n) => n.midi).sort((a, b) => a - b),
      hitMidis: hitOs.map((o) => o.expected.midi).sort((a, b) => a - b),
      missingMidis: os.filter((o) => o.status !== 'hit').map((o) => o.expected.midi).sort((a, b) => a - b),
      extraMidis: extraMidis.sort((a, b) => a - b),
      complete,
      spreadMs,
      simultaneous: complete && spreadMs !== null && spreadMs <= tol.chordSpreadMs,
    })
  }
  chordOutcomes.sort((a, b) => a.start - b.start)

  // Mejor racha
  let streak = 0
  let bestStreak = 0
  for (const o of outcomes) {
    if (o.status === 'hit') bestStreak = Math.max(bestStreak, ++streak)
    else streak = 0
  }

  // Secciones
  const sections: SectionStat[] = (opts.sections ?? []).map((s) => {
    const os = outcomes.filter((o) => o.expected.start >= s.start && o.expected.start < s.end)
    const h = os.filter((o) => o.status === 'hit')
    return {
      id: s.id,
      name: s.name,
      expected: os.length,
      hits: h.length,
      accuracy: os.length ? h.length / os.length : 1,
      meanAbsTimingMs: mean(h.map((o) => Math.abs(o.timingMs!))),
    }
  })

  // ── 5. Puntuación
  const N = expected.length ? hits.length / (expected.length + opts.extraPenalty * extras.length) : extras.length ? 0 : 1
  // Sin notas acertadas la media no existe: 0 si había notas esperadas, 1 si el ejercicio estaba vacío.
  const emptyDefault = expected.length ? 0 : 1
  const R = opts.evaluateTiming ? mean(hits.map((o) => o.timingScore!)) ?? emptyDefault : null
  const D = opts.evaluateDuration ? mean(hits.map((o) => o.durationScore ?? 0)) ?? emptyDefault : null
  const dynVals = hits.filter((o) => o.dynamicsScore !== undefined).map((o) => o.dynamicsScore!)
  const V = opts.evaluateDynamics && dynVals.length ? mean(dynVals)! : null
  const w = opts.weights
  let num = w.notes
  let den = w.notes
  const parts = [`${fmt(w.notes)}`]
  if (R !== null) {
    num += w.timing * R
    den += w.timing
    parts.push(`${fmt(w.timing)}·R`)
  }
  if (D !== null) {
    num += w.duration * D
    den += w.duration
    parts.push(`${fmt(w.duration)}·D`)
  }
  if (V !== null) {
    num += w.dynamics * V
    den += w.dynamics
    parts.push(`${fmt(w.dynamics)}·V`)
  }
  const score = Math.round(100 * N * (den > 0 ? num / den : 1) * 10) / 10

  return {
    score,
    breakdown: {
      noteScore: N,
      timingScore: R,
      durationScore: D,
      dynamicsScore: V,
      weights: w,
      formula: `100 × N × (${parts.join(' + ')}) / ${fmt(den)},  N = aciertos / (esperadas + ${fmt(opts.extraPenalty)} × adicionales)`,
    },
    counts,
    noteAccuracy: expected.length ? hits.length / expected.length : 1,
    timing: { meanOffsetMs: mean(dts), meanAbsOffsetMs: mean(dts.map(Math.abs)), stdDevMs: stdDev(dts) },
    chords: {
      total: chordOutcomes.length,
      complete: chordOutcomes.filter((c) => c.complete).length,
      withExtras: chordOutcomes.filter((c) => c.extraMidis.length > 0).length,
      incomplete: chordOutcomes.filter((c) => !c.complete).length,
      simultaneous: chordOutcomes.filter((c) => c.simultaneous).length,
      outcomes: chordOutcomes,
    },
    bestStreak,
    outcomes,
    extras,
    sections,
    durationSec: sessionEnd,
  }
}

function fmt(n: number) {
  return (Math.round(n * 100) / 100).toString().replace('.', ',')
}

/**
 * Evaluación del modo "espera" (guiado): la canción se detiene hasta que se tocan
 * las notas correctas, por lo que no se mide el ritmo. Solo cuentan los errores.
 */
export interface WaitStepRecord {
  expected: ExpectedNote[]
  wrongPresses: number[]
  /** ms desde que el paso se activó hasta completarlo */
  reactionMs: number
}

export function evaluateWaitMode(steps: WaitStepRecord[], extraPenalty = 0.5) {
  const expected = steps.reduce((a, s) => a + s.expected.length, 0)
  const wrong = steps.reduce((a, s) => a + s.wrongPresses.length, 0)
  const cleanSteps = steps.filter((s) => s.wrongPresses.length === 0).length
  const N = expected ? expected / (expected + extraPenalty * 2 * wrong) : 1
  let streak = 0
  let bestStreak = 0
  for (const s of steps) {
    if (s.wrongPresses.length === 0) bestStreak = Math.max(bestStreak, (streak += s.expected.length))
    else streak = 0
  }
  const reactions = steps.map((s) => s.reactionMs)
  return {
    score: Math.round(100 * N * 10) / 10,
    expected,
    wrongPresses: wrong,
    cleanSteps,
    totalSteps: steps.length,
    bestStreak,
    meanReactionMs: mean(reactions),
    formula: `100 × esperadas / (esperadas + ${fmt(extraPenalty * 2)} × pulsaciones erróneas)`,
  }
}
