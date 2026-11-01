import { cardsForGroups, CHORD_GROUPS, MASTERED_BOX, recommendedGroup, type CardStat, type ChordCard } from '../chords/trainer'
import { PROGRESSIONS } from '../chords/progressions'
import { DRILL_INFO, earKey, recentAccuracy, suggestedLevel, type EarDrill, type EarStat } from '../ear/ear'
import { arpeggioExercise, findNotesExercise, progressionExercise, rhythmExercise, scaleExercise, type Skill } from '../practice/exercises'
import { recommendations } from '../progress/stats'
import type { SessionMode } from '../practice/PracticeSession'
import type { Arrangement } from '../songs/schema'
import type { AttemptRecord } from '../storage/db'

/**
 * PRÁCTICA DE HOY
 * Una rutina guiada de ~15 minutos construida SOLO con los datos registrados:
 *   1. Tarjetas de acordes que tocan repaso (cajas bajas del repaso espaciado).
 *   2. Un ejercicio dirigido a tu punto débil (las mismas reglas de `recommendations`).
 *   3. La sección más floja de una canción (o acompañar con cifrados si aún no hay canciones).
 *   4. Oído: unas preguntas de tocar de oído.
 *   5. Algo nuevo: una progresión que aún no has practicado.
 * El plan se fija al generarse (se guarda por fecha) para que no cambie mientras practicas.
 * Es serializable: cada paso guarda solo identificadores y parámetros.
 */

export type ExerciseSpec =
  | { type: 'progression'; degrees: number[]; tonicMidi: number; bpm: number; lhStyle: 'root' | 'block' }
  | { type: 'rhythm'; pattern: number[]; bpm: number; name: string }
  | { type: 'notes'; midis: number[] }
  | { type: 'scale'; rootMidi: number; scaleId: string; bpm: number }
  | { type: 'arpeggio'; rootMidi: number; typeId: string; bpm: number }

export type DailyStep =
  | { id: 'cards'; kind: 'cards'; title: string; reason: string; minutes: number; cardIds: string[]; answers: number }
  | { id: 'weak'; kind: 'exercise'; title: string; reason: string; minutes: number; spec: ExerciseSpec; mode: SessionMode; skills: Skill[] }
  | { id: 'weak'; kind: 'lesson'; title: string; reason: string; minutes: number; lessonId: string }
  | { id: 'section'; kind: 'section'; title: string; reason: string; minutes: number; songId: string; level: 'beginner' | 'intermediate' | 'advanced'; sectionId: string }
  | { id: 'section'; kind: 'comp'; title: string; reason: string; minutes: number; songId: string }
  | { id: 'ear'; kind: 'ear'; title: string; reason: string; minutes: number; drill: EarDrill; level: number; answers: number }
  | { id: 'new'; kind: 'progression'; title: string; reason: string; minutes: number; progressionId: string; tonic: number }

export interface DailyPlan {
  date: string
  steps: DailyStep[]
}

export interface StepResult {
  status: 'done' | 'skipped'
  /** texto corto del resultado: "6/8 tarjetas", "82/100"… */
  detail?: string
  score?: number
  seconds?: number
}

