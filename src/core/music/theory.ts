import { PITCH_CLASSES_FLAT, PITCH_CLASSES_SHARP, pitchClass, type Accidental } from './notes'

// ───────────────────────── Intervalos ─────────────────────────

export interface IntervalInfo {
  semitones: number
  short: string
  name: string
}

export const INTERVALS: IntervalInfo[] = [
  { semitones: 0, short: 'P1', name: 'Unísono' },
  { semitones: 1, short: 'm2', name: 'Segunda menor (semitono)' },
  { semitones: 2, short: 'M2', name: 'Segunda mayor (tono)' },
  { semitones: 3, short: 'm3', name: 'Tercera menor' },
  { semitones: 4, short: 'M3', name: 'Tercera mayor' },
  { semitones: 5, short: 'P4', name: 'Cuarta justa' },
  { semitones: 6, short: 'TT', name: 'Tritono' },
  { semitones: 7, short: 'P5', name: 'Quinta justa' },
  { semitones: 8, short: 'm6', name: 'Sexta menor' },
  { semitones: 9, short: 'M6', name: 'Sexta mayor' },
  { semitones: 10, short: 'm7', name: 'Séptima menor' },
  { semitones: 11, short: 'M7', name: 'Séptima mayor' },
  { semitones: 12, short: 'P8', name: 'Octava' },
]

export function intervalName(semitones: number): string {
  const s = Math.abs(semitones)
  if (s <= 12) return INTERVALS[s].name
  const base = INTERVALS[s % 12]
  return `${base.name} + ${Math.floor(s / 12)} oct.`
}

// ───────────────────────── Acordes ─────────────────────────

export interface ChordType {
  id: string
  /** sufijo del cifrado: '' (mayor), 'm', '7', 'maj7'… */
  suffix: string
  name: string
  intervals: number[]
  level: 1 | 2 | 3 | 4 | 5
  /** alias aceptados al leer cifrados */
  aliases?: string[]
}

export const CHORD_TYPES: ChordType[] = [
  { id: 'maj', suffix: '', name: 'Mayor', intervals: [0, 4, 7], level: 2, aliases: ['M', 'maj'] },
  { id: 'min', suffix: 'm', name: 'Menor', intervals: [0, 3, 7], level: 2, aliases: ['min', '-'] },
  { id: 'dim', suffix: 'dim', name: 'Disminuido', intervals: [0, 3, 6], level: 3, aliases: ['°', 'o'] },
  { id: 'aug', suffix: 'aug', name: 'Aumentado', intervals: [0, 4, 8], level: 3, aliases: ['+'] },
  { id: 'sus2', suffix: 'sus2', name: 'Suspendido 2', intervals: [0, 2, 7], level: 3 },
  { id: 'sus4', suffix: 'sus4', name: 'Suspendido 4', intervals: [0, 5, 7], level: 3, aliases: ['sus'] },
  { id: '7', suffix: '7', name: 'Séptima de dominante', intervals: [0, 4, 7, 10], level: 3, aliases: ['dom7'] },
  { id: 'maj7', suffix: 'maj7', name: 'Séptima mayor', intervals: [0, 4, 7, 11], level: 3, aliases: ['M7', 'Δ', 'Δ7'] },
  { id: 'm7', suffix: 'm7', name: 'Menor séptima', intervals: [0, 3, 7, 10], level: 3, aliases: ['min7', '-7'] },
  { id: 'm7b5', suffix: 'm7b5', name: 'Semidisminuido', intervals: [0, 3, 6, 10], level: 4, aliases: ['ø', 'ø7'] },
  { id: 'dim7', suffix: 'dim7', name: 'Disminuido séptima', intervals: [0, 3, 6, 9], level: 4, aliases: ['°7', 'o7'] },
  { id: 'mMaj7', suffix: 'mMaj7', name: 'Menor con séptima mayor', intervals: [0, 3, 7, 11], level: 5, aliases: ['m(maj7)'] },
  { id: '6', suffix: '6', name: 'Sexta', intervals: [0, 4, 7, 9], level: 4 },
  { id: 'm6', suffix: 'm6', name: 'Menor sexta', intervals: [0, 3, 7, 9], level: 4 },
  { id: 'add9', suffix: 'add9', name: 'Añadida novena', intervals: [0, 4, 7, 14], level: 4 },
  { id: '9', suffix: '9', name: 'Novena de dominante', intervals: [0, 4, 7, 10, 14], level: 4 },
  { id: 'maj9', suffix: 'maj9', name: 'Novena mayor', intervals: [0, 4, 7, 11, 14], level: 5 },
  { id: 'm9', suffix: 'm9', name: 'Menor novena', intervals: [0, 3, 7, 10, 14], level: 5 },
  { id: '11', suffix: '11', name: 'Oncena', intervals: [0, 4, 7, 10, 14, 17], level: 5 },
  { id: '13', suffix: '13', name: 'Trecena', intervals: [0, 4, 7, 10, 14, 21], level: 5 },
]

