import { pitchClass } from '../music/notes'
import { buildChord, CHORD_TYPE_BY_ID, chordSymbol, inversionName, preferredAccidental } from '../music/theory'
import type { Arrangement, ChordEvent, SongNote } from '../songs/schema'

/**
 * Progresiones para practicar inversiones. Cada acorde se define respecto a la tónica;
 * la mano derecha usa la inversión que menos movimiento exige desde el acorde anterior
 * (conducción de voces) y la izquierda toca el bajo (la fundamental, o la nota indicada
 * tras la barra en los acordes con barra, como G/B).
 *
 * Las progresiones de acordes son patrones genéricos de uso común; los ejemplos citados
 * son canciones muy conocidas que usan ese patrón (en su tonalidad original puede variar).
 */

export interface ProgChord {
  /** semitonos desde la tónica */
  semis: number
  typeId: string
  /** bajo distinto de la fundamental, en semitonos desde la tónica */
  bassSemis?: number
  /** grado en números romanos */
  roman: string
}

export interface ChordProgression {
  id: string
  name: string
  style: string
  description: string
  examples?: string[]
  mode: 'major' | 'minor'
  /** tónica por defecto (clase de altura) */
  defaultTonic: number
  beatsEach: number
  bpm: number
  chords: ProgChord[]
}

const p = (semis: number, typeId: string, roman: string, bassSemis?: number): ProgChord => ({ semis, typeId, roman, bassSemis })

