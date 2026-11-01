import { z } from 'zod'
import { fitToRange } from './adapt'
import { chordSeq, seq } from './notation'
import type { Arrangement, ChordEvent, Difficulty, Section, SongNote } from './schema'
import { validateArrangement, type ValidationIssue } from './validate'

/**
 * Formato de ARCHIVO DE CANCIÓN (`canciones/<id>.json`).
 *
 * Lo escribe Claude Code (comando `/cancion`) o una persona a mano. La app lo carga,
 * lo convierte a un `Arrangement` y lo valida estrictamente: cada mano usa la notación
 * de texto de la app ("E4 D#4:0.5 C4+E4+G4:2 r:1") y cualquier token inválido es un
 * error; nunca se "interpreta" texto libre como música.
 */

export const SONG_FILE_FORMAT = 'piano-coach-song/1'

export const SongFileSectionSchema = z.object({
  name: z.string().min(1).describe('Nombre de la sección: Intro, Estrofa, Estribillo…'),
  bars: z.number().int().min(1).max(64).describe('Número de compases de la sección'),
  chords: z.string().describe('Acordes con duración en negras, p. ej. "C:4 G:4 Am:2 F:2". Debe sumar bars × longitud de compás.'),
  rightHand: z.string().describe('Mano derecha: "Nota[alteración]Octava[:duración]"; "r" = silencio; "+" une notas simultáneas; "|" opcional. Debe sumar la longitud de la sección.'),
  leftHand: z.string().describe('Mano izquierda, misma notación. Debe sumar la longitud de la sección.'),
})

export const SongFileSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().describe('URL de la fuente consultada, o cadena vacía si no hay'),
  kind: z.enum(['official', 'licensed', 'public-domain', 'reference-info', 'model-knowledge']),
  usedFor: z.string().describe('Qué dato se tomó de esta fuente (tonalidad, acordes, tempo…)'),
})

export const SongFileSchema = z.object({
  $schema: z.string().optional(),
  format: z.literal(SONG_FILE_FORMAT),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'id: solo minúsculas, números y guiones').describe('Identificador estable; igual al nombre del archivo sin .json'),
  title: z.string().min(1),
  artist: z.string(),
  request: z.string().optional().describe('La petición original del usuario (trazabilidad)'),
  createdAt: z.string().optional().describe('Fecha ISO de creación'),
  key: z.string().describe('Tonalidad, p. ej. "A major" o "F# minor"'),
  bpm: z.number().min(20).max(300).describe('Tempo en negras por minuto'),
  timeSignature: z.tuple([z.number().int().min(1).max(16), z.number().int()]).describe('[numerador, denominador], p. ej. [4,4]'),
  arrangementType: z
    .enum(['ai-generated', 'didactic-adaptation'])
    .describe('"didactic-adaptation" solo si se basa en una fuente musical real (dominio público, oficial o con licencia); si no, "ai-generated"'),
  isPublicDomain: z.boolean(),
  melodyIncluded: z.boolean().describe('true solo si la mano derecha reproduce la melodía real'),
  confidenceHarmony: z.number().min(0).max(1).describe('0–1: confianza en tonalidad y acordes según las fuentes'),
  confidenceMelody: z.number().min(0).max(1).describe('0–1: confianza en la melodía (0 si no se incluye)'),
  sources: z.array(SongFileSourceSchema),
  limitations: z.array(z.string()),
  adaptations: z.array(z.string()),
  recommendedStartLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  teachingNotes: z.string().describe('Consejos breves para aprender la pieza'),
  sections: z.array(SongFileSectionSchema).min(1),
})

export type SongFile = z.infer<typeof SongFileSchema>

export interface SongFileResult {
  /** nombre del archivo (o "archivo" si se importó sin nombre) */
  file: string
  ok: boolean
  arrangement?: Arrangement
  recommendedStartLevel?: Difficulty
  issues: ValidationIssue[]
}

/** Problemas que obligan a corregir el archivo (además de los errores). */
export const isBlocking = (i: ValidationIssue) => i.level === 'error' || i.code === 'timing'

const sumDur = (text: string) =>
  text
    .split(/\s+/)
    .filter((t) => t && t !== '|')
    .reduce((s, t) => s + (t.includes(':') ? Number(t.split(':')[1]) : 1), 0)

const VERIFIABLE = (s: SongFile['sources'][number]) => /^https?:\/\//.test(s.url) && s.kind !== 'model-knowledge'

