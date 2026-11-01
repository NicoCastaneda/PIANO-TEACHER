import { z } from 'zod'

/**
 * Esquema estructurado de un arreglo musical.
 * Es el contrato tanto para canciones incorporadas, importadas desde MIDI y
 * generadas por IA. Nada se reproduce ni evalúa sin pasar por aquí.
 *
 * Unidad temporal: SIEMPRE negras (negra = 1, corchea = 0,5), también en compases
 * como 3/8. `bpm` se expresa en negras por minuto. Segundos = beats × 60 / bpm.
 */

export const HandSchema = z.enum(['L', 'R'])

export const SongNoteSchema = z.object({
  midi: z.number().int().min(0).max(127),
  start: z.number().min(0),
  duration: z.number().positive(),
  velocity: z.number().int().min(1).max(127).default(80),
  hand: HandSchema,
  finger: z.number().int().min(1).max(5).optional(),
})

export const ChordEventSchema = z.object({
  start: z.number().min(0),
  duration: z.number().positive(),
  symbol: z.string().min(1).max(16),
})

export const SectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  start: z.number().min(0),
  end: z.number().positive(),
})

export const ArrangementTypeSchema = z.enum([
  'authorized-transcription', // transcripción o arreglo de fuente autorizada
  'didactic-adaptation', // adaptación didáctica de una fuente musical (p. ej. dominio público)
  'ai-generated', // arreglo generado por IA a partir de información parcial
  'user-import', // archivo MIDI aportado por el usuario
  'exercise', // ejercicio generado por la aplicación
])

export const SourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  kind: z.enum(['official', 'licensed', 'public-domain', 'reference-info', 'user-file', 'model-knowledge']),
  /** qué información se tomó de esta fuente */
  usedFor: z.string().optional(),
})

export const DifficultySchema = z.enum(['beginner', 'intermediate', 'advanced'])

export const ArrangementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().optional(),
  /** tonalidad, p. ej. "C major", "A minor" */
  key: z.string().optional(),
  bpm: z.number().min(20).max(300),
  timeSignature: z.tuple([z.number().int().min(1).max(16), z.number().int().refine((d) => [2, 4, 8, 16].includes(d))]),
  difficulty: DifficultySchema,
  arrangementType: ArrangementTypeSchema,
  /** 0–1: grado de confianza respecto a la obra original */
  confidence: z.number().min(0).max(1),
  sources: z.array(SourceSchema),
  limitations: z.array(z.string()).default([]),
  adaptations: z.array(z.string()).default([]),
  sections: z.array(SectionSchema).min(1),
  chords: z.array(ChordEventSchema).default([]),
  notes: z.array(SongNoteSchema).min(1),
  /** agrupa las versiones de dificultad de una misma canción */
  groupId: z.string().optional(),
  createdAt: z.number().optional(),
  description: z.string().optional(),
})

export type SongNote = z.infer<typeof SongNoteSchema>
export type ChordEvent = z.infer<typeof ChordEventSchema>
export type Section = z.infer<typeof SectionSchema>
export type Arrangement = z.infer<typeof ArrangementSchema>
export type ArrangementType = z.infer<typeof ArrangementTypeSchema>
export type SongSource = z.infer<typeof SourceSchema>
export type Difficulty = z.infer<typeof DifficultySchema>

export const ARRANGEMENT_TYPE_LABEL: Record<ArrangementType, string> = {
  'authorized-transcription': 'Transcripción de fuente autorizada',
  'didactic-adaptation': 'Adaptación didáctica',
  'ai-generated': 'Arreglo generado por IA (no es transcripción oficial)',
  'user-import': 'Importado por el usuario',
  exercise: 'Ejercicio de la aplicación',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export function beatsToSeconds(beats: number, bpm: number) {
  return (beats * 60) / bpm
}

export function songLengthBeats(a: Pick<Arrangement, 'notes' | 'sections'>): number {
  const n = a.notes.reduce((m, x) => Math.max(m, x.start + x.duration), 0)
  const s = a.sections.reduce((m, x) => Math.max(m, x.end), 0)
  return Math.max(n, s)
}

/** Longitud de un compás en negras (3/8 → 1,5). */
export function beatsPerBar(ts: [number, number]) {
  return ts[0] * (4 / ts[1])
}

/** Distancia entre clics de metrónomo, en negras (la figura del denominador). */
export function clickInterval(ts: [number, number]) {
  return 4 / ts[1]
}
