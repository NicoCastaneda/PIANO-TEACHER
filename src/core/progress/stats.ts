import { SKILL_LABEL, type Skill } from '../practice/exercises'
import type { AttemptRecord } from '../storage/db'

/**
 * Estadísticas y recomendaciones calculadas SOLO a partir de intentos registrados.
 * Si no hay datos, no se inventan: las funciones devuelven listas vacías / null.
 */

export interface SkillStat {
  skill: Skill
  label: string
  attempts: number
  /** media ponderada (intentos recientes pesan más), 0–100 */
  level: number
  lastAt: number
  mastered: boolean
}

const DAY = 86400000

export function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function practiceStreak(attempts: AttemptRecord[], now = Date.now()): { current: number; best: number } {
  const days = new Set(attempts.map((a) => dayKey(a.at)))
  if (!days.size) return { current: 0, best: 0 }
  let current = 0
  let t = now
  // si hoy aún no se practicó, la racha cuenta desde ayer
  if (!days.has(dayKey(t))) t -= DAY
  while (days.has(dayKey(t))) {
    current++
    t -= DAY
  }
  const sorted = [...days].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / DAY)
    run = diff === 1 ? run + 1 : 1
    best = Math.max(best, run)
  }
  return { current, best: Math.max(best, current) }
}

export function skillStats(attempts: AttemptRecord[]): SkillStat[] {
  const by = new Map<Skill, AttemptRecord[]>()
  for (const a of attempts) for (const s of a.skills) by.set(s, [...(by.get(s) ?? []), a])
  const out: SkillStat[] = []
  for (const [skill, list] of by) {
    const sorted = [...list].sort((a, b) => a.at - b.at)
    // media móvil exponencial: refleja el nivel actual, no el histórico
    let ema = sorted[0].score
    for (const a of sorted.slice(1)) ema = ema * 0.6 + a.score * 0.4
    const recent = sorted.slice(-3)
    out.push({
      skill,
      label: SKILL_LABEL[skill],
      attempts: list.length,
      level: Math.round(ema),
      lastAt: sorted[sorted.length - 1].at,
      mastered: recent.length >= 2 && recent.every((a) => a.score >= 85),
    })
  }
  return out.sort((a, b) => b.level - a.level)
}

export interface Summary {
  totalAttempts: number
  totalPracticeSec: number
  avgScore: number | null
  avgNoteAccuracy: number | null
  avgTiming: number | null
  last7Days: number
  streak: { current: number; best: number }
  songsPracticed: number
}

export function summary(attempts: AttemptRecord[], now = Date.now()): Summary {
  const scored = attempts.filter((a) => a.mode !== 'improv')
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const timing = scored.map((a) => a.timingScore).filter((x): x is number => x !== null)
  return {
    totalAttempts: attempts.length,
    totalPracticeSec: attempts.reduce((s, a) => s + a.practiceSec, 0),
    avgScore: avg(scored.map((a) => a.score)),
    avgNoteAccuracy: avg(scored.map((a) => a.noteAccuracy)),
    avgTiming: avg(timing),
    last7Days: attempts.filter((a) => a.at > now - 7 * DAY).length,
    streak: practiceStreak(attempts, now),
    songsPracticed: new Set(attempts.filter((a) => a.kind === 'song').map((a) => a.refId)).size,
  }
}

/** Serie temporal por día (para gráficas). */
export function dailySeries(attempts: AttemptRecord[]) {
  const by = new Map<string, AttemptRecord[]>()
  for (const a of attempts) by.set(dayKey(a.at), [...(by.get(dayKey(a.at)) ?? []), a])
  return [...by.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, list]) => {
      const scored = list.filter((a) => a.mode !== 'improv')
      const m = (f: (a: AttemptRecord) => number | null) => {
        const xs = scored.map(f).filter((x): x is number => x !== null)
        return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null
      }
      return {
        day,
        score: m((a) => a.score),
        notes: m((a) => a.noteAccuracy * 100),
        timing: m((a) => (a.timingScore === null ? null : a.timingScore * 100)),
        minutes: list.reduce((s, a) => s + a.practiceSec, 0) / 60,
        attempts: list.length,
      }
    })
}

export interface Recommendation {
  id: string
  title: string
  reason: string
  /** a dónde llevar al usuario */
  target: { kind: 'practice'; preset: string } | { kind: 'lesson'; lessonId: string } | { kind: 'song-section'; songId: string; sectionId: string }
  priority: number
}

/**
 * Recomendaciones basadas en reglas explícitas sobre los resultados registrados.
 * Cada recomendación incluye el dato que la justifica.
 */
