import { midiToName, pitchClass } from '../music/notes'
import { buildChord, buildScale, CHORD_TYPE_BY_ID, chordSymbol, diatonicChords, nearestVoicing, SCALE_BY_ID } from '../music/theory'
import type { Arrangement, ChordEvent, Difficulty, SongNote } from '../songs/schema'
import { leftHandFromChords, seq, type LeftHandStyle } from '../songs/notation'

/**
 * Generadores deterministas de ejercicios. Cada uno produce un `Arrangement` válido
 * (mismo formato que las canciones), así que se reproducen, visualizan y evalúan
 * con el mismo motor.
 */

export type Skill =
  | 'keyboard'
  | 'note-names'
  | 'black-keys'
  | 'octaves'
  | 'rhythm'
  | 'fingering'
  | 'left-hand'
  | 'two-hands'
  | 'scales'
  | 'intervals'
  | 'chords'
  | 'inversions'
  | 'sevenths'
  | 'progressions'
  | 'chord-changes'
  | 'arpeggios'
  | 'accompaniment'
  | 'syncopation'
  | 'melody'
  | 'modes'
  | 'extended-chords'
  | 'independence'
  | 'improvisation'
  | 'harmonization'
  | 'voice-leading'
  | 'repertoire'

export const SKILL_LABEL: Record<Skill, string> = {
  keyboard: 'Conocer el teclado',
  'note-names': 'Nombres de notas',
  'black-keys': 'Teclas negras',
  octaves: 'Octavas',
  rhythm: 'Ritmo y pulso',
  fingering: 'Digitación',
  'left-hand': 'Mano izquierda',
  'two-hands': 'Coordinación de manos',
  scales: 'Escalas',
  intervals: 'Intervalos',
  chords: 'Acordes',
  inversions: 'Inversiones',
  sevenths: 'Acordes de séptima',
  progressions: 'Progresiones',
  'chord-changes': 'Cambios de acorde',
  arpeggios: 'Arpegios',
  accompaniment: 'Acompañamiento',
  syncopation: 'Síncopa y subdivisión',
  melody: 'Melodía',
  modes: 'Modos',
  'extended-chords': 'Acordes extendidos',
  independence: 'Independencia de manos',
  improvisation: 'Improvisación',
  harmonization: 'Armonización',
  'voice-leading': 'Conducción de voces',
  repertoire: 'Repertorio',
}

export type ExerciseMode = 'wait' | 'timed' | 'improv'

export interface ExerciseDef {
  id: string
  title: string
  description?: string
  mode: ExerciseMode
  skills: Skill[]
  build: () => Arrangement
  hands?: 'both' | 'R' | 'L'
  evaluateDuration?: boolean
  evaluateDynamics?: boolean
  countInBars?: number
  /** para improvisación: escala "correcta" y progresión de fondo */
  improv?: { rootPc: number; scaleId: string; bars: number }
  /** referencia a una canción de la biblioteca en lugar de un generador */
  songRef?: { songId: string; difficulty: Difficulty }
}

function arr(id: string, title: string, notes: SongNote[], opts: Partial<Arrangement> = {}): Arrangement {
  const end = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0)
  const ts = opts.timeSignature ?? [4, 4]
  const bar = ts[0] * (4 / ts[1])
  const sections = opts.sections ?? [{ id: 'all', name: 'Ejercicio', start: 0, end: Math.max(bar, Math.ceil(end / bar - 1e-6) * bar) }]
  return {
    id,
    title,
    bpm: 72,
    timeSignature: ts,
    difficulty: 'beginner',
    arrangementType: 'exercise',
    confidence: 1,
    sources: [{ title: 'Ejercicio generado por la aplicación (algoritmo determinista)', kind: 'model-knowledge' }],
    limitations: [],
    adaptations: [],
    chords: [],
    ...opts,
    sections,
    notes: notes.sort((a, b) => a.start - b.start || a.midi - b.midi),
  }
}

// Digitación estándar para escalas mayores de una octava (mano derecha)
const RH_FINGERING_MAJOR: Record<number, number[]> = {
  0: [1, 2, 3, 1, 2, 3, 4, 5], // C
  7: [1, 2, 3, 1, 2, 3, 4, 5], // G
  2: [1, 2, 3, 1, 2, 3, 4, 5], // D
  9: [1, 2, 3, 1, 2, 3, 4, 5], // A
  4: [1, 2, 3, 1, 2, 3, 4, 5], // E
  5: [1, 2, 3, 4, 1, 2, 3, 4], // F
}
const LH_FINGERING_MAJOR: Record<number, number[]> = {
  0: [5, 4, 3, 2, 1, 3, 2, 1],
  7: [5, 4, 3, 2, 1, 3, 2, 1],
  2: [5, 4, 3, 2, 1, 3, 2, 1],
  9: [5, 4, 3, 2, 1, 3, 2, 1],
  5: [5, 4, 3, 2, 1, 3, 2, 1],
}

export interface ScaleExerciseOpts {
  rootMidi: number
  scaleId: string
  hand: 'L' | 'R'
  octaves?: number
  direction?: 'up' | 'down' | 'up-down'
  noteBeats?: number
  bpm?: number
}

