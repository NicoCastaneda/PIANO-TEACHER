import type { Arrangement, SongSource } from './schema'
import { chordSeq, leftHandFromChords, seq } from './notation'

/**
 * Canciones incorporadas. Solo obras de DOMINIO PÚBLICO (compositores fallecidos hace
 * más de 70 años o melodías tradicionales). La melodía es la tradicional conocida; la
 * armonización de la mano izquierda es un arreglo didáctico de la aplicación y así se
 * indica. Pueden existir variantes de la melodía según la edición.
 */

const pdSource = (title: string): SongSource => ({ title, kind: 'public-domain', usedFor: 'Melodía (obra de dominio público)' })
const appArrangement: SongSource = { title: 'Arreglo didáctico de Piano Coach (armonización y mano izquierda)', kind: 'model-knowledge', usedFor: 'Acompañamiento' }

function build(a: Omit<Arrangement, 'notes' | 'limitations' | 'adaptations' | 'difficulty'> & { rh: string; lh?: string; lhStyle?: Parameters<typeof leftHandFromChords>[1]; rhStart?: number }): Arrangement {
  const rhNotes = seq(a.rh, 'R', { start: a.rhStart ?? 0 })
  const lhNotes = a.lh ? seq(a.lh, 'L', { defaultDur: 0.25, velocity: 64 }) : leftHandFromChords(a.chords, a.lhStyle ?? 'block')
  const { rh: _rh, lh: _lh, lhStyle: _s, rhStart: _r, ...rest } = a
  return {
    ...rest,
    difficulty: 'advanced',
    notes: [...rhNotes, ...lhNotes].sort((x, y) => x.start - y.start || x.midi - y.midi),
    limitations: ['Melodía tradicional: puede diferir ligeramente de algunas ediciones.', 'La mano izquierda es un arreglo didáctico, no la partitura original.'],
    adaptations: [],
    groupId: rest.id,
  }
}

