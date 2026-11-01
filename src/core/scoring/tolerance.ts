import type { DifficultyPreset, EvaluationOptions, ScoreWeights, Tolerance } from './types'

export const TOLERANCE_PRESETS: Record<Exclude<DifficultyPreset, 'custom'>, Tolerance> = {
  beginner: { hitWindowMs: 220, perfectWindowMs: 70, chordSpreadMs: 120, durationTolerance: 0.5, velocityTolerance: 30 },
  intermediate: { hitWindowMs: 150, perfectWindowMs: 45, chordSpreadMs: 80, durationTolerance: 0.35, velocityTolerance: 22 },
  advanced: { hitWindowMs: 100, perfectWindowMs: 28, chordSpreadMs: 50, durationTolerance: 0.25, velocityTolerance: 15 },
}

export const PRESET_LABEL: Record<DifficultyPreset, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
  custom: 'Personalizado',
}

export const DEFAULT_WEIGHTS: ScoreWeights = { notes: 0.6, timing: 0.3, duration: 0.1, dynamics: 0.1 }

/** Ritmo de referencia (120 BPM → 0,5 s por pulso) para escalar las ventanas. */
const REFERENCE_BEAT_S = 0.5

/**
 * Escala la ventana según el tempo real del ejercicio: a tempo lento la misma
 * fracción de pulso equivale a más milisegundos. Se limita a [0.75, 1.5] para
 * no volver la evaluación trivial ni imposible.
 */
export function tempoScale(beatSeconds?: number): number {
  if (!beatSeconds || !Number.isFinite(beatSeconds) || beatSeconds <= 0) return 1
  return Math.min(1.5, Math.max(0.75, beatSeconds / REFERENCE_BEAT_S))
}

export function resolveTolerance(preset: DifficultyPreset, custom?: Tolerance): Tolerance {
  if (preset === 'custom') return custom ?? TOLERANCE_PRESETS.intermediate
  return TOLERANCE_PRESETS[preset]
}

export function defaultEvaluationOptions(patch: Partial<EvaluationOptions> = {}): EvaluationOptions {
  return {
    tolerance: TOLERANCE_PRESETS.intermediate,
    evaluateTiming: true,
    evaluateDuration: false,
    evaluateDynamics: false,
    weights: DEFAULT_WEIGHTS,
    extraPenalty: 0.5,
    ...patch,
  }
}