/** Convierte y valida un archivo de canción ya analizado. Nunca lanza. */
export function songFileToArrangement(f: SongFile): { ok: boolean; arrangement?: Arrangement; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const ts: [number, number] = [f.timeSignature[0], [2, 4, 8, 16].includes(f.timeSignature[1]) ? f.timeSignature[1] : 4]
  if (ts[1] !== f.timeSignature[1]) issues.push({ level: 'error', code: 'schema', message: `Denominador de compás inválido: ${f.timeSignature[1]} (usa 2, 4, 8 o 16).` })
  const barLen = ts[0] * (4 / ts[1])
  const notes: SongNote[] = []
  const chords: ChordEvent[] = []
  const sections: Section[] = []
  let t = 0
  f.sections.forEach((s, i) => {
    const len = s.bars * barLen
    try {
      const rh = seq(s.rightHand || `r:${len}`, 'R', { start: t })
      const lh = seq(s.leftHand || `r:${len}`, 'L', { start: t, velocity: 68 })
      for (const [label, text] of [['derecha', s.rightHand], ['izquierda', s.leftHand]] as const) {
        const d = text ? sumDur(text) : len
        if (Math.abs(d - len) > 0.01) issues.push({ level: 'warning', code: 'timing', message: `Sección "${s.name}": la mano ${label} dura ${d} negras en lugar de ${len}.` })
      }
      notes.push(...rh.filter((n) => n.start < t + len - 1e-6), ...lh.filter((n) => n.start < t + len - 1e-6))
    } catch (e) {
      issues.push({ level: 'error', code: 'schema', message: `Sección "${s.name}": notación inválida (${(e as Error).message}).` })
    }
    try {
      chords.push(...chordSeq(s.chords, t).filter((c) => c.start < t + len - 1e-6))
      if (s.chords.trim() && Math.abs(sumDur(s.chords) - len) > 0.01) issues.push({ level: 'warning', code: 'timing', message: `Sección "${s.name}": los acordes suman ${sumDur(s.chords)} negras en lugar de ${len}.` })
    } catch (e) {
      issues.push({ level: 'error', code: 'invalid-chord', message: `Sección "${s.name}": ${(e as Error).message}.` })
    }
    sections.push({ id: `s${i + 1}`, name: s.name, start: t, end: t + len })
    t += len
  })

  // Tipo de arreglo: "adaptación didáctica" exige una fuente musical real citada con URL.
  let type = f.arrangementType
  if (type === 'didactic-adaptation' && !f.sources.some((s) => VERIFIABLE(s) && ['public-domain', 'official', 'licensed'].includes(s.kind))) {
    type = 'ai-generated'
    issues.push({ level: 'warning', code: 'schema', message: 'Se marcó como "adaptación didáctica" sin una fuente musical (dominio público, oficial o con licencia) con URL: se trata como arreglo generado por IA.' })
  }

  // Confianza: la menor de las dimensiones incluidas; sin fuentes verificables se limita.
  let confidence = f.melodyIncluded ? Math.min(f.confidenceHarmony, f.confidenceMelody) : f.confidenceHarmony
  const limitations = [...f.limitations]
  if (!f.sources.some(VERIFIABLE)) {
    confidence = Math.min(confidence, 0.35)
    limitations.unshift('Sin fuentes externas verificables: el arreglo se basa en el conocimiento del modelo y puede contener errores.')
  }
  if (!f.melodyIncluded) limitations.push('No incluye la melodía original: contiene acompañamiento y una guía melódica, o solo armonía.')
  limitations.push(
    type === 'ai-generated'
      ? 'Arreglo generado por IA (Claude Code): no es una transcripción oficial ni exacta de la grabación.'
      : 'Adaptación didáctica de la fuente citada: no es una transcripción oficial de una grabación concreta.',
  )

  const raw: Arrangement = {
    id: `cancion-${f.id}`,
    groupId: `cancion-${f.id}`,
    title: f.title,
    artist: f.artist || undefined,
    key: f.key,
    bpm: Math.round(f.bpm),
    timeSignature: ts,
    difficulty: 'advanced',
    arrangementType: type,
    confidence: Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100,
    sources: f.sources.map((s) => ({ title: s.title, url: /^https?:\/\//.test(s.url) ? s.url : undefined, kind: s.kind, usedFor: s.usedFor })),
    limitations,
    adaptations: f.adaptations,
    sections,
    chords,
    notes,
    createdAt: f.createdAt ? Date.parse(f.createdAt) || undefined : undefined,
    description: f.teachingNotes,
  }
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi)
  if (!notes.length) issues.push({ level: 'error', code: 'empty', message: 'El archivo no contiene notas.' })
  const fitted = fitToRange(raw)
  for (const c of fitted.changes) issues.push({ level: 'warning', code: 'out-of-range', message: c })
  fitted.arrangement.adaptations = [...fitted.arrangement.adaptations, ...fitted.changes]
  const v = validateArrangement(fitted.arrangement)
  return { ok: v.ok && !issues.some((i) => i.level === 'error'), arrangement: v.arrangement ?? fitted.arrangement, issues: [...issues, ...v.issues] }
}

/** Analiza el texto de un archivo de canción (JSON) y lo convierte. Nunca lanza. */
export function loadSongFile(text: string, file = 'archivo'): SongFileResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { file, ok: false, issues: [{ level: 'error', code: 'schema', message: `JSON inválido: ${(e as Error).message}` }] }
  }
  const parsed = SongFileSchema.safeParse(data)
  if (!parsed.success) {
    return {
      file,
      ok: false,
      issues: parsed.error.issues.slice(0, 12).map((i) => ({ level: 'error' as const, code: 'schema' as const, message: `${i.path.join('.') || '(raíz)'}: ${i.message}` })),
    }
  }
  const expectedName = `${parsed.data.id}.json`
  const r = songFileToArrangement(parsed.data)
  const issues = [...r.issues]
  if (file !== 'archivo' && file !== expectedName) issues.push({ level: 'warning', code: 'schema', message: `El archivo se llama "${file}" pero su id es "${parsed.data.id}" (se esperaba "${expectedName}").` })
  return { file, ok: r.ok, arrangement: r.arrangement, recommendedStartLevel: parsed.data.recommendedStartLevel, issues }
}
