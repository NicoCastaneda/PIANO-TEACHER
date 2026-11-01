import { judgeChord } from '../chords/trainer'
import { pitchClass } from '../music/notes'
import { buildChord, CHORD_TYPE_BY_ID, INTERVALS, SCALE_TYPES } from '../music/theory'

/**
 * ENTRENAMIENTO AUDITIVO
 *
 * Reconocer: la app toca algo y respondes con botones (calidad del acorde, inversión, intervalo).
 * Tocar de oído: la app toca un acorde o una melodía corta y la repites en el teclado;
 * se evalúa con los eventos MIDI reales (las respuestas con eventos simulados no se guardan).
 * Todo es determinista y reproducible con un generador aleatorio inyectable.
 */

export type Rng = () => number
export type EarDrill = 'quality' | 'inversion' | 'interval' | 'play-chord' | 'play-melody'
export type EarFamily = 'recognize' | 'play'

export interface EarLevel {
  level: number
  name: string
  description: string
}

export const DRILL_INFO: Record<EarDrill, { family: EarFamily; title: string; description: string; levels: EarLevel[] }> = {
  quality: {
    family: 'recognize',
    title: 'Mayor o menor',
    description: 'Suena un acorde: ¿qué carácter tiene?',
    levels: [
      { level: 1, name: 'Mayor / menor', description: 'Brillante frente a oscuro.' },
      { level: 2, name: '+ disminuido y aumentado', description: 'Añade los dos acordes «tensos».' },
      { level: 3, name: 'Séptimas', description: '7, maj7 y m7: los colores del pop, el soul y el jazz.' },
    ],
  },
  inversion: {
    family: 'recognize',
    title: '¿Qué inversión?',
    description: 'Suena un acorde: ¿qué nota está abajo?',
    levels: [
      { level: 1, name: 'Acordes mayores', description: 'Fundamental, 1.ª o 2.ª inversión.' },
      { level: 2, name: 'Mayores y menores', description: 'Las mismas inversiones con acordes de ambos tipos.' },
    ],
  },
  interval: {
    family: 'recognize',
    title: 'Intervalos',
    description: 'Suenan dos notas: ¿a qué distancia están?',
    levels: [
      { level: 1, name: 'Básicos', description: '2.ª mayor, 3.ª mayor, 5.ª justa y octava.' },
      { level: 2, name: 'Comunes', description: '+ 3.ª menor, 4.ª justa y 6.ª mayor.' },
      { level: 3, name: 'Todos', description: 'Del semitono a la octava.' },
    ],
  },
  'play-chord': {
    family: 'play',
    title: 'Toca el acorde que oyes',
    description: 'Escucha y búscalo en tu teclado (cualquier octava).',
    levels: [
      { level: 1, name: 'Mayor / menor', description: 'En estado fundamental. Te decimos la nota más grave.' },
      { level: 2, name: '+ inversiones', description: 'Te decimos la nota más grave; el resto, de oído.' },
      { level: 3, name: '+ disminuido, aumentado y 7', description: 'Sin pistas: la nota grave solo si la pides.' },
    ],
  },
  'play-melody': {
    family: 'play',
    title: 'Repite la melodía',
    description: 'Una frase corta: te damos la primera nota y sacas el resto de oído.',
    levels: [
      { level: 1, name: '3 notas por grados', description: 'Pentatónica, notas vecinas.' },
      { level: 2, name: '4 notas con saltos', description: 'Pentatónica, saltos pequeños.' },
      { level: 3, name: '5 notas', description: 'Escala mayor, saltos pequeños.' },
      { level: 4, name: '6 notas', description: 'Escala mayor, saltos más amplios, cualquier tonalidad.' },
    ],
  },
}

export const DRILLS = Object.keys(DRILL_INFO) as EarDrill[]

// ─────────────────────────── Preguntas ───────────────────────────

export interface EarOption {
  id: string
  label: string
  hint?: string
}

export interface RecognizeQuestion {
  drill: 'quality' | 'inversion' | 'interval'
  /** notas que suenan */
  notes: number[]
  /** cómo se reproducen */
  playback: 'block' | 'arpeggio' | 'melodic'
  options: EarOption[]
  answer: string
  /** acorde que suena (calidad / inversión), para poder comparar con las otras opciones */
  chord?: { rootPc: number; typeId: string }
}