export const PROGRESSIONS: ChordProgression[] = [
  {
    id: 'pop-axis',
    name: 'I – V – vi – IV',
    style: 'Pop',
    description: 'La progresión más usada del pop actual. Con inversiones la mano derecha casi no se mueve: C, G/B (1.ª), Am (1.ª) y F (2.ª) comparten notas.',
    examples: ['Let It Be (The Beatles)'],
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 72,
    chords: [p(0, 'maj', 'I'), p(7, 'maj', 'V'), p(9, 'min', 'vi'), p(5, 'maj', 'IV')],
  },
  {
    id: 'pop-sad',
    name: 'vi – IV – I – V',
    style: 'Pop melancólico / baladas',
    description: 'Los mismos acordes que la anterior empezando por el menor: suena más nostálgica.',
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 70,
    chords: [p(9, 'min', 'vi'), p(5, 'maj', 'IV'), p(0, 'maj', 'I'), p(7, 'maj', 'V')],
  },
  {
    id: 'doo-wop',
    name: 'I – vi – IV – V',
    style: 'Años 50 / doo-wop',
    description: 'La progresión de las baladas de los 50 y 60. Practica pasar de C a Am moviendo una sola nota.',
    examples: ['Stand By Me (Ben E. King)'],
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 76,
    chords: [p(0, 'maj', 'I'), p(9, 'min', 'vi'), p(5, 'maj', 'IV'), p(7, 'maj', 'V')],
  },
  {
    id: 'descending-bass',
    name: 'I – V/7 – vi – I/5 – IV – I/3 – ii – V',
    style: 'Bajo descendente (balada, barroco)',
    description: 'Acordes con barra: la izquierda baja nota a nota (Do–Si–La–Sol–Fa–Mi–Re–Sol) mientras la derecha cambia de inversión. Es el mismo recurso del Canon de Pachelbel.',
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 66,
    chords: [p(0, 'maj', 'I'), p(7, 'maj', 'V', 11), p(9, 'min', 'vi'), p(0, 'maj', 'I', 7), p(5, 'maj', 'IV'), p(0, 'maj', 'I', 4), p(2, 'min', 'ii'), p(7, 'maj', 'V')],
  },
  {
    id: 'canon',
    name: 'Canon: I – V – vi – iii – IV – I – IV – V',
    style: 'Barroco (Pachelbel, dominio público)',
    description: 'La progresión del Canon en Re de Pachelbel, reutilizada en muchísimas canciones. Aquí con bajo en fundamental para que la derecha practique inversiones.',
    examples: ['Canon en Re (J. Pachelbel)'],
    mode: 'major',
    defaultTonic: 2,
    beatsEach: 2,
    bpm: 66,
    chords: [p(0, 'maj', 'I'), p(7, 'maj', 'V'), p(9, 'min', 'vi'), p(4, 'min', 'iii'), p(5, 'maj', 'IV'), p(0, 'maj', 'I'), p(5, 'maj', 'IV'), p(7, 'maj', 'V')],
  },
  {
    id: 'andalusian',
    name: 'i – VII – VI – V',
    style: 'Flamenco / cadencia andaluza',
    description: 'Bajada por grados en menor que termina en un acorde MAYOR sobre la dominante (E en La menor). Sonido español.',
    examples: ['Hit the Road Jack (Ray Charles)'],
    mode: 'minor',
    defaultTonic: 9,
    beatsEach: 4,
    bpm: 80,
    chords: [p(0, 'min', 'i'), p(10, 'maj', 'VII'), p(8, 'maj', 'VI'), p(7, 'maj', 'V')],
  },
  {
    id: 'minor-epic',
    name: 'i – VI – III – VII',
    style: 'Rock / pop épico en menor',
    description: 'Progresión en menor muy usada en rock y bandas sonoras. Con inversiones, los cuatro acordes caben en la misma posición de la mano.',
    mode: 'minor',
    defaultTonic: 9,
    beatsEach: 4,
    bpm: 84,
    chords: [p(0, 'min', 'i'), p(8, 'maj', 'VI'), p(3, 'maj', 'III'), p(10, 'maj', 'VII')],
  },
  {
    id: 'rock-mixo',
    name: 'I – ♭VII – IV – I',
    style: 'Rock clásico',
    description: 'El ♭VII (Bb en Do) da el sabor "rockero" mixolidio. Fíjate en que Bb y F comparten la nota Fa.',
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 96,
    chords: [p(0, 'maj', 'I'), p(10, 'maj', '♭VII'), p(5, 'maj', 'IV'), p(0, 'maj', 'I')],
  },
  {
    id: 'blues12',
    name: 'Blues de 12 compases',
    style: 'Blues',
    description: 'La forma básica del blues con séptimas de dominante. Con inversiones, C7 → F7 se cambia moviendo solo dos dedos.',
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 84,
    chords: [p(0, '7', 'I7'), p(5, '7', 'IV7'), p(0, '7', 'I7'), p(0, '7', 'I7'), p(5, '7', 'IV7'), p(5, '7', 'IV7'), p(0, '7', 'I7'), p(0, '7', 'I7'), p(7, '7', 'V7'), p(5, '7', 'IV7'), p(0, '7', 'I7'), p(7, '7', 'V7')],
  },
  {
    id: 'jazz-251',
    name: 'ii7 – V7 – Imaj7',
    style: 'Jazz',
    description: 'La cadencia básica del jazz. La conducción de voces clásica: la 7.ª de cada acorde baja un semitono hacia la 3.ª del siguiente.',
    examples: ['Autumn Leaves (estándar de jazz; la usa en toda la pieza)'],
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 80,
    chords: [p(2, 'm7', 'ii7'), p(7, '7', 'V7'), p(0, 'maj7', 'Imaj7'), p(0, 'maj7', 'Imaj7')],
  },
  {
    id: 'jazz-turnaround',
    name: 'Imaj7 – vi7 – ii7 – V7',
    style: 'Jazz / bossa',
    description: 'El "turnaround": vuelve siempre al principio. Ideal para encadenar cuatríadas invertidas.',
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 84,
    chords: [p(0, 'maj7', 'Imaj7'), p(9, 'm7', 'vi7'), p(2, 'm7', 'ii7'), p(7, '7', 'V7')],
  },
  {
    id: 'neo-soul',
    name: 'IVmaj7 – iii7 – ii7 – Imaj7',
    style: 'Soul / neo-soul / R&B',
    description: 'Cuatríadas que bajan por grados: suaves y "cálidas". Practica mantener la mano en la misma zona cambiando de inversión.',
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 72,
    chords: [p(5, 'maj7', 'IVmaj7'), p(4, 'm7', 'iii7'), p(2, 'm7', 'ii7'), p(0, 'maj7', 'Imaj7')],
  },
  {
    id: 'gospel-plagal',
    name: 'I – IV/1 – I – V/7',
    style: 'Gospel / himnos',
    description: 'El "amén" (IV → I) con la derecha fija en la nota tónica arriba. F/C y G/B son las inversiones que lo hacen suave.',
    mode: 'major',
    defaultTonic: 0,
    beatsEach: 4,
    bpm: 66,
    chords: [p(0, 'maj', 'I'), p(5, 'maj', 'IV', 0), p(0, 'maj', 'I'), p(7, 'maj', 'V', 11)],
  },
]

