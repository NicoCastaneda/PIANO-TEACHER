import { CTS300_HIGHEST, CTS300_LOWEST, midiToName, pitchClass } from '../music/notes'
import { chordPitchClasses } from '../music/theory'
import { ArrangementSchema, songLengthBeats, type Arrangement } from './schema'

export interface ValidationIssue {
  level: 'error' | 'warning'
  code:
    | 'schema'
    | 'out-of-range'
    | 'invalid-duration'
    | 'unsorted'
    | 'invalid-chord'
    | 'chord-mismatch'
    | 'section'
    | 'overlap'
    | 'unplayable'
    | 'empty'
    | 'timing'
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
  /** arreglo normalizado (ordenado, solapamientos recortados) si el esquema es válido */
  arrangement?: Arrangement
}

export interface ValidateOptions {
  low?: number
  high?: number
  /** máximo de notas simultáneas por mano */
  maxPolyphonyPerHand?: number
  /** máxima extensión (semitonos) entre notas simultáneas de una mano */
  maxHandSpan?: number
}

/**
 * Valida un arreglo (estructura + coherencia musical + tocabilidad en el CT-S300).
 * Errores = no se puede reproducir/evaluar. Avisos = se puede usar pero conviene revisarlo.
 */
export function validateArrangement(input: unknown, opts: ValidateOptions = {}): ValidationResult {
  const { low = CTS300_LOWEST, high = CTS300_HIGHEST, maxPolyphonyPerHand = 5, maxHandSpan = 12 } = opts
  const parsed = ArrangementSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 20).map((i) => ({ level: 'error', code: 'schema', message: `${i.path.join('.') || '(raíz)'}: ${i.message}` })),
    }
  }
  const a = structuredClone(parsed.data)
  const issues: ValidationIssue[] = []

  if (!a.notes.length) issues.push({ level: 'error', code: 'empty', message: 'El arreglo no contiene notas.' })

  // Orden de eventos
  const isSorted = a.notes.every((n, i) => i === 0 || a.notes[i - 1].start <= n.start)
  if (!isSorted) {
    issues.push({ level: 'warning', code: 'unsorted', message: 'Las notas estaban desordenadas; se han ordenado por tiempo de inicio.' })
  }
  a.notes.sort((x, y) => x.start - y.start || x.midi - y.midi)
  a.chords.sort((x, y) => x.start - y.start)
  a.sections.sort((x, y) => x.start - y.start)

  // Rango del teclado
  const out = a.notes.filter((n) => n.midi < low || n.midi > high)
  if (out.length) {
    const names = [...new Set(out.map((n) => midiToName(n.midi)))].slice(0, 6).join(', ')
    issues.push({ level: 'error', code: 'out-of-range', message: `${out.length} nota(s) fuera del rango del teclado (${midiToName(low)}–${midiToName(high)}): ${names}.` })
  }

  // Duraciones (el esquema ya exige > 0; aquí detectamos duraciones absurdas)
  const len = songLengthBeats(a)
  const tooLong = a.notes.filter((n) => n.duration > 64)
  if (tooLong.length) issues.push({ level: 'warning', code: 'invalid-duration', message: `${tooLong.length} nota(s) duran más de 64 pulsos.` })
  const tiny = a.notes.filter((n) => n.duration < 0.05)
  if (tiny.length) issues.push({ level: 'error', code: 'invalid-duration', message: `${tiny.length} nota(s) con duración menor a 1/20 de pulso.` })

  // Solapamientos de la misma tecla (imposible físicamente): se recortan
  let overlaps = 0
  const lastByPitch = new Map<number, (typeof a.notes)[number]>()
  for (const n of a.notes) {
    const prev = lastByPitch.get(n.midi)
    if (prev && prev.start + prev.duration > n.start + 1e-6) {
      if (n.start - prev.start < 0.05) {
        // duplicado exacto: se elimina marcándolo con duración negativa
        prev.duration = Math.max(prev.duration, n.duration)
        n.duration = -1
      } else prev.duration = n.start - prev.start
      overlaps++
    }
    if (n.duration > 0) lastByPitch.set(n.midi, n)
  }
  if (overlaps) {
    a.notes = a.notes.filter((n) => n.duration > 0)
    issues.push({ level: 'warning', code: 'overlap', message: `${overlaps} solapamiento(s) de la misma tecla corregido(s).` })
  }

  // Secciones
  for (const s of a.sections) {
    if (s.end <= s.start) issues.push({ level: 'error', code: 'section', message: `La sección "${s.name}" termina antes de empezar.` })
  }
  for (let i = 1; i < a.sections.length; i++) {
    if (a.sections[i].start < a.sections[i - 1].end - 1e-6) issues.push({ level: 'warning', code: 'section', message: `Las secciones "${a.sections[i - 1].name}" y "${a.sections[i].name}" se solapan.` })
  }
  const lastSectionEnd = Math.max(...a.sections.map((s) => s.end))
  const notesAfter = a.notes.filter((n) => n.start >= lastSectionEnd).length
  if (notesAfter) issues.push({ level: 'warning', code: 'section', message: `${notesAfter} nota(s) quedan fuera de todas las secciones.` })
  const ids = new Set<string>()
  for (const s of a.sections) {
    if (ids.has(s.id)) issues.push({ level: 'error', code: 'section', message: `Identificador de sección duplicado: ${s.id}` })
    ids.add(s.id)
  }

  // Acordes: cifrado válido y coherencia con las notas que suenan
  for (const c of a.chords) {
    const pcs = chordPitchClasses(c.symbol)
    if (!pcs) {
      issues.push({ level: 'error', code: 'invalid-chord', message: `Cifrado de acorde no reconocido: "${c.symbol}".` })
      continue
    }
    const during = a.notes.filter((n) => n.start >= c.start - 1e-6 && n.start < c.start + c.duration - 1e-6 && n.hand === 'L')
    if (during.length >= 2) {
      const inChord = during.filter((n) => pcs.includes(pitchClass(n.midi))).length
      if (inChord / during.length < 0.5) {
        issues.push({ level: 'warning', code: 'chord-mismatch', message: `En el pulso ${c.start} el acompañamiento no coincide con el acorde ${c.symbol}.` })
      }
    }
  }
  if (a.chords.some((c) => c.start > len + 1e-6)) issues.push({ level: 'warning', code: 'timing', message: 'Hay acordes después del final de la música.' })

  // Tocabilidad por mano: polifonía y extensión simultáneas
  for (const hand of ['L', 'R'] as const) {
    const hn = a.notes.filter((n) => n.hand === hand)
    let worstPoly = 0
    let worstSpan = 0
    for (const n of hn) {
      const sounding = hn.filter((m) => Math.abs(m.start - n.start) < 0.03)
      worstPoly = Math.max(worstPoly, sounding.length)
      const span = Math.max(...sounding.map((m) => m.midi)) - Math.min(...sounding.map((m) => m.midi))
      worstSpan = Math.max(worstSpan, span)
    }
    const label = hand === 'L' ? 'izquierda' : 'derecha'
    if (worstPoly > maxPolyphonyPerHand) issues.push({ level: 'error', code: 'unplayable', message: `La mano ${label} tiene ${worstPoly} notas simultáneas (máx. ${maxPolyphonyPerHand}).` })
    if (worstSpan > maxHandSpan) issues.push({ level: 'warning', code: 'unplayable', message: `La mano ${label} abarca ${worstSpan} semitonos a la vez: puede ser imposible para una mano.` })
  }

  const ok = !issues.some((i) => i.level === 'error')
  return { ok, issues, arrangement: a }
}