export function scaleExercise(o: ScaleExerciseOpts): Arrangement {
  const { rootMidi, scaleId, hand, octaves = 1, direction = 'up-down', noteBeats = 1, bpm = 72 } = o
  const up = buildScale(rootMidi, scaleId, octaves)
  const seqNotes = direction === 'up' ? up : direction === 'down' ? [...up].reverse() : [...up, ...up.slice(0, -1).reverse()]
  const fingers = scaleId === 'major' && octaves === 1 ? (hand === 'R' ? RH_FINGERING_MAJOR : LH_FINGERING_MAJOR)[pitchClass(rootMidi)] : undefined
  const notes: SongNote[] = seqNotes.map((m, i) => {
    const idxUp = up.indexOf(m)
    return { midi: m, start: i * noteBeats, duration: noteBeats * 0.95, velocity: 80, hand, finger: fingers?.[idxUp] }
  })
  const name = `${midiToName(rootMidi, { withOctave: false })} ${SCALE_BY_ID[scaleId].name}`
  return arr(`scale-${rootMidi}-${scaleId}-${hand}-${octaves}`, `Escala de ${name} (${hand === 'R' ? 'derecha' : 'izquierda'})`, notes, { bpm, key: name })
}

export interface ChordSpec {
  rootMidi: number
  typeId: string
  inversion?: number
}

export function chordsExercise(chords: ChordSpec[], opts: { hand?: 'L' | 'R'; beatsEach?: number; style?: 'block' | 'arpeggio' | 'block-then-arpeggio'; bpm?: number; title?: string } = {}): Arrangement {
  const { hand = 'R', beatsEach = 4, style = 'block', bpm = 66 } = opts
  const notes: SongNote[] = []
  const chordEvents: ChordEvent[] = []
  let t = 0
  for (const c of chords) {
    const v = buildChord(c.rootMidi, c.typeId, c.inversion ?? 0)
    const sym = chordSymbol(pitchClass(c.rootMidi), c.typeId, undefined, c.inversion ? v[0] : undefined)
    if (style === 'block' || style === 'block-then-arpeggio') {
      v.forEach((m) => notes.push({ midi: m, start: t, duration: beatsEach * 0.95, velocity: 78, hand }))
      chordEvents.push({ start: t, duration: beatsEach, symbol: sym })
      t += beatsEach
    }
    if (style === 'arpeggio' || style === 'block-then-arpeggio') {
      const step = beatsEach / v.length >= 0.5 ? 1 : 0.5
      v.forEach((m, i) => notes.push({ midi: m, start: t + i * step, duration: step * 0.95, velocity: 78, hand }))
      chordEvents.push({ start: t, duration: v.length * step, symbol: sym })
      t += Math.max(beatsEach, Math.ceil(v.length * step))
    }
  }
  return arr(`chords-${chords.map((c) => `${c.rootMidi}${c.typeId}${c.inversion ?? 0}`).join('-')}-${style}`, opts.title ?? 'Acordes', notes, { bpm, chords: chordEvents })
}

export function progressionExercise(o: {
  tonicMidi: number
  degrees: number[]
  mode?: 'major' | 'natural-minor'
  sevenths?: boolean
  lhStyle?: LeftHandStyle | 'none'
  rhChords?: boolean
  beatsEach?: number
  bpm?: number
  repeat?: number
  title?: string
}): Arrangement {
  const { tonicMidi, degrees, mode = 'major', sevenths = false, lhStyle = 'root', rhChords = true, beatsEach = 4, bpm = 72, repeat = 1 } = o
  const dia = diatonicChords(pitchClass(tonicMidi), mode, sevenths)
  const chords: ChordEvent[] = []
  let t = 0
  for (let r = 0; r < repeat; r++)
    for (const d of degrees) {
      chords.push({ start: t, duration: beatsEach, symbol: dia[d].symbol })
      t += beatsEach
    }
  const notes: SongNote[] = []
  if (rhChords) {
    let prev: number[] = []
    for (const c of chords) {
      const d = dia.find((x) => x.symbol === c.symbol)!
      const v = nearestVoicing(prev, d.rootPc, d.typeId, 64).filter((n) => n >= 55 && n <= 79)
      prev = v
      v.forEach((m) => notes.push({ midi: m, start: c.start, duration: beatsEach * 0.95, velocity: 76, hand: 'R' }))
    }
  }
  if (lhStyle !== 'none') notes.push(...leftHandFromChords(chords, lhStyle))
  return arr(`prog-${tonicMidi}-${degrees.join('')}-${mode}-${sevenths}-${lhStyle}-${rhChords}`, o.title ?? 'Progresión', notes, { bpm, chords, key: `${midiToName(tonicMidi, { withOctave: false })} ${mode === 'major' ? 'major' : 'minor'}` })
}