export const PROGRESSION_BY_ID: Record<string, ChordProgression> = Object.fromEntries(PROGRESSIONS.map((x) => [x.id, x]))

/**
 * Reparto de manos:
 * - bass-rh: izquierda = bajo, derecha = acordes con inversiones (acompañamiento pop/balada);
 * - lh-chords: izquierda = acordes con inversiones, derecha libre para la melodía;
 * - rh-chords: solo la derecha con los acordes (para aprender las formas).
 */
export type HandLayout = 'bass-rh' | 'lh-chords' | 'rh-chords'

export const LAYOUT_INFO: Record<HandLayout, { label: string; description: string }> = {
  'bass-rh': { label: 'Izq.: bajo · Der.: acordes', description: 'La forma típica de acompañar en pop y baladas (por ejemplo, si cantas). La derecha usa inversiones para no saltar.' },
  'lh-chords': { label: 'Izq.: acordes', description: 'La izquierda lleva los acordes con inversiones y deja la derecha libre para la melodía. Es la forma de tocar canciones con melodía.' },
  'rh-chords': { label: 'Der.: acordes', description: 'Solo los acordes con la derecha, sin bajo: para aprender las formas y los cambios.' },
}

export interface VoicedChord {
  symbol: string
  roman: string
  /** mano que toca el acorde */
  chordHand: 'L' | 'R'
  /** notas del acorde (MIDI, de grave a agudo) */
  notes: number[]
  /** inversión del acorde tocado (0 = fundamental) */
  inversion: number
  /** nota de bajo de la izquierda (solo en el reparto bass-rh) */
  bass?: number
}

const RANGE = { R: { low: 55, high: 81, start: 60 }, L: { low: 43, high: 65, start: 48 } } // R: G3–A5 · L: G2–F4

function candidates(rootPc: number, typeId: string, hand: 'L' | 'R'): { v: number[]; inv: number }[] {
  const n = CHORD_TYPE_BY_ID[typeId].intervals.length
  const r = RANGE[hand]
  const out: { v: number[]; inv: number }[] = []
  for (let oct = 1; oct <= 6; oct++)
    for (let inv = 0; inv < n; inv++) {
      const v = buildChord((oct + 1) * 12 + rootPc, typeId, inv)
      if (v[0] >= r.low && v[v.length - 1] <= r.high) out.push({ v, inv })
    }
  return out
}

/** Movimiento total entre dos disposiciones (alineadas de grave a agudo). */
function movement(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs((a[Math.min(i, a.length - 1)] ?? 0) - (b[Math.min(i, b.length - 1)] ?? 0))
  return s
}