export function recommendations(attempts: AttemptRecord[]): Recommendation[] {
  const recent = [...attempts].sort((a, b) => b.at - a.at).slice(0, 15).filter((a) => a.mode === 'timed')
  const recs: Recommendation[] = []
  if (recent.length < 2) return recs
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const notes = avg(recent.map((a) => a.noteAccuracy))
  const timings = recent.map((a) => a.timingScore).filter((x): x is number => x !== null)
  const timing = timings.length ? avg(timings) : null
  const offsets = recent.map((a) => a.meanOffsetMs).filter((x): x is number => x !== null)
  const meanOffset = offsets.length ? avg(offsets) : 0
  const late = recent.reduce((s, a) => s + a.counts.late, 0)
  const early = recent.reduce((s, a) => s + a.counts.early, 0)
  const hits = recent.reduce((s, a) => s + a.counts.hits, 0)
  const lags = recent.map((a) => a.chordChangeLagMs).filter((x): x is number => typeof x === 'number')
  const chordLag = lags.length ? avg(lags) : null

  if (notes >= 0.85 && chordLag !== null && chordLag > 60) {
    recs.push({
      id: 'chord-changes',
      title: 'Cambios de acorde con énfasis rítmico',
      reason: `Aciertas el ${Math.round(notes * 100)} % de las notas, pero llegas de media ${Math.round(chordLag)} ms tarde a los cambios de acorde.`,
      target: { kind: 'practice', preset: 'chord-changes' },
      priority: 10,
    })
  }
  if (timing !== null && notes >= 0.8 && timing < 0.7) {
    recs.push({
      id: 'timing',
      title: meanOffset > 0 ? 'Ejercicios de ritmo: te estás retrasando' : 'Ejercicios de ritmo: te estás adelantando',
      reason: `Precisión rítmica media ${Math.round(timing * 100)} % (desfase medio ${Math.round(meanOffset)} ms; ${late} notas tarde y ${early} pronto de ${hits}).`,
      target: { kind: 'practice', preset: 'rhythm' },
      priority: 9,
    })
  }
  if (notes < 0.7) {
    recs.push({
      id: 'notes',
      title: 'Reduce el tempo y usa el modo guiado',
      reason: `Solo el ${Math.round(notes * 100)} % de las notas fueron correctas en tus últimos intentos. El modo espera te deja encontrar cada nota sin presión.`,
      target: { kind: 'practice', preset: 'wait-mode' },
      priority: 8,
    })
  }
  const octave = recent.reduce((s, a) => s + a.counts.octave, 0)
  if (octave >= 3) {
    recs.push({
      id: 'octaves',
      title: 'Repasa las octavas',
      reason: `Has tocado ${octave} notas en la octava equivocada recientemente.`,
      target: { kind: 'lesson', lessonId: 'l1-octaves' },
      priority: 6,
    })
  }
  const extras = recent.reduce((s, a) => s + a.counts.extra, 0)
  if (extras > hits * 0.2 && hits > 10) {
    recs.push({
      id: 'extras',
      title: 'Precisión: evita notas de más',
      reason: `${extras} notas adicionales frente a ${hits} aciertos. Practica más lento y prepara la mano antes de tocar.`,
      target: { kind: 'practice', preset: 'wait-mode' },
      priority: 5,
    })
  }
  // Secciones débiles de canciones
  const songAttempts = attempts.filter((a) => a.kind === 'song' && a.sections?.length)
  const weak = new Map<string, { songId: string; title: string; name: string; acc: number[]; sectionId: string }>()
  for (const a of songAttempts.slice(-20)) {
    for (const s of a.sections!) {
      const k = `${a.refId}:${s.id}`
      const w = weak.get(k) ?? { songId: a.refId, title: a.title, name: s.name, acc: [], sectionId: s.id }
      w.acc.push(s.accuracy)
      weak.set(k, w)
    }
  }
  const weakest = [...weak.values()].map((w) => ({ ...w, mean: avg(w.acc) })).filter((w) => w.mean < 0.75).sort((a, b) => a.mean - b.mean)[0]
  if (weakest) {
    recs.push({
      id: `section-${weakest.songId}-${weakest.sectionId}`,
      title: `Practica solo "${weakest.name}" de ${weakest.title}`,
      reason: `Es la sección con menor precisión (${Math.round(weakest.mean * 100)} %). No hace falta repetir la canción entera.`,
      target: { kind: 'song-section', songId: weakest.songId, sectionId: weakest.sectionId },
      priority: 7,
    })
  }
  return recs.sort((a, b) => b.priority - a.priority)
}

/** Dificultad recomendada para una canción nueva, según resultados recientes. */
export function recommendedDifficulty(attempts: AttemptRecord[]): { level: 'beginner' | 'intermediate' | 'advanced'; reason: string } {
  const recent = attempts.filter((a) => a.mode === 'timed').slice(-10)
  if (recent.length < 3) return { level: 'beginner', reason: 'Aún hay pocos resultados registrados: empezamos por la versión sencilla.' }
  const m = recent.reduce((s, a) => s + a.score, 0) / recent.length
  const twoHands = recent.filter((a) => a.skills.includes('two-hands') || a.hands === 'both')
  const th = twoHands.length ? twoHands.reduce((s, a) => s + a.score, 0) / twoHands.length : 0
  if (m >= 85 && th >= 80) return { level: 'advanced', reason: `Media reciente ${Math.round(m)} y ${Math.round(th)} con dos manos.` }
  if (m >= 70) return { level: 'intermediate', reason: `Media reciente ${Math.round(m)} sobre 100.` }
  return { level: 'beginner', reason: `Media reciente ${Math.round(m)} sobre 100: conviene consolidar.` }
}