export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Generador pseudoaleatorio determinista a partir de un texto (la fecha). */
export function seeded(text: string): () => number {
  let h = 2166136261
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export interface PlanInput {
  attempts: AttemptRecord[]
  chordStats: Record<string, CardStat>
  earStats: Record<string, EarStat>
  /** canciones que se pueden acompañar (con acordes), por si aún no hay intentos de canciones */
  compSongIds: string[]
  date?: string
}

export const ALL_CARDS: ChordCard[] = cardsForGroups(
  CHORD_GROUPS.map((g) => g.id),
  'all',
)

function cardsStep(stats: Record<string, CardStat>): DailyStep {
  const due = ALL_CARDS.filter((c) => stats[c.id] && stats[c.id].box < MASTERED_BOX - 1).sort((a, b) => stats[a.id].box - stats[b.id].box || stats[a.id].lastSeen - stats[b.id].lastSeen)
  if (due.length >= 4) {
    const ids = due.slice(0, 8).map((c) => c.id)
    return {
      id: 'cards',
      kind: 'cards',
      title: 'Repaso de acordes',
      reason: `${due.length} tarjeta${due.length > 1 ? 's' : ''} en cajas bajas del repaso espaciado: tocan hoy.`,
      minutes: 3,
      cardIds: ids,
      answers: Math.min(10, Math.max(6, ids.length)),
    }
  }
  const g = recommendedGroup(stats)
  const cards = cardsForGroups([g.id], 'root')
  const ids = [...due.map((c) => c.id), ...cards.map((c) => c.id).filter((id) => !due.some((d) => d.id === id))].slice(0, 8)
  return {
    id: 'cards',
    kind: 'cards',
    title: `Acordes: ${g.title}`,
    reason: due.length ? `Pocas tarjetas pendientes (${due.length}); se completan con el grupo recomendado.` : `Grupo recomendado según tu dominio actual de las tarjetas.`,
    minutes: 3,
    cardIds: ids,
    answers: 6,
  }
}

const RHYTHM_EIGHTHS = [0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5, 2]

function weakStep(attempts: AttemptRecord[], rng: () => number): DailyStep {
  const rec = recommendations(attempts).find((r) => r.target.kind !== 'song-section')
  if (rec?.target.kind === 'lesson') return { id: 'weak', kind: 'lesson', title: rec.title, reason: rec.reason, minutes: 4, lessonId: rec.target.lessonId }
  if (rec?.target.kind === 'practice') {
    const preset = rec.target.preset
    if (preset === 'chord-changes')
      return {
        id: 'weak',
        kind: 'exercise',
        title: rec.title,
        reason: rec.reason,
        minutes: 4,
        spec: { type: 'progression', degrees: [0, 4, 5, 3], tonicMidi: 60, bpm: 66, lhStyle: 'root' },
        mode: 'timed',
        skills: ['progressions', 'chord-changes', 'two-hands'],
      }
    if (preset === 'rhythm')
      return {
        id: 'weak',
        kind: 'exercise',
        title: rec.title,
        reason: rec.reason,
        minutes: 4,
        spec: { type: 'rhythm', pattern: RHYTHM_EIGHTHS, bpm: 72, name: 'Corcheas' },
        mode: 'timed',
        skills: ['rhythm'],
      }
    const pool: number[] = []
    for (let m = 48; m <= 79; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) pool.push(m)
    const midis = Array.from({ length: 10 }, () => pool[Math.floor(rng() * pool.length)])
    return { id: 'weak', kind: 'exercise', title: rec.title, reason: rec.reason, minutes: 4, spec: { type: 'notes', midis }, mode: 'wait', skills: ['note-names'] }
  }
  // sin datos suficientes: calentamiento técnico que rota por días
  const warmups: { title: string; spec: ExerciseSpec; skills: Skill[] }[] = [
    { title: 'Calentamiento: escala de Do mayor', spec: { type: 'scale', rootMidi: 60, scaleId: 'major', bpm: 63 }, skills: ['scales', 'fingering'] },
    { title: 'Calentamiento: escala de Sol mayor', spec: { type: 'scale', rootMidi: 67, scaleId: 'major', bpm: 63 }, skills: ['scales', 'fingering'] },
    { title: 'Calentamiento: arpegio de Do mayor', spec: { type: 'arpeggio', rootMidi: 60, typeId: 'maj', bpm: 66 }, skills: ['arpeggios'] },
    { title: 'Calentamiento: escala de La menor', spec: { type: 'scale', rootMidi: 69, scaleId: 'natural-minor', bpm: 63 }, skills: ['scales', 'fingering'] },
  ]
  const w = warmups[Math.floor(rng() * warmups.length)]
  const timed = attempts.filter((a) => a.mode === 'timed').length
  return {
    id: 'weak',
    kind: 'exercise',
    title: w.title,
    reason:
      timed < 2
        ? 'Aún no hay suficientes ejercicios con tempo para detectar un punto débil: empezamos con técnica.'
        : 'Tus últimos resultados no muestran un punto débil claro: mantenemos la técnica.',
    minutes: 3,
    spec: w.spec,
    mode: 'timed',
    skills: w.skills,
  }
}

function sectionStep(attempts: AttemptRecord[], compSongIds: string[], rng: () => number): DailyStep | null {
  const rec = recommendations(attempts).find((r) => r.target.kind === 'song-section')
  const parse = (refId: string) => {
    const m = /^(.*)-(beginner|intermediate|advanced)$/.exec(refId)
    return m ? { songId: m[1], level: m[2] as 'beginner' | 'intermediate' | 'advanced' } : null
  }
  if (rec && rec.target.kind === 'song-section') {
    const p = parse(rec.target.songId)
    if (p) return { id: 'section', kind: 'section', title: rec.title, reason: rec.reason, minutes: 4, ...p, sectionId: rec.target.sectionId }
  }
  // sin sección débil: la sección más floja de la última canción practicada
  const last = [...attempts].reverse().find((a) => a.kind === 'song' && a.sections?.length && parse(a.refId))
  if (last) {
    const s = [...last.sections!].sort((a, b) => a.accuracy - b.accuracy)[0]
    return {
      id: 'section',
      kind: 'section',
      title: `Pule "${s.name}" de ${last.title.split(' · ')[0]}`,
      reason: `Es la sección más floja de tu último intento (${Math.round(s.accuracy * 100)} %).`,
      minutes: 4,
      ...parse(last.refId)!,
      sectionId: s.id,
    }
  }
  if (!compSongIds.length) return null
  const songId = compSongIds[Math.floor(rng() * compSongIds.length)]
  return {
    id: 'section',
    kind: 'comp',
    title: 'Acompaña una canción con cifrados',
    reason: 'Aún no hay intentos de canciones: acompaña la melodía tocando solo el bajo de cada acorde.',
    minutes: 3,
    songId,
  }
}

function earStep(stats: Record<string, EarStat>): DailyStep {
  // tocar de oído: el ejercicio con peor precisión reciente; si no hay datos, la melodía
  const play: EarDrill[] = ['play-melody', 'play-chord']
  const scored = play.map((d) => ({ d, level: suggestedLevel(stats, d), acc: recentAccuracy(stats[earKey(d, suggestedLevel(stats, d))]) }))
  const known = scored.filter((x) => x.acc !== null).sort((a, b) => a.acc! - b.acc!)
  const pick = known[0] ?? scored[0]
  return {
    id: 'ear',
    kind: 'ear',
    title: `Oído: ${DRILL_INFO[pick.d].title.toLowerCase()}`,
    reason: pick.acc === null ? 'Sacar cosas de oído: empieza por frases cortas.' : `Precisión reciente ${Math.round(pick.acc * 100)} % en el nivel ${pick.level}.`,
    minutes: 3,
    drill: pick.d,
    level: pick.level,
    answers: 5,
  }
}

function newStep(attempts: AttemptRecord[], rng: () => number): DailyStep {
  const done = new Set(attempts.map((a) => a.refId))
  const fresh = PROGRESSIONS.filter((p) => ![...done].some((id) => id.startsWith(`progression-${p.id}-`)))
  const p = fresh[0] ?? PROGRESSIONS[Math.floor(rng() * PROGRESSIONS.length)]
  return {
    id: 'new',
    kind: 'progression',
    title: `Algo nuevo: ${p.name}`,
    reason: fresh.length ? `${p.style}. Aún no la has practicado: escúchala y tócala en modo guiado.` : 'Ya probaste todas las progresiones: hoy repasas una al azar.',
    minutes: 2,
    progressionId: p.id,
    tonic: p.defaultTonic,
  }
}

export function buildDailyPlan(input: PlanInput): DailyPlan {
  const date = input.date ?? localDate()
  const rng = seeded(date)
  const steps: DailyStep[] = [cardsStep(input.chordStats), weakStep(input.attempts, rng)]
  const sec = sectionStep(input.attempts, input.compSongIds, rng)
  if (sec) steps.push(sec)
  steps.push(earStep(input.earStats), newStep(input.attempts, rng))
  return { date, steps }
}

export function buildSpec(spec: ExerciseSpec): Arrangement {
  switch (spec.type) {
    case 'progression':
      return progressionExercise({ tonicMidi: spec.tonicMidi, degrees: spec.degrees, lhStyle: spec.lhStyle, rhChords: true, bpm: spec.bpm, repeat: 2, title: 'Cambios de acorde: I – V – vi – IV' })
    case 'rhythm':
      return rhythmExercise(spec.pattern, { bpm: spec.bpm, repeat: 2, title: `Ritmo: ${spec.name}` })
    case 'notes':
      return { ...findNotesExercise(spec.midis, 'Encuentra las notas'), id: `find-daily-${spec.midis.join('-')}` }
    case 'scale':
      return scaleExercise({ rootMidi: spec.rootMidi, scaleId: spec.scaleId, hand: 'R', octaves: 1, noteBeats: 1, bpm: spec.bpm })
    case 'arpeggio':
      return arpeggioExercise(spec.rootMidi, spec.typeId, 'R', 1, spec.bpm, 1)
  }
}

export function planProgress(plan: DailyPlan, results: Record<string, StepResult>) {
  const finished = plan.steps.filter((s) => results[s.id]).length
  return { finished, total: plan.steps.length, complete: finished === plan.steps.length }
}