/** Disposición de cada acorde: el primero en fundamental; los demás, con el mínimo movimiento. */
export function voiceProgression(prog: ChordProgression, tonicPc = prog.defaultTonic, layout: HandLayout = 'bass-rh'): VoicedChord[] {
  const hand: 'L' | 'R' = layout === 'lh-chords' ? 'L' : 'R'
  const start = RANGE[hand].start
  const acc = preferredAccidental(tonicPc, prog.mode === 'minor')
  const out: VoicedChord[] = []
  let prev: number[] = []
  let prevBass = 48
  for (const ch of prog.chords) {
    const rootPc = pitchClass(tonicPc + ch.semis)
    const bassPc = pitchClass(tonicPc + (ch.bassSemis ?? ch.semis))
    let cands = candidates(rootPc, ch.typeId, hand)
    // sin mano de bajo, un acorde con barra (G/B) debe llevar esa nota abajo en el propio acorde
    if (layout !== 'bass-rh' && ch.bassSemis !== undefined) {
      const withBass = cands.filter((x) => pitchClass(x.v[0]) === bassPc)
      if (withBass.length) cands = withBass
    }
    let best = cands[0]
    if (!prev.length) {
      // primer acorde: fundamental, con la nota grave lo más cerca posible del punto de partida de la mano
      const roots = cands.filter((x) => x.inv === 0)
      best = roots.reduce((a, b) => (Math.abs(b.v[0] - start) < Math.abs(a.v[0] - start) ? b : a), roots[0] ?? cands[0])
    } else {
      for (const x of cands) if (movement(prev, x.v) < movement(prev, best.v)) best = x
    }
    prev = best.v
    // bajo: la octava más cercana al bajo anterior (las líneas descendentes no saltan)
    let bass = 36 + bassPc
    for (let x = 36 + bassPc; x <= 55; x += 12) if (Math.abs(x - prevBass) < Math.abs(bass - prevBass)) bass = x
    prevBass = bass
    out.push({
      symbol: chordSymbol(rootPc, ch.typeId, acc, ch.bassSemis !== undefined ? bassPc : undefined),
      roman: ch.roman,
      chordHand: hand,
      notes: best.v,
      inversion: best.inv,
      bass: layout === 'bass-rh' ? bass : undefined,
    })
  }
  return out
}

export function inversionLabel(v: VoicedChord): string {
  return inversionName(v.inversion)
}

/** Arreglo practicable (mismo formato que canciones y ejercicios). */
export function progressionArrangement(prog: ChordProgression, tonicPc = prog.defaultTonic, layout: HandLayout = 'bass-rh', repeat = 2): Arrangement {
  const voiced = voiceProgression(prog, tonicPc, layout)
  const notes: SongNote[] = []
  const chords: ChordEvent[] = []
  const b = prog.beatsEach
  let t = 0
  for (let r = 0; r < repeat; r++)
    for (const v of voiced) {
      v.notes.forEach((m) => notes.push({ midi: m, start: t, duration: b * 0.95, velocity: 76, hand: v.chordHand }))
      if (v.bass !== undefined) notes.push({ midi: v.bass, start: t, duration: b * 0.95, velocity: 70, hand: 'L' })
      chords.push({ start: t, duration: b, symbol: v.symbol })
      t += b
    }
  const len = voiced.length * b
  const accName = chordSymbol(tonicPc, prog.mode === 'minor' ? 'min' : 'maj')
  return {
    id: `progression-${prog.id}-${tonicPc}-${layout}`,
    title: `${prog.name} en ${accName}`,
    bpm: prog.bpm,
    timeSignature: [4, 4],
    difficulty: 'intermediate',
    arrangementType: 'exercise',
    confidence: 1,
    key: `${accName} ${prog.mode === 'minor' ? 'minor' : 'major'}`,
    sources: [{ title: 'Progresión genérica; disposición calculada por la aplicación (conducción de voces)', kind: 'model-knowledge' }],
    limitations: [],
    adaptations: [],
    sections: Array.from({ length: repeat }, (_, i) => ({ id: `r${i + 1}`, name: `Vuelta ${i + 1}`, start: i * len, end: (i + 1) * len })),
    chords,
    notes: notes.sort((x, y) => x.start - y.start || x.midi - y.midi),
    description: prog.description,
  }
}