export const BUILTIN_SONGS: Arrangement[] = [
  build({
    id: 'twinkle',
    title: 'Estrellita (Twinkle Twinkle)',
    artist: 'Melodía tradicional francesa (s. XVIII)',
    key: 'C major',
    bpm: 90,
    timeSignature: [4, 4],
    arrangementType: 'didactic-adaptation',
    confidence: 0.95,
    sources: [pdSource('"Ah! vous dirai-je, maman" – canción tradicional francesa (1761), dominio público'), appArrangement],
    description: 'La primera canción ideal: solo teclas blancas, en posición de Do.',
    rh: 'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2',
    chords: chordSeq('C:2 C:2 F:2 C:2 F:2 C:2 G:2 C:2 C:2 F:2 C:2 G:2 C:2 F:2 C:2 G:2 C:2 C:2 F:2 C:2 F:2 C:2 G:2 C:2'),
    lhStyle: 'root',
    sections: [
      { id: 'a1', name: 'A', start: 0, end: 16 },
      { id: 'b', name: 'B', start: 16, end: 32 },
      { id: 'a2', name: 'A (repetición)', start: 32, end: 48 },
    ],
  }),
  build({
    id: 'ode-to-joy',
    title: 'Oda a la alegría',
    artist: 'Ludwig van Beethoven (1824)',
    key: 'C major',
    bpm: 100,
    timeSignature: [4, 4],
    arrangementType: 'didactic-adaptation',
    confidence: 0.95,
    sources: [pdSource('L. van Beethoven – Sinfonía n.º 9, op. 125, IV mov. (1824), dominio público'), appArrangement],
    description: 'Melodía por grados conjuntos con cinco dedos: perfecta para la posición fija.',
    rh: 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2 | D4 D4 E4 C4 | D4 E4:0.5 F4:0.5 E4 C4 | D4 E4:0.5 F4:0.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2',
    chords: chordSeq('C G C G | C G C G:2 C:2 | G C G G | C G C G:2 C:2'),
    lhStyle: 'block',
    sections: [
      { id: 'f1', name: 'Frase 1', start: 0, end: 16 },
      { id: 'f2', name: 'Frase 2', start: 16, end: 32 },
      { id: 'p', name: 'Puente', start: 32, end: 48 },
      { id: 'f3', name: 'Final', start: 48, end: 64 },
    ],
  }),
  build({
    id: 'jingle-bells',
    title: 'Jingle Bells (estribillo)',
    artist: 'James Lord Pierpont (1857)',
    key: 'C major',
    bpm: 112,
    timeSignature: [4, 4],
    arrangementType: 'didactic-adaptation',
    confidence: 0.9,
    sources: [pdSource('J. L. Pierpont – "One Horse Open Sleigh" (1857), dominio público'), appArrangement],
    description: 'Notas repetidas y un salto de quinta: entrena el ritmo y las repeticiones.',
    rh: 'E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:0.5 | E4:4 | F4 F4 F4:1.5 F4:0.5 | F4 E4 E4 E4:0.5 E4:0.5 | E4 D4 D4 E4 | D4:2 G4:2 | E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:0.5 | E4:4 | F4 F4 F4 F4 | F4 E4 E4 E4:0.5 E4:0.5 | G4 G4 F4 D4 | C4:4',
    chords: chordSeq('C C C C | F C D7 G | C C C C | F C G7 C'),
    lhStyle: 'bass-chord',
    sections: [
      { id: 'a', name: 'Estribillo 1', start: 0, end: 32 },
      { id: 'b', name: 'Estribillo 2', start: 32, end: 64 },
    ],
  }),
  build({
    id: 'amazing-grace',
    title: 'Amazing Grace',
    artist: 'Himno tradicional (letra J. Newton, 1779)',
    key: 'C major',
    bpm: 84,
    timeSignature: [3, 4],
    arrangementType: 'didactic-adaptation',
    confidence: 0.85,
    sources: [pdSource('"Amazing Grace" – himno tradicional, melodía "New Britain" (1829), dominio público'), appArrangement],
    description: 'Compás de 3/4 y notas largas: trabaja la duración y el legato.',
    rh: 'G3 | C4:2 E4:0.5 C4:0.5 | E4:2 D4 | C4:2 A3 | G3:2 G3 | C4:2 E4:0.5 C4:0.5 | E4:2 D4 | G4:2 E4 | G4:2 E4:0.5 C4:0.5 | E4:2 D4 | C4:2 A3 | G3:2 G3 | C4:2 E4:0.5 C4:0.5 | E4:2 D4 | C4:3',
    chords: chordSeq('C:3 C:3 F:3 C:3 C:3 G:3 G:3 C:3 C:3 F:3 C:3 C:3 G:3 C:3', 1),
    lhStyle: 'bass-chord',
    sections: [
      { id: 'a', name: 'Frase 1', start: 0, end: 22 },
      { id: 'b', name: 'Frase 2', start: 22, end: 43 },
    ],
  }),
  build({
    id: 'fur-elise',
    title: 'Para Elisa (tema inicial)',
    artist: 'Ludwig van Beethoven (1810)',
    key: 'A minor',
    bpm: 66,
    timeSignature: [3, 8],
    arrangementType: 'didactic-adaptation',
    confidence: 0.9,
    sources: [pdSource('L. van Beethoven – Bagatela WoO 59 "Für Elise" (c. 1810), dominio público')],
    description: 'Semitonos alternados (Mi–Re♯), arpegios repartidos entre las dos manos.',
    rh: 'E5:0.25 D#5:0.25 | E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25 | A4:0.5 r:0.25 C4:0.25 E4:0.25 A4:0.25 | B4:0.5 r:0.25 E4:0.25 G#4:0.25 B4:0.25 | C5:0.5 r:0.25 E4:0.25 E5:0.25 D#5:0.25 | E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25 | A4:0.5 r:0.25 C4:0.25 E4:0.25 A4:0.25 | B4:0.5 r:0.25 E4:0.25 C5:0.25 B4:0.25 | A4:1.5',
    lh: 'r:2 | A2 E3 A3 r:0.75 | E2 E3 G#3 r:0.75 | A2 E3 A3 r:0.75 | r:1.5 | A2 E3 A3 r:0.75 | E2 E3 G#3 r:0.75 | A2 E3 A3:1',
    chords: chordSeq('Am:1.5 E:1.5 Am:1.5 r:1.5 Am:1.5 E:1.5 Am:1.5', 2),
    sections: [
      { id: 'a1', name: 'Motivo 1', start: 0, end: 6.5 },
      { id: 'a2', name: 'Motivo 2', start: 6.5, end: 12.5 },
    ],
  }),
]

/** Copia la descripción de cuidado legal para mostrar en la UI. */
export const BUILTIN_NOTE =
  'Las canciones incluidas son obras de dominio público. La melodía es la tradicional; el acompañamiento es un arreglo didáctico de la aplicación.'