const QUALITY_OPTION: Record<string, EarOption> = {
  maj: { id: 'maj', label: 'Mayor', hint: 'brillante, estable' },
  min: { id: 'min', label: 'Menor', hint: 'oscuro, melancólico' },
  dim: { id: 'dim', label: 'Disminuido', hint: 'tenso, inestable' },
  aug: { id: 'aug', label: 'Aumentado', hint: 'misterioso, «de suspense»' },
  '7': { id: '7', label: 'Séptima (7)', hint: 'pide resolver, bluesero' },
  maj7: { id: 'maj7', label: 'Séptima mayor (maj7)', hint: 'suave, soñador' },
  m7: { id: 'm7', label: 'Menor séptima (m7)', hint: 'menor relajado, soul' },
}
const QUALITY_TYPES: Record<number, string[]> = { 1: ['maj', 'min'], 2: ['maj', 'min', 'dim', 'aug'], 3: ['7', 'maj7', 'm7'] }
const INTERVAL_SET: Record<number, number[]> = { 1: [2, 4, 7, 12], 2: [2, 3, 4, 5, 7, 9, 12], 3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
export const INVERSION_OPTIONS: EarOption[] = [
  { id: '0', label: 'Fundamental', hint: 'la raíz abajo: suena «asentado»' },
  { id: '1', label: '1.ª inversión', hint: 'la 3.ª abajo: más ligero' },
  { id: '2', label: '2.ª inversión', hint: 'la 5.ª abajo: suena «en el aire»' },
]

const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length) % xs.length]

export function levelsOf(drill: EarDrill) {
  return DRILL_INFO[drill].levels.length
}

export function recognizeQuestion(drill: 'quality' | 'inversion' | 'interval', level: number, rng: Rng = Math.random): RecognizeQuestion {
  const rootPc = Math.floor(rng() * 12)
  if (drill === 'quality') {
    const types = QUALITY_TYPES[level] ?? QUALITY_TYPES[1]
    const typeId = pick(types, rng)
    const root = 48 + rootPc + (rootPc < 5 ? 12 : 0) // Fa3…Mi4
    return { drill, notes: buildChord(root, typeId, 0), playback: 'block', options: types.map((t) => QUALITY_OPTION[t]), answer: typeId, chord: { rootPc, typeId } }
  }
  if (drill === 'inversion') {
    const typeId = level >= 2 ? pick(['maj', 'min'], rng) : 'maj'
    const inversion = Math.floor(rng() * 3)
    // bajo siempre en la misma zona para que la altura no delate la inversión
    return { drill, notes: inversionVoicing(rootPc, typeId, inversion), playback: 'block', options: INVERSION_OPTIONS, answer: String(inversion), chord: { rootPc, typeId } }
  }
  const set = INTERVAL_SET[level] ?? INTERVAL_SET[1]
  const semis = pick(set, rng)
  const low = 53 + Math.floor(rng() * 10) // Fa3…Re4
  return { drill, notes: [low, low + semis], playback: 'melodic', options: set.map((s) => ({ id: String(s), label: INTERVALS[s].name })), answer: String(semis) }
}

/** Bajo siempre en la misma zona (Mi3–Mib4) para que la altura no delate la inversión. */
export function inversionVoicing(rootPc: number, typeId: string, inversion: number): number[] {
  let notes = buildChord(48 + rootPc, typeId, inversion)
  while (notes[0] < 52) notes = notes.map((n) => n + 12)
  while (notes[0] > 63) notes = notes.map((n) => n - 12)
  return notes
}

export interface PlayChordQuestion {
  drill: 'play-chord'
  rootPc: number
  typeId: string
  inversion: number
  notes: number[]
  /** se muestra la nota grave desde el principio */
  bassShown: boolean
}

export function playChordQuestion(level: number, rng: Rng = Math.random): PlayChordQuestion {
  const rootPc = Math.floor(rng() * 12)
  const typeId = level >= 3 ? pick(['maj', 'min', 'dim', 'aug', '7'], rng) : pick(['maj', 'min'], rng)
  const inversion = level >= 2 ? Math.floor(rng() * CHORD_TYPE_BY_ID[typeId].intervals.length) % 3 : 0
  let notes = buildChord(48 + rootPc, typeId, inversion)
  while (notes[0] < 53) notes = notes.map((n) => n + 12)
  while (notes[0] > 64) notes = notes.map((n) => n - 12)
  return { drill: 'play-chord', rootPc, typeId, inversion, notes, bassShown: level <= 2 }
}

/** El acorde tocado vale si tiene exactamente sus notas (cualquier octava) y la misma nota en el bajo. */
export function judgePlayedChord(played: number[], q: PlayChordQuestion) {
  const j = judgeChord(played, { rootPc: q.rootPc, typeId: q.typeId, inversion: q.inversion }, 'R')
  return { ...j, zoneHint: undefined }
}

export interface MelodyQuestion {
  drill: 'play-melody'
  notes: number[]
  tonicPc: number
  scaleId: string
  bpm: number
}

