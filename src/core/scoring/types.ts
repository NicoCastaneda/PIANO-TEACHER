import type { InputSource } from '../midi/types'

export type Hand = 'L' | 'R'

/** Nota esperada, con tiempos en segundos REALES (ya escalados por el tempo de práctica). */
export interface ExpectedNote {
  id: string
  midi: number
  start: number
  duration: number
  hand: Hand
  velocity?: number
  /** notas con el mismo chordId forman un acorde */
  chordId?: string
}

/** Nota interpretada reconstruida a partir de Note On / Note Off reales. */
export interface PlayedNote {
  id: string
  midi: number
  /** s, en el reloj de la canción (ya compensada la latencia) */
  start: number
  /** s; null si no se soltó antes de terminar */
  end: number | null
  velocity: number
  source: InputSource
}

export interface Tolerance {
  /** ventana máxima (±ms) para considerar que una nota se tocó "a tiempo" */
  hitWindowMs: number
  /** dentro de ±perfectWindowMs la precisión rítmica es 100 % */
  perfectWindowMs: number
  /** dispersión máxima (ms) entre notas de un acorde para considerarlo simultáneo */
  chordSpreadMs: number
  /** error relativo de duración tolerado (0.35 = ±35 %) */
  durationTolerance: number
  /** diferencia de velocidad MIDI tolerada (0–127) */
  velocityTolerance: number
}

export type DifficultyPreset = 'beginner' | 'intermediate' | 'advanced' | 'custom'

export interface ScoreWeights {
  notes: number
  timing: number
  duration: number
  dynamics: number
}

export interface EvaluationOptions {
  tolerance: Tolerance
  evaluateTiming: boolean
  evaluateDuration: boolean
  evaluateDynamics: boolean
  weights: ScoreWeights
  /** penalización por cada nota adicional, en "fracciones de nota esperada" */
  extraPenalty: number
  /** duración de un pulso (s) a tempo real: se usa para escalar la ventana */
  beatSeconds?: number
  /** secciones (s) para estadísticas por fragmento */
  sections?: { id: string; name: string; start: number; end: number }[]
}

export type NoteStatus = 'hit' | 'wrong' | 'octave' | 'missed'
export type TimingClass = 'early' | 'on-time' | 'late'
export type DurationClass = 'short' | 'ok' | 'long' | 'n/a'

export interface ExpectedOutcome {
  expected: ExpectedNote
  status: NoteStatus
  played?: PlayedNote
  /** played.start - expected.start, en ms (negativo = anticipado) */
  timingMs?: number
  timingClass?: TimingClass
  timingScore?: number
  durationClass?: DurationClass
  durationScore?: number
  /** duración tocada / esperada */
  durationRatio?: number
  dynamicsScore?: number
  /** ventana efectiva usada para esta nota (ms) */
  windowMs: number
}

export interface ChordOutcome {
  chordId: string
  start: number
  expectedMidis: number[]
  hitMidis: number[]
  missingMidis: number[]
  extraMidis: number[]
  complete: boolean
  /** máx - mín de inicio entre notas acertadas (ms) */
  spreadMs: number | null
  simultaneous: boolean
}

export interface SectionStat {
  id: string
  name: string
  expected: number
  hits: number
  accuracy: number
  meanAbsTimingMs: number | null
}

export interface EvaluationResult {
  score: number
  breakdown: {
    noteScore: number
    timingScore: number | null
    durationScore: number | null
    dynamicsScore: number | null
    weights: ScoreWeights
    formula: string
  }
  counts: {
    expected: number
    hits: number
    wrong: number
    octave: number
    missed: number
    extra: number
    early: number
    late: number
    onTime: number
    shortReleases: number
    longReleases: number
  }
  noteAccuracy: number
  timing: { meanOffsetMs: number | null; meanAbsOffsetMs: number | null; stdDevMs: number | null }
  chords: { total: number; complete: number; withExtras: number; incomplete: number; simultaneous: number; outcomes: ChordOutcome[] }
  bestStreak: number
  outcomes: ExpectedOutcome[]
  extras: PlayedNote[]
  sections: SectionStat[]
  durationSec: number
}