export const CHORD_TYPE_BY_ID: Record<string, ChordType> = Object.fromEntries(CHORD_TYPES.map((c) => [c.id, c]))

export function rootName(pc: number, accidental: Accidental = 'sharp'): string {
  return (accidental === 'flat' ? PITCH_CLASSES_FLAT : PITCH_CLASSES_SHARP)[pitchClass(pc)]
}

/** Elige sostenidos o bemoles según la tónica (convención habitual). */
export function preferredAccidental(rootPc: number, minor = false): Accidental {
  const pc = pitchClass(rootPc)
  const flatMajors = new Set([5, 10, 3, 8, 1, 6]) // F Bb Eb Ab Db Gb
  const flatMinors = new Set([2, 7, 0, 5, 10, 3]) // Dm Gm Cm Fm Bbm Ebm
  return (minor ? flatMinors : flatMajors).has(pc) ? 'flat' : 'sharp'
}

export function chordSymbol(rootPc: number, typeId: string, accidental?: Accidental, bassPc?: number): string {
  const t = CHORD_TYPE_BY_ID[typeId]
  const acc = accidental ?? preferredAccidental(rootPc, typeId.startsWith('m') && typeId !== 'maj7' && typeId !== 'maj9')
  const base = rootName(rootPc, acc) + (t?.suffix ?? '')
  return bassPc !== undefined && pitchClass(bassPc) !== pitchClass(rootPc) ? `${base}/${rootName(bassPc, acc)}` : base
}

/**
 * Construye un acorde en posición cerrada.
 * @param rootMidi nota MIDI de la fundamental
 * @param inversion 0 = fundamental, 1 = primera inversión, …
 */
export function buildChord(rootMidi: number, typeId: string, inversion = 0): number[] {
  const t = CHORD_TYPE_BY_ID[typeId]
  if (!t) throw new Error(`Tipo de acorde desconocido: ${typeId}`)
  const notes = t.intervals.map((i) => rootMidi + i)
  const inv = ((inversion % notes.length) + notes.length) % notes.length
  for (let k = 0; k < inv; k++) {
    const low = notes.shift()!
    let up = low + 12
    while (up <= notes[notes.length - 1]) up += 12
    notes.push(up)
  }
  return notes.sort((a, b) => a - b)
}

export function inversionName(inv: number): string {
  return ['Estado fundamental', '1.ª inversión', '2.ª inversión', '3.ª inversión', '4.ª inversión', '5.ª inversión'][inv] ?? `${inv}.ª inversión`
}

export interface ParsedChord {
  rootPc: number
  typeId: string
  bassPc?: number
  symbol: string
}

const ROOT_RE = /^([A-G])([#b♯♭]?)/

/** Lee un cifrado americano ("Am7", "F#m7b5", "C/E", "Bbmaj7"). Devuelve null si no es válido. */
export function parseChordSymbol(symbol: string): ParsedChord | null {
  const s = symbol.trim().replace('♯', '#').replace('♭', 'b')
  const [main, bass] = s.split('/')
  const m = ROOT_RE.exec(main)
  if (!m) return null
  const letterPc: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const rootPc = pitchClass(letterPc[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0))
  const rest = main.slice(m[0].length)
  const type = CHORD_TYPES.find((t) => t.suffix === rest) ?? CHORD_TYPES.find((t) => t.aliases?.includes(rest))
  if (!type) return null
  let bassPc: number | undefined
  if (bass !== undefined) {
    const bm = ROOT_RE.exec(bass)
    if (!bm || bm[0].length !== bass.length) return null
    bassPc = pitchClass(letterPc[bm[1]] + (bm[2] === '#' ? 1 : bm[2] === 'b' ? -1 : 0))
  }
  return { rootPc, typeId: type.id, bassPc, symbol: s }
}

/** Clases de altura que forman un cifrado. */
export function chordPitchClasses(symbol: string): number[] | null {
  const p = parseChordSymbol(symbol)
  if (!p) return null
  const pcs = CHORD_TYPE_BY_ID[p.typeId].intervals.map((i) => pitchClass(p.rootPc + i))
  if (p.bassPc !== undefined && !pcs.includes(p.bassPc)) pcs.push(p.bassPc)
  return pcs
}

export interface DetectedChord {
  rootPc: number
  typeId: string
  symbol: string
  inversion: number
  bassPc: number
  /** 1 = coincidencia exacta de clases de altura */
  exact: boolean
}

/**
 * Detecta el acorde a partir de notas simultáneas (MIDI).
 * Prueba cada clase de altura presente como posible fundamental y busca un tipo
 * cuyas clases coincidan exactamente. Para acordes extendidos admite quinta omitida.
 */
export function detectChord(midiNotes: number[]): DetectedChord | null {
  if (midiNotes.length < 2) return null
  const sorted = [...new Set(midiNotes)].sort((a, b) => a - b)
  const bassPc = pitchClass(sorted[0])
  const pcs = [...new Set(sorted.map(pitchClass))]
  if (pcs.length < 2) return null
  const candidates: { root: number; type: ChordType; exact: boolean }[] = []
  for (const root of pcs) {
    const rel = new Set(pcs.map((p) => pitchClass(p - root)))
    for (const type of CHORD_TYPES) {
      const tset = new Set(type.intervals.map((i) => i % 12))
      const exact = rel.size === tset.size && [...rel].every((r) => tset.has(r))
      // Admite omitir la quinta (habitual en séptimas y extendidos)
      const noFifth = new Set([...tset].filter((x) => x !== 7))
      const withoutFifth = type.intervals.length >= 4 && rel.size === noFifth.size && [...rel].every((r) => noFifth.has(r))
      if (exact || withoutFifth) candidates.push({ root, type, exact })
    }
  }
  if (!candidates.length) return null
  // Preferencia: exacto > fundamental en el bajo > menos notas (más simple)
  candidates.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1
    const ab = a.root === bassPc ? 0 : 1
    const bb = b.root === bassPc ? 0 : 1
    if (ab !== bb) return ab - bb
    return a.type.intervals.length - b.type.intervals.length
  })
  const best = candidates[0]
  const relBass = pitchClass(bassPc - best.root)
  const order = best.type.intervals.map((i) => i % 12)
  const inversion = Math.max(0, order.indexOf(relBass))
  return {
    rootPc: best.root,
    typeId: best.type.id,
    symbol: chordSymbol(best.root, best.type.id, undefined, bassPc),
    inversion,
    bassPc,
    exact: best.exact,
  }
}