const MELODY_SPEC: Record<number, { length: number; scale: string; maxStep: number; tonics: number[] }> = {
  1: { length: 3, scale: 'major-pentatonic', maxStep: 1, tonics: [0, 7, 5] },
  2: { length: 4, scale: 'major-pentatonic', maxStep: 2, tonics: [0, 7, 5, 2] },
  3: { length: 5, scale: 'major', maxStep: 2, tonics: [0, 7, 5, 2, 9] },
  4: { length: 6, scale: 'major', maxStep: 4, tonics: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
}

/** Melodía corta dentro de una escala, empezando en la tónica o en la 5.ª, sin repetir nota seguida. */
export function melodyQuestion(level: number, rng: Rng = Math.random): MelodyQuestion {
  const spec = MELODY_SPEC[level] ?? MELODY_SPEC[1]
  const tonicPc = pick(spec.tonics, rng)
  const intervals = SCALE_TYPES.find((s) => s.id === spec.scale)!.intervals
  // escala en dos octavas desde la tónica cerca de Do4
  const base = 60 + tonicPc - (tonicPc > 6 ? 12 : 0)
  const ladder = [-1, 0, 1].flatMap((o) => intervals.map((i) => base + i + 12 * o)).filter((m) => m >= 52 && m <= 81)
  // empieza en la tónica o en la quinta (ambas están en las dos escalas usadas)
  let idx = ladder.indexOf(rng() < 0.6 ? base : base + 7)
  const notes = [ladder[idx]]
  while (notes.length < spec.length) {
    const step = 1 + Math.floor(rng() * spec.maxStep)
    const dir = rng() < 0.5 ? -1 : 1
    let next = idx + dir * step
    if (next < 0 || next >= ladder.length) next = idx - dir * step
    if (next < 0 || next >= ladder.length || next === idx) continue
    idx = next
    notes.push(ladder[idx])
  }
  return { drill: 'play-melody', notes, tonicPc, scaleId: spec.scale, bpm: 84 }
}

/**
 * Seguimiento de la melodía tocada, nota a nota (como el modo guiado): una nota correcta
 * avanza; una incorrecta se marca y se puede volver a intentar. Vale la misma nota en otra
 * octava (se avisa), porque lo que se entrena es el oído, no la posición.
 */
export interface MelodyProgress {
  index: number
  errors: number
  octaveShifts: number
  /** resultado por posición: null = aún no, true = a la primera, false = tras fallar */
  firstTry: (boolean | null)[]
  done: boolean
}

export const startMelody = (q: MelodyQuestion): MelodyProgress => ({ index: 0, errors: 0, octaveShifts: 0, firstTry: q.notes.map(() => null), done: false })

export function melodyStep(p: MelodyProgress, q: MelodyQuestion, midi: number): { progress: MelodyProgress; correct: boolean; octave: boolean } {
  if (p.done) return { progress: p, correct: false, octave: false }
  const target = q.notes[p.index]
  const correct = pitchClass(midi) === pitchClass(target)
  const octave = correct && midi !== target
  if (!correct) {
    const firstTry = [...p.firstTry]
    firstTry[p.index] = false
    return { progress: { ...p, errors: p.errors + 1, firstTry }, correct, octave }
  }
  const firstTry = [...p.firstTry]
  if (firstTry[p.index] === null) firstTry[p.index] = true
  const index = p.index + 1
  return { progress: { index, errors: p.errors, octaveShifts: p.octaveShifts + (octave ? 1 : 0), firstTry, done: index >= q.notes.length }, correct, octave }
}

// ─────────────────────────── Estadísticas ───────────────────────────

export interface EarStat {
  seen: number
  correct: number
  streak: number
  best: number
  /** últimos resultados (true = acierto a la primera), máx. 20 */
  recent: boolean[]
  lastAt: number
}

export const earKey = (drill: EarDrill, level: number) => `${drill}:${level}`
export const emptyEarStat = (): EarStat => ({ seen: 0, correct: 0, streak: 0, best: 0, recent: [], lastAt: 0 })

export function updateEarStat(prev: EarStat | undefined, correct: boolean, now = Date.now()): EarStat {
  const s = prev ?? emptyEarStat()
  const streak = correct ? s.streak + 1 : 0
  return { seen: s.seen + 1, correct: s.correct + (correct ? 1 : 0), streak, best: Math.max(s.best, streak), recent: [...s.recent, correct].slice(-20), lastAt: now }
}

export function recentAccuracy(s: EarStat | undefined): number | null {
  if (!s || s.recent.length < 5) return null
  return s.recent.filter(Boolean).length / s.recent.length
}

/** Se recomienda subir de nivel con ≥ 80 % en las últimas 10 respuestas o más. */
export function readyForNext(s: EarStat | undefined): boolean {
  return !!s && s.recent.length >= 10 && s.recent.slice(-10).filter(Boolean).length >= 8
}

/** Nivel sugerido para un ejercicio: el primero que aún no está dominado. */
export function suggestedLevel(stats: Record<string, EarStat>, drill: EarDrill): number {
  const n = levelsOf(drill)
  for (let l = 1; l <= n; l++) if (!readyForNext(stats[earKey(drill, l)])) return l
  return n
}