/** Patrón rítmico sobre una sola nota (duraciones en negras; negativas = silencio). */
export function rhythmExercise(pattern: number[], o: { midi?: number; bpm?: number; title?: string; hand?: 'L' | 'R'; repeat?: number } = {}): Arrangement {
  const { midi = 60, bpm = 72, hand = 'R', repeat = 1 } = o
  const notes: SongNote[] = []
  let t = 0
  for (let r = 0; r < repeat; r++)
    for (const d of pattern) {
      if (d > 0) notes.push({ midi, start: t, duration: Math.max(0.1, d * 0.8), velocity: 85, hand })
      t += Math.abs(d)
    }
  return arr(`rhythm-${pattern.join('_')}-${midi}-${bpm}-${repeat}`, o.title ?? 'Ritmo', notes, { bpm })
}

/** Ejercicio sin tempo (modo espera): encontrar notas concretas en el teclado. */
export function findNotesExercise(midis: number[], title: string, hand: 'L' | 'R' = 'R'): Arrangement {
  return arr(`find-${midis.join('-')}`, title, midis.map((m, i) => ({ midi: m, start: i, duration: 0.9, velocity: 80, hand: m < 60 && hand === 'R' ? 'L' : hand })), { bpm: 60 })
}

/** Intervalos armónicos o melódicos desde una nota. */
export function intervalsExercise(rootMidi: number, semis: number[], harmonic = false, bpm = 60): Arrangement {
  const notes: SongNote[] = []
  let t = 0
  for (const s of semis) {
    if (harmonic) {
      notes.push({ midi: rootMidi, start: t, duration: 1.9, velocity: 80, hand: 'R' }, { midi: rootMidi + s, start: t, duration: 1.9, velocity: 80, hand: 'R' })
      t += 2
    } else {
      notes.push({ midi: rootMidi, start: t, duration: 0.95, velocity: 80, hand: 'R' }, { midi: rootMidi + s, start: t + 1, duration: 0.95, velocity: 80, hand: 'R' })
      t += 2
    }
  }
  return arr(`intervals-${rootMidi}-${semis.join('_')}-${harmonic}`, 'Intervalos', notes, { bpm })
}

/** Melodía en notación compacta, opcionalmente con mano izquierda. */
export function melodyExercise(id: string, title: string, rh: string, o: { lh?: string; bpm?: number; ts?: [number, number]; chords?: ChordEvent[] } = {}): Arrangement {
  const notes = [...seq(rh, 'R'), ...(o.lh ? seq(o.lh, 'L') : [])]
  return arr(id, title, notes, { bpm: o.bpm ?? 72, timeSignature: o.ts ?? [4, 4], chords: o.chords ?? [] })
}

/** Arpegio de varias octavas. */
export function arpeggioExercise(rootMidi: number, typeId: string, hand: 'L' | 'R', octaves = 1, bpm = 72, noteBeats = 0.5): Arrangement {
  const t = CHORD_TYPE_BY_ID[typeId].intervals.filter((i) => i < 12)
  const up: number[] = []
  for (let o = 0; o < octaves; o++) t.forEach((i) => up.push(rootMidi + 12 * o + i))
  up.push(rootMidi + 12 * octaves)
  const all = [...up, ...up.slice(0, -1).reverse()]
  const notes = all.map((m, i) => ({ midi: m, start: i * noteBeats, duration: noteBeats * 0.95, velocity: 80, hand }))
  return arr(`arp-${rootMidi}-${typeId}-${hand}-${octaves}`, `Arpegio de ${chordSymbol(pitchClass(rootMidi), typeId)}`, notes, { bpm })
}

/** Polirritmo / tresillos entre manos. */
export function polyrhythmExercise(rhDiv: number, lhDiv: number, bars = 4, bpm = 60): Arrangement {
  const notes: SongNote[] = []
  for (let b = 0; b < bars; b++) {
    for (let i = 0; i < rhDiv; i++) notes.push({ midi: 67, start: b * 4 + (i * 4) / rhDiv, duration: (4 / rhDiv) * 0.8, velocity: 80, hand: 'R' })
    for (let i = 0; i < lhDiv; i++) notes.push({ midi: 48, start: b * 4 + (i * 4) / lhDiv, duration: (4 / lhDiv) * 0.8, velocity: 72, hand: 'L' })
  }
  return arr(`poly-${rhDiv}-${lhDiv}-${bars}-${bpm}`, `Polirritmo ${rhDiv} contra ${lhDiv}`, notes, { bpm })
}

/** Base para improvisación: progresión en la mano izquierda (la toca la app). */
export function improvBacking(tonicMidi: number, degrees: number[], mode: 'major' | 'natural-minor', bars: number, bpm = 80): Arrangement {
  const rep = Math.ceil(bars / degrees.length)
  return progressionExercise({ tonicMidi, degrees, mode, lhStyle: 'broken', rhChords: false, beatsEach: 4, bpm, repeat: rep, title: 'Base de improvisación' })
}

/** Porcentaje de notas tocadas que pertenecen a la escala (evaluación de improvisación). */
export function inScaleRatio(played: number[], rootPc: number, scaleId: string): number {
  if (!played.length) return 0
  const pcs = new Set(SCALE_BY_ID[scaleId].intervals.map((i) => (rootPc + i) % 12))
  return played.filter((m) => pcs.has(pitchClass(m))).length / played.length
}