// ───────────────────────── Escalas ─────────────────────────

export interface ScaleType {
  id: string
  name: string
  intervals: number[]
  level: 1 | 2 | 3 | 4 | 5
  description: string
}

export const SCALE_TYPES: ScaleType[] = [
  { id: 'major', name: 'Mayor', intervals: [0, 2, 4, 5, 7, 9, 11], level: 2, description: 'Tono-tono-semitono-tono-tono-tono-semitono. Suena brillante y estable.' },
  { id: 'natural-minor', name: 'Menor natural', intervals: [0, 2, 3, 5, 7, 8, 10], level: 2, description: 'La relativa menor de la escala mayor. Sonido más oscuro y melancólico.' },
  { id: 'harmonic-minor', name: 'Menor armónica', intervals: [0, 2, 3, 5, 7, 8, 11], level: 3, description: 'Menor natural con la séptima elevada: crea una fuerte atracción hacia la tónica.' },
  { id: 'melodic-minor', name: 'Menor melódica', intervals: [0, 2, 3, 5, 7, 9, 11], level: 4, description: 'Sexta y séptima elevadas (forma ascendente, usada en jazz también al descender).' },
  { id: 'major-pentatonic', name: 'Pentatónica mayor', intervals: [0, 2, 4, 7, 9], level: 3, description: 'Cinco notas sin semitonos: ideal para improvisar sin "notas malas".' },
  { id: 'minor-pentatonic', name: 'Pentatónica menor', intervals: [0, 3, 5, 7, 10], level: 3, description: 'Base del rock, blues y pop.' },
  { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10], level: 4, description: 'Pentatónica menor + la "blue note" (quinta disminuida).' },
  { id: 'dorian', name: 'Dórico', intervals: [0, 2, 3, 5, 7, 9, 10], level: 4, description: 'Menor con la sexta mayor. Muy usado en jazz, funk y música modal.' },
  { id: 'phrygian', name: 'Frigio', intervals: [0, 1, 3, 5, 7, 8, 10], level: 5, description: 'Menor con segunda menor: sonido flamenco/español.' },
  { id: 'lydian', name: 'Lidio', intervals: [0, 2, 4, 6, 7, 9, 11], level: 5, description: 'Mayor con la cuarta aumentada: sonido etéreo, de película.' },
  { id: 'mixolydian', name: 'Mixolidio', intervals: [0, 2, 4, 5, 7, 9, 10], level: 4, description: 'Mayor con la séptima menor: rock, blues, funk.' },
  { id: 'locrian', name: 'Locrio', intervals: [0, 1, 3, 5, 6, 8, 10], level: 5, description: 'El modo más inestable: quinta disminuida.' },
  { id: 'chromatic', name: 'Cromática', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], level: 1, description: 'Las 12 notas, todas por semitono.' },
  { id: 'whole-tone', name: 'Tonos enteros', intervals: [0, 2, 4, 6, 8, 10], level: 5, description: 'Seis notas separadas por tono: sonido de sueño, ambiguo.' },
]

export const SCALE_BY_ID: Record<string, ScaleType> = Object.fromEntries(SCALE_TYPES.map((s) => [s.id, s]))

/** Notas MIDI de una escala ascendente desde rootMidi (incluye la octava final). */
export function buildScale(rootMidi: number, scaleId: string, octaves = 1): number[] {
  const s = SCALE_BY_ID[scaleId]
  if (!s) throw new Error(`Escala desconocida: ${scaleId}`)
  const out: number[] = []
  for (let o = 0; o < octaves; o++) for (const i of s.intervals) out.push(rootMidi + 12 * o + i)
  out.push(rootMidi + 12 * octaves)
  return out
}

/** Acordes diatónicos (tríadas o cuatriadas) de una tonalidad mayor o menor natural. */
export function diatonicChords(tonicPc: number, mode: 'major' | 'natural-minor', sevenths = false): { degree: string; rootPc: number; typeId: string; symbol: string }[] {
  const scale = SCALE_BY_ID[mode].intervals
  const romansMaj = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
  const romansMin = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
  const out = []
  for (let d = 0; d < 7; d++) {
    const r = scale[d]
    const third = (scale[(d + 2) % 7] - r + 12) % 12
    const fifth = (scale[(d + 4) % 7] - r + 12) % 12
    const seventh = (scale[(d + 6) % 7] - r + 12) % 12
    let typeId = third === 4 ? (fifth === 8 ? 'aug' : 'maj') : fifth === 6 ? 'dim' : 'min'
    if (sevenths) {
      if (typeId === 'maj') typeId = seventh === 11 ? 'maj7' : '7'
      else if (typeId === 'min') typeId = seventh === 10 ? 'm7' : 'mMaj7'
      else if (typeId === 'dim') typeId = seventh === 10 ? 'm7b5' : 'dim7'
    }
    const rootPc = pitchClass(tonicPc + r)
    out.push({ degree: (mode === 'major' ? romansMaj : romansMin)[d], rootPc, typeId, symbol: chordSymbol(rootPc, typeId, preferredAccidental(tonicPc, mode !== 'major')) })
  }
  return out
}

/** Progresiones habituales expresadas en grados de la escala mayor (índice 0–6). */
export const COMMON_PROGRESSIONS: { id: string; name: string; degrees: number[]; level: number; description: string }[] = [
  { id: 'I-IV-V-I', name: 'I – IV – V – I', degrees: [0, 3, 4, 0], level: 2, description: 'La cadencia más básica de la música occidental.' },
  { id: 'I-V-vi-IV', name: 'I – V – vi – IV', degrees: [0, 4, 5, 3], level: 2, description: 'La progresión "pop": cientos de canciones la usan.' },
  { id: 'vi-IV-I-V', name: 'vi – IV – I – V', degrees: [5, 3, 0, 4], level: 3, description: 'Variante melancólica de la progresión pop.' },
  { id: 'I-vi-IV-V', name: 'I – vi – IV – V', degrees: [0, 5, 3, 4], level: 3, description: 'La progresión de los años 50 ("doo-wop").' },
  { id: 'ii-V-I', name: 'ii – V – I', degrees: [1, 4, 0], level: 4, description: 'La base de la armonía de jazz.' },
  { id: 'I-vi-ii-V', name: 'I – vi – ii – V', degrees: [0, 5, 1, 4], level: 4, description: 'Turnaround clásico ("rhythm changes").' },
  { id: 'canon', name: 'Canon (Pachelbel)', degrees: [0, 4, 5, 2, 3, 0, 3, 4], level: 4, description: 'Progresión del Canon en Re de Pachelbel.' },
  { id: 'blues12', name: 'Blues de 12 compases', degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], level: 4, description: 'Forma básica del blues.' },
]

/** Voicing cercano (conducción de voces): elige la inversión de `target` más cercana a `prev`. */
export function nearestVoicing(prev: number[], rootPc: number, typeId: string, around = 60): number[] {
  const t = CHORD_TYPE_BY_ID[typeId]
  const center = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : around
  let best: number[] = []
  let bestCost = Infinity
  for (let oct = 2; oct <= 6; oct++) {
    const rootMidi = (oct + 1) * 12 + rootPc
    for (let inv = 0; inv < t.intervals.length; inv++) {
      const v = buildChord(rootMidi, typeId, inv)
      const cost = prev.length
        ? v.reduce((acc, n, i) => acc + Math.abs(n - (prev[Math.min(i, prev.length - 1)] ?? n)), 0)
        : Math.abs(v.reduce((a, b) => a + b, 0) / v.length - center)
      if (cost < bestCost) {
        bestCost = cost
        best = v
      }
    }
  }
  return best
}
