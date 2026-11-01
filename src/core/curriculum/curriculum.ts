import { buildChord, buildScale } from '../music/theory'
import {
  arpeggioExercise,
  chordsExercise,
  findNotesExercise,
  improvBacking,
  intervalsExercise,
  melodyExercise,
  polyrhythmExercise,
  progressionExercise,
  rhythmExercise,
  scaleExercise,
  type ExerciseDef,
  type Skill,
} from '../practice/exercises'
import { chordSeq } from '../songs/notation'

/**
 * PROGRAMA DIDÁCTICO
 * Cada lección: objetivo → explicación breve → demostración visual/sonora →
 * ejercicio interactivo evaluado por MIDI → retroalimentación → criterio de avance.
 *
 * Avance: una lección se completa al alcanzar `passScore`. La siguiente se
 * desbloquea al completar la anterior, pero cualquier lección bloqueada puede
 * intentarse como "prueba de dominio": si se supera, cuenta como completada.
 */

export interface LessonDemo {
  label: string
  notes: number[]
  kind: 'chord' | 'arpeggio' | 'sequence'
  gapMs?: number
}

export interface Lesson {
  id: string
  level: 1 | 2 | 3 | 4 | 5
  title: string
  objective: string
  explanation: string[]
  tips?: string[]
  /** notas a resaltar en el teclado durante la explicación */
  highlight?: number[]
  demos: LessonDemo[]
  exercise: ExerciseDef
  passScore: number
  skills: Skill[]
}

export interface Level {
  id: 1 | 2 | 3 | 4 | 5
  name: string
  subtitle: string
  description: string
  lessons: Lesson[]
}

const C4 = 60
const range = (a: number, b: number, step = 12) => {
  const out = []
  for (let i = a; i <= b; i += step) out.push(i)
  return out
}

function lesson(l: Omit<Lesson, 'skills'> & { skills?: Skill[] }): Lesson {
  return { ...l, skills: l.skills ?? l.exercise.skills }
}

// ───────────────────────────── NIVEL 1 ─────────────────────────────
const level1: Lesson[] = [
  lesson({
    id: 'l1-keyboard',
    level: 1,
    title: 'Conoce tu teclado',
    objective: 'Orientarte en las 61 teclas del CT-S300 usando los grupos de teclas negras.',
    explanation: [
      'Tu teclado tiene 61 teclas: 36 blancas y 25 negras. Las negras aparecen en grupos de 2 y de 3 que se repiten.',
      'Justo a la izquierda de cada grupo de DOS teclas negras está la nota Do (C). Es tu punto de referencia para todo.',
      'El Do que queda más o menos en el centro del teclado es el "Do central" (C4).',
    ],
    tips: ['Mira el teclado de pantalla mientras tocas: la tecla que pulses en el Casio se iluminará.'],
    highlight: range(36, 96),
    demos: [{ label: 'Escuchar todos los Do', notes: range(36, 96), kind: 'arpeggio', gapMs: 350 }],
    exercise: { id: 'ex-l1-keyboard', title: 'Toca todos los Do de grave a agudo', mode: 'wait', skills: ['keyboard', 'octaves'], build: () => findNotesExercise(range(36, 96), 'Todos los Do') },
    passScore: 70,
  }),
  lesson({
    id: 'l1-white',
    level: 1,
    title: 'Las teclas blancas: Do Re Mi Fa Sol La Si',
    objective: 'Nombrar y encontrar las siete notas naturales.',
    explanation: [
      'Las teclas blancas se llaman Do, Re, Mi, Fa, Sol, La, Si (en inglés C, D, E, F, G, A, B) y se repiten en cada octava.',
      'Re (D) está entre las dos negras. Fa (F) está a la izquierda del grupo de tres negras.',
      'Entre Mi–Fa y Si–Do no hay tecla negra: son los "semitonos naturales".',
    ],
    highlight: buildScale(C4, 'major'),
    demos: [{ label: 'Escuchar Do–Si', notes: buildScale(C4, 'major'), kind: 'arpeggio', gapMs: 400 }],
    exercise: { id: 'ex-l1-white', title: 'Toca Do Re Mi Fa Sol La Si Do', mode: 'wait', skills: ['note-names'], build: () => findNotesExercise(buildScale(C4, 'major'), 'Notas naturales') },
    passScore: 75,
  }),
  lesson({
    id: 'l1-find',
    level: 1,
    title: 'Encuentra las notas salteadas',
    objective: 'Reconocer cualquier nota natural sin recorrer el teclado.',
    explanation: ['Ahora las notas aparecen desordenadas. Usa los grupos de negras como mapa: dos negras → Do-Re-Mi, tres negras → Fa-Sol-La-Si.'],
    demos: [],
    exercise: { id: 'ex-l1-find', title: 'Notas desordenadas', mode: 'wait', skills: ['note-names', 'keyboard'], build: () => findNotesExercise([64, 67, 62, 65, 69, 60, 71, 57, 53, 72], 'Notas salteadas') },
    passScore: 75,
  }),
  lesson({
    id: 'l1-black',
    level: 1,
    title: 'Teclas negras: sostenidos (♯) y bemoles (♭)',
    objective: 'Entender que cada tecla negra tiene dos nombres.',
    explanation: [
      'Una tecla negra está medio paso (un semitono) por encima de la blanca de su izquierda y medio paso por debajo de la de su derecha.',
      'Por eso la negra entre Do y Re puede llamarse Do♯ (Do sostenido) o Re♭ (Re bemol). Es la misma tecla.',
    ],
    highlight: [61, 63, 66, 68, 70],
    demos: [{ label: 'Escuchar las 5 negras', notes: [61, 63, 66, 68, 70], kind: 'arpeggio' }],
    exercise: { id: 'ex-l1-black', title: 'Do♯ Re♯ Fa♯ Sol♯ La♯', mode: 'wait', skills: ['black-keys'], build: () => findNotesExercise([61, 63, 66, 68, 70, 68, 66, 63, 61], 'Teclas negras') },
    passScore: 75,
  }),
  lesson({
    id: 'l1-octaves',
    level: 1,
    title: 'Octavas: la misma nota más grave o más aguda',
    objective: 'Reconocer la misma nota en distintas alturas.',
    explanation: [
      'Una octava es la distancia entre una nota y la siguiente con el mismo nombre: 12 teclas (blancas y negras) más arriba.',
      'Suenan "parecidas" porque la aguda vibra exactamente el doble de rápido. El número tras el nombre (La4, La5…) indica la octava.',
    ],
    highlight: range(45, 93),
    demos: [{ label: 'Escuchar todos los La', notes: range(45, 93), kind: 'arpeggio' }],
    exercise: { id: 'ex-l1-oct', title: 'Sol en todas las octavas', mode: 'wait', skills: ['octaves'], build: () => findNotesExercise(range(43, 91), 'Todos los Sol') },
    passScore: 75,
  }),
  lesson({
    id: 'l1-posture',
    level: 1,
    title: 'Postura y los cinco dedos',
    objective: 'Colocar la mano derecha en posición de Do y usar un dedo por tecla.',
    explanation: [
      'Siéntate a una altura en la que los antebrazos queden paralelos al suelo. Hombros relajados, muñeca a la altura de las teclas.',
      'Los dedos se numeran del 1 (pulgar) al 5 (meñique) en ambas manos. Curva los dedos como si sostuvieras una pelota.',
      'Posición de Do: pulgar (1) en Do4, y cada dedo en la siguiente blanca hasta el meñique (5) en Sol4.',
    ],
    highlight: [60, 62, 64, 65, 67],
    demos: [{ label: 'Do Re Mi Fa Sol', notes: [60, 62, 64, 65, 67, 65, 64, 62, 60], kind: 'arpeggio', gapMs: 450 }],
    exercise: { id: 'ex-l1-posture', title: 'Cinco dedos arriba y abajo (60 BPM)', mode: 'timed', skills: ['fingering'], build: () => {
        const a = melodyExercise('five-finger-r', 'Cinco dedos', 'C4 D4 E4 F4 G4 F4 E4 D4 C4:2', { bpm: 60 })
        a.notes = a.notes.map((n, i) => ({ ...n, finger: [1, 2, 3, 4, 5, 4, 3, 2, 1][i] }))
        return a
      } },
    passScore: 70,
  }),
  lesson({
    id: 'l1-pulse',
    level: 1,
    title: 'Pulso y ritmo',
    objective: 'Tocar exactamente con el metrónomo: negras, blancas y corcheas.',
    explanation: [
      'El pulso es el latido constante de la música. El metrónomo lo marca con un clic.',
      'Una negra dura un pulso, una blanca dos y una corchea medio pulso. Cuenta en voz alta "1, 2, 3, 4".',
      'Aquí la evaluación mide CUÁNDO pulsas la tecla: verás si te adelantas o te retrasas.',
    ],
    demos: [],
    exercise: { id: 'ex-l1-pulse', title: 'Negras, blancas y corcheas en Do', mode: 'timed', skills: ['rhythm'], countInBars: 1, build: () => rhythmExercise([1, 1, 1, 1, 2, 2, 1, 1, 0.5, 0.5, 0.5, 0.5, 2, -2], { bpm: 70, title: 'Pulso' }) },
    passScore: 65,
  }),
  lesson({
    id: 'l1-melody',
    level: 1,
    title: 'Tu primera melodía',
    objective: 'Tocar la primera frase de la "Oda a la alegría" en posición de Do.',
    explanation: ['Esta melodía usa solo los cinco dedos de la posición de Do. Mira las notas que caen y pulsa cuando lleguen a la línea.'],
    demos: [{ label: 'Escuchar la frase', notes: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62], kind: 'arpeggio', gapMs: 450 }],
    exercise: { id: 'ex-l1-melody', title: 'Oda a la alegría – frase 1', mode: 'timed', skills: ['melody'], build: () => melodyExercise('ode-phrase', 'Oda a la alegría (frase)', 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2', { bpm: 72 }) },
    passScore: 70,
  }),
  lesson({
    id: 'l1-left',
    level: 1,
    title: 'La mano izquierda',
    objective: 'Usar la mano izquierda en posición de Do (Do3–Sol3).',
    explanation: ['En la izquierda el meñique (5) va en Do3 y el pulgar (1) en Sol3. Al subir, empiezas por el meñique.'],
    highlight: [48, 50, 52, 53, 55],
    demos: [{ label: 'Do3 → Sol3', notes: [48, 50, 52, 53, 55, 53, 52, 50, 48], kind: 'arpeggio', gapMs: 450 }],
    exercise: { id: 'ex-l1-left', title: 'Cinco dedos con la izquierda', mode: 'timed', hands: 'L', skills: ['left-hand', 'fingering'], build: () => ({ ...melodyExercise('ff-l', 'Izquierda', '', { bpm: 60 }), notes: [48, 50, 52, 53, 55, 53, 52, 50, 48].map((m, i) => ({ midi: m, start: i, duration: i === 8 ? 1.9 : 0.95, velocity: 80, hand: 'L' as const, finger: [5, 4, 3, 2, 1, 2, 3, 4, 5][i] })) }) },
    passScore: 70,
  }),
  lesson({
    id: 'l1-hands',
    level: 1,
    title: 'Primeros pasos con ambas manos',
    objective: 'Alternar las manos y tocar notas simultáneas.',
    explanation: ['Primero las manos se turnan (pregunta y respuesta). Al final tocan juntas: Do3 y Do4 a la vez.'],
    demos: [],
    exercise: {
      id: 'ex-l1-hands',
      title: 'Pregunta y respuesta',
      mode: 'timed',
      skills: ['two-hands'],
      build: () => melodyExercise('hands-1', 'Pregunta y respuesta', 'C4 E4 G4:2 | r:4 | G4 E4 C4:2 | r:4 | C4:4', { lh: 'r:4 | C3 E3 G3:2 | r:4 | G3 E3 C3:2 | C3:4', bpm: 66 }),
    },
    passScore: 65,
  }),
]

// ───────────────────────────── NIVEL 2 ─────────────────────────────
const level2: Lesson[] = [
  lesson({
    id: 'l2-steps',
    level: 2,
    title: 'Tonos y semitonos',
    objective: 'Distinguir la distancia de medio tono (semitono) y de un tono.',
    explanation: [
      'Semitono = de una tecla a la inmediatamente vecina (blanca o negra). Tono = dos semitonos (saltando una tecla).',
      'Toda escala y todo acorde se construye contando tonos y semitonos. Es el "metro" de la música.',
    ],
    demos: [
      { label: 'Semitonos (cromática)', notes: buildScale(C4, 'chromatic'), kind: 'arpeggio', gapMs: 220 },
      { label: 'Tonos enteros', notes: buildScale(C4, 'whole-tone'), kind: 'arpeggio', gapMs: 300 },
    ],
    exercise: { id: 'ex-l2-steps', title: 'Escala cromática Do4–Do5', mode: 'wait', skills: ['intervals', 'black-keys'], build: () => findNotesExercise(buildScale(C4, 'chromatic'), 'Cromática') },
    passScore: 75,
  }),
  lesson({
    id: 'l2-cmajor',
    level: 2,
    title: 'Escala de Do mayor',
    objective: 'Tocar la escala de Do mayor con el paso del pulgar.',
    explanation: [
      'La escala mayor sigue el patrón T–T–S–T–T–T–S (T = tono, S = semitono). En Do mayor son todas las blancas.',
      'Digitación mano derecha: 1-2-3, pasa el pulgar por debajo, 1-2-3-4-5. Los números aparecen sobre las notas.',
    ],
    highlight: buildScale(C4, 'major'),
    demos: [{ label: 'Escuchar', notes: buildScale(C4, 'major'), kind: 'arpeggio', gapMs: 330 }],
    exercise: { id: 'ex-l2-cmajor', title: 'Do mayor, mano derecha', mode: 'timed', skills: ['scales', 'fingering'], build: () => scaleExercise({ rootMidi: C4, scaleId: 'major', hand: 'R', bpm: 72 }) },
    passScore: 70,
  }),
  lesson({
    id: 'l2-gf',
    level: 2,
    title: 'Sol mayor y Fa mayor',
    objective: 'Aplicar el patrón de la escala mayor en otras tonalidades.',
    explanation: ['Sol mayor necesita una negra: Fa♯. Fa mayor necesita Si♭. Siempre el mismo patrón de tonos y semitonos.', 'En Fa mayor el pulgar pasa después del dedo 4 (1-2-3-4-1-2-3-4).'],
    highlight: buildScale(67, 'major'),
    demos: [
      { label: 'Sol mayor', notes: buildScale(55, 'major'), kind: 'arpeggio', gapMs: 300 },
      { label: 'Fa mayor', notes: buildScale(53, 'major'), kind: 'arpeggio', gapMs: 300 },
    ],
    exercise: { id: 'ex-l2-g', title: 'Sol mayor, mano derecha', mode: 'timed', skills: ['scales'], build: () => scaleExercise({ rootMidi: 67, scaleId: 'major', hand: 'R', bpm: 72 }) },
    passScore: 70,
  }),
  lesson({
    id: 'l2-minor',
    level: 2,
    title: 'Escala menor natural',
    objective: 'Escuchar y tocar el color "triste" de la escala menor.',
    explanation: ['La menor natural sigue T–S–T–T–S–T–T. La menor (La–La) usa solo teclas blancas: es la "relativa" de Do mayor.'],
    highlight: buildScale(57, 'natural-minor'),
    demos: [{ label: 'La menor', notes: buildScale(57, 'natural-minor'), kind: 'arpeggio', gapMs: 330 }],
    exercise: { id: 'ex-l2-minor', title: 'La menor natural', mode: 'timed', skills: ['scales'], build: () => scaleExercise({ rootMidi: 57, scaleId: 'natural-minor', hand: 'R', bpm: 72 }) },
    passScore: 70,
  }),
  lesson({
    id: 'l2-intervals',
    level: 2,
    title: 'Intervalos',
    objective: 'Reconocer terceras, quintas y octavas en el teclado.',
    explanation: ['Un intervalo es la distancia entre dos notas. Tercera mayor = 4 semitonos, quinta justa = 7, octava = 12.', 'Las terceras son los ladrillos de los acordes.'],
    demos: [
      { label: 'Tercera mayor (Do–Mi)', notes: [60, 64], kind: 'chord' },
      { label: 'Quinta (Do–Sol)', notes: [60, 67], kind: 'chord' },
      { label: 'Octava (Do–Do)', notes: [60, 72], kind: 'chord' },
    ],
    exercise: { id: 'ex-l2-int', title: 'Intervalos armónicos desde Do', mode: 'wait', skills: ['intervals'], build: () => intervalsExercise(C4, [4, 3, 7, 5, 12], true) },
    passScore: 75,
  }),
  lesson({
    id: 'l2-triads',
    level: 2,
    title: 'Acordes mayores',
    objective: 'Construir tríadas mayores: fundamental + tercera mayor + quinta.',
    explanation: ['Un acorde mayor = fundamental, +4 semitonos, +3 semitonos. En la mano: dedos 1-3-5 sobre teclas alternas.', 'Do = Do-Mi-Sol, Fa = Fa-La-Do, Sol = Sol-Si-Re.'],
    highlight: buildChord(C4, 'maj'),
    demos: [
      { label: 'Do mayor', notes: buildChord(C4, 'maj'), kind: 'chord' },
      { label: 'Fa mayor', notes: buildChord(65, 'maj'), kind: 'chord' },
      { label: 'Sol mayor', notes: buildChord(67, 'maj'), kind: 'chord' },
    ],
    exercise: { id: 'ex-l2-triads', title: 'Do – Fa – Sol – Do', mode: 'wait', skills: ['chords'], build: () => chordsExercise([{ rootMidi: 60, typeId: 'maj' }, { rootMidi: 65, typeId: 'maj' }, { rootMidi: 67, typeId: 'maj' }, { rootMidi: 60, typeId: 'maj' }], { beatsEach: 2, title: 'Acordes mayores' }) },
    passScore: 75,
  }),
  lesson({
    id: 'l2-minor-chords',
    level: 2,
    title: 'Acordes menores',
    objective: 'Bajar la tercera medio tono para obtener un acorde menor.',
    explanation: ['Un acorde menor = fundamental, +3 semitonos, +4 semitonos. Solo cambia la nota del medio respecto al mayor.', 'Compara Do (Do-Mi-Sol) con Do menor (Do-Mi♭-Sol).'],
    demos: [
      { label: 'Do mayor', notes: buildChord(C4, 'maj'), kind: 'chord' },
      { label: 'Do menor', notes: buildChord(C4, 'min'), kind: 'chord' },
      { label: 'La menor', notes: buildChord(57, 'min'), kind: 'chord' },
    ],
    exercise: { id: 'ex-l2-minchords', title: 'Lam – Rem – Mim – Lam', mode: 'timed', skills: ['chords'], build: () => chordsExercise([{ rootMidi: 57, typeId: 'min' }, { rootMidi: 62, typeId: 'min' }, { rootMidi: 64, typeId: 'min' }, { rootMidi: 57, typeId: 'min' }], { beatsEach: 4, bpm: 60, title: 'Acordes menores' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l2-progression',
    level: 2,
    title: 'Primera progresión: I – IV – V – I',
    objective: 'Encadenar acordes a tempo con el bajo en la izquierda.',
    explanation: ['Los números romanos indican el grado de la escala: en Do mayor, I = Do, IV = Fa, V = Sol.', 'La derecha toca el acorde y la izquierda la fundamental. Prepara el siguiente acorde antes de que llegue.'],
    demos: [],
    exercise: { id: 'ex-l2-prog', title: 'I–IV–V–I en Do', mode: 'timed', skills: ['progressions', 'chord-changes', 'two-hands'], build: () => progressionExercise({ tonicMidi: C4, degrees: [0, 3, 4, 0], lhStyle: 'root', bpm: 66, title: 'I–IV–V–I' }) },
    passScore: 65,
  }),
  lesson({
    id: 'l2-arpeggios',
    level: 2,
    title: 'Arpegios',
    objective: 'Tocar las notas de un acorde una tras otra.',
    explanation: ['Un arpegio es un acorde "desgranado". Usa los dedos 1-2-3-5 para Do-Mi-Sol-Do.'],
    demos: [{ label: 'Arpegio de Do', notes: [60, 64, 67, 72, 67, 64, 60], kind: 'arpeggio', gapMs: 260 }],
    exercise: { id: 'ex-l2-arp', title: 'Arpegio de Do mayor', mode: 'timed', skills: ['arpeggios'], build: () => arpeggioExercise(C4, 'maj', 'R', 1, 72, 1) },
    passScore: 70,
  }),
  lesson({
    id: 'l2-accomp',
    level: 2,
    title: 'Melodía con acompañamiento',
    objective: 'Melodía con la derecha y bajo con la izquierda.',
    explanation: ['Usamos "Estrellita" en versión intermedia: la izquierda toca solo la nota fundamental de cada acorde.'],
    demos: [],
    exercise: { id: 'ex-l2-accomp', title: 'Estrellita (intermedio)', mode: 'timed', skills: ['accompaniment', 'two-hands'], songRef: { songId: 'twinkle', difficulty: 'intermediate' }, build: () => { throw new Error('songRef') } },
    passScore: 65,
  }),
]

// ───────────────────────────── NIVEL 3 ─────────────────────────────
const level3: Lesson[] = [
  lesson({
    id: 'l3-inversions',
    level: 3,
    title: 'Inversiones de acordes',
    objective: 'Tocar el mismo acorde con distinta nota en el bajo.',
    explanation: ['Invertir es mover la nota más grave una octava arriba. Do-Mi-Sol → Mi-Sol-Do (1.ª) → Sol-Do-Mi (2.ª).', 'Las inversiones permiten cambiar de acorde moviendo poco la mano.'],
    demos: [0, 1, 2].map((i) => ({ label: ['Fundamental', '1.ª inversión', '2.ª inversión'][i], notes: buildChord(C4, 'maj', i), kind: 'chord' as const })),
    exercise: { id: 'ex-l3-inv', title: 'Do mayor en tres posiciones', mode: 'timed', skills: ['inversions', 'chords'], build: () => chordsExercise([0, 1, 2, 1, 0].map((i) => ({ rootMidi: C4, typeId: 'maj', inversion: i })), { beatsEach: 2, bpm: 66, title: 'Inversiones de Do' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l3-voiceleading',
    level: 3,
    title: 'Cambios fluidos (conducción de voces)',
    objective: 'Encadenar acordes con la inversión más cercana.',
    explanation: ['En lugar de saltar con la mano, elige la inversión cuyas notas estén más cerca del acorde anterior. Muchas notas se repiten o se mueven un solo paso.'],
    demos: [],
    exercise: { id: 'ex-l3-vl', title: 'I–vi–IV–V con inversiones cercanas', mode: 'timed', skills: ['voice-leading', 'chord-changes'], build: () => progressionExercise({ tonicMidi: C4, degrees: [0, 5, 3, 4], lhStyle: 'root', bpm: 72, repeat: 2, title: 'I–vi–IV–V' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l3-sevenths',
    level: 3,
    title: 'Acordes de séptima',
    objective: 'Añadir la séptima a una tríada: maj7, 7 y m7.',
    explanation: ['Cmaj7 = Do-Mi-Sol-Si (séptima mayor, suave). C7 = Do-Mi-Sol-Si♭ (dominante, tensión). Cm7 = Do-Mi♭-Sol-Si♭.'],
    demos: [
      { label: 'Cmaj7', notes: buildChord(C4, 'maj7'), kind: 'chord' },
      { label: 'C7', notes: buildChord(C4, '7'), kind: 'chord' },
      { label: 'Cm7', notes: buildChord(C4, 'm7'), kind: 'chord' },
    ],
    exercise: { id: 'ex-l3-7', title: 'Cmaj7 – C7 – Cm7 – G7', mode: 'timed', skills: ['sevenths'], build: () => chordsExercise([{ rootMidi: 60, typeId: 'maj7' }, { rootMidi: 60, typeId: '7' }, { rootMidi: 60, typeId: 'm7' }, { rootMidi: 55, typeId: '7' }], { beatsEach: 4, bpm: 60, title: 'Séptimas' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l3-pop',
    level: 3,
    title: 'La progresión pop: I – V – vi – IV',
    objective: 'Dominar la progresión de cientos de canciones.',
    explanation: ['En Do: Do – Sol – Lam – Fa. Con las inversiones adecuadas la derecha casi no se mueve.'],
    demos: [],
    exercise: { id: 'ex-l3-pop', title: 'I–V–vi–IV en Do', mode: 'timed', skills: ['progressions', 'chord-changes'], build: () => progressionExercise({ tonicMidi: C4, degrees: [0, 4, 5, 3], lhStyle: 'root-fifth', bpm: 80, repeat: 2, title: 'Progresión pop' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l3-subdiv',
    level: 3,
    title: 'Subdivisiones',
    objective: 'Corcheas, semicorcheas y puntillo con precisión.',
    explanation: ['Subdividir es contar las partes del pulso: "1-y-2-y". La negra con puntillo dura pulso y medio.'],
    demos: [],
    exercise: { id: 'ex-l3-sub', title: 'Corcheas y puntillo', mode: 'timed', skills: ['rhythm'], build: () => rhythmExercise([0.5, 0.5, 0.5, 0.5, 1.5, 0.5, 1, 0.25, 0.25, 0.5, 1, 1], { bpm: 76, repeat: 2, title: 'Subdivisiones' }) },
    passScore: 65,
  }),
  lesson({
    id: 'l3-sync',
    level: 3,
    title: 'Síncopa',
    objective: 'Acentuar entre pulsos (a contratiempo).',
    explanation: ['La síncopa coloca la nota entre dos pulsos y la mantiene sobre el siguiente. Cuenta en voz alta y no aceleres.'],
    demos: [],
    exercise: { id: 'ex-l3-sync', title: 'Ritmo sincopado', mode: 'timed', skills: ['syncopation', 'rhythm'], build: () => rhythmExercise([0.5, 1, 0.5, 1, 1, -0.5, 1, 0.5, 1, 1], { bpm: 80, repeat: 2, midi: 67, title: 'Síncopa' }) },
    passScore: 60,
  }),
  lesson({
    id: 'l3-lh-patterns',
    level: 3,
    title: 'Patrones de mano izquierda: bajo y acorde',
    objective: 'Alternar bajo y acorde (estilo "um-pa").',
    explanation: ['La izquierda toca el bajo en el pulso 1 y el acorde en los pulsos 2, 3 y 4.'],
    demos: [],
    exercise: { id: 'ex-l3-lh', title: 'Bajo–acorde en I–IV–V–I', mode: 'timed', hands: 'L', skills: ['left-hand', 'accompaniment'], build: () => progressionExercise({ tonicMidi: C4, degrees: [0, 3, 4, 0], lhStyle: 'bass-chord', rhChords: false, bpm: 80, title: 'Bajo y acorde' }) },
    passScore: 65,
  }),
  lesson({
    id: 'l3-ode-full',
    level: 3,
    title: 'Melodía y acordes: Oda a la alegría',
    objective: 'Tocar una pieza completa con ambas manos.',
    explanation: ['La izquierda toca acordes en bloque mientras la derecha lleva la melodía. Practica por secciones si lo necesitas.'],
    demos: [],
    exercise: { id: 'ex-l3-ode', title: 'Oda a la alegría completa', mode: 'timed', skills: ['two-hands', 'repertoire'], songRef: { songId: 'ode-to-joy', difficulty: 'advanced' }, build: () => { throw new Error('songRef') } },
    passScore: 65,
  }),
  lesson({
    id: 'l3-tempo',
    level: 3,
    title: 'Control del tempo',
    objective: 'Mantener la escala estable en corcheas a más velocidad.',
    explanation: ['Sube el tempo solo cuando puedas tocar sin errores. La regularidad es más importante que la velocidad.'],
    demos: [],
    exercise: { id: 'ex-l3-tempo', title: 'Do mayor en corcheas (2 octavas)', mode: 'timed', skills: ['scales', 'rhythm'], build: () => scaleExercise({ rootMidi: C4, scaleId: 'major', hand: 'R', octaves: 2, noteBeats: 0.5, bpm: 80 }) },
    passScore: 65,
  }),
]

// ───────────────────────────── NIVEL 4 ─────────────────────────────
const level4: Lesson[] = [
  lesson({
    id: 'l4-functional',
    level: 4,
    title: 'Armonía funcional: tónica, subdominante, dominante',
    objective: 'Sentir el reposo (I), el alejamiento (IV) y la tensión (V7).',
    explanation: ['La dominante con séptima (V7) "pide" resolver en la tónica: el Si sube a Do y el Fa baja a Mi.'],
    demos: [{ label: 'G7 → C', notes: [...buildChord(55, '7', 1)], kind: 'chord' }],
    exercise: { id: 'ex-l4-func', title: 'I–IV–V7–I en Sol', mode: 'timed', skills: ['progressions', 'sevenths'], build: () => progressionExercise({ tonicMidi: 55, degrees: [0, 3, 4, 0], sevenths: false, lhStyle: 'root-fifth', bpm: 76, repeat: 2, title: 'Función tonal en Sol' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l4-relative',
    level: 4,
    title: 'Tonalidades relativas',
    objective: 'Relacionar Do mayor y La menor (mismas notas, otro centro).',
    explanation: ['Cada tonalidad mayor tiene una relativa menor tres semitonos por debajo. Comparten notas y acordes.'],
    demos: [],
    exercise: { id: 'ex-l4-rel', title: 'Lam – Fa – Do – Sol', mode: 'timed', skills: ['progressions', 'chord-changes'], build: () => progressionExercise({ tonicMidi: C4, degrees: [5, 3, 0, 4], lhStyle: 'root', bpm: 80, repeat: 2, title: 'vi–IV–I–V' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l4-251',
    level: 4,
    title: 'ii – V – I',
    objective: 'La cadencia básica del jazz con acordes de séptima.',
    explanation: ['En Do: Dm7 – G7 – Cmaj7. Con buena conducción de voces, solo cambian una o dos notas entre acordes.'],
    demos: [],
    exercise: { id: 'ex-l4-251', title: 'ii–V–I en Do', mode: 'timed', skills: ['sevenths', 'voice-leading'], build: () => progressionExercise({ tonicMidi: C4, degrees: [1, 4, 0, 0], sevenths: true, lhStyle: 'root', bpm: 72, repeat: 2, title: 'ii–V–I' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l4-minor-scales',
    level: 4,
    title: 'Menor armónica y melódica',
    objective: 'Tocar las variantes de la escala menor.',
    explanation: ['Armónica: séptima elevada (Sol♯ en La menor). Melódica: sexta y séptima elevadas (Fa♯ y Sol♯).'],
    demos: [
      { label: 'La menor armónica', notes: buildScale(57, 'harmonic-minor'), kind: 'arpeggio', gapMs: 260 },
      { label: 'La menor melódica', notes: buildScale(57, 'melodic-minor'), kind: 'arpeggio', gapMs: 260 },
    ],
    exercise: { id: 'ex-l4-hm', title: 'La menor armónica', mode: 'timed', skills: ['scales'], build: () => scaleExercise({ rootMidi: 57, scaleId: 'harmonic-minor', hand: 'R', noteBeats: 0.5, bpm: 76 }) },
    passScore: 70,
  }),
  lesson({
    id: 'l4-modes',
    level: 4,
    title: 'Modos: dórico y mixolidio',
    objective: 'Conocer dos modos muy usados en pop, rock y jazz.',
    explanation: ['Dórico: menor con sexta mayor (Re dórico = blancas desde Re). Mixolidio: mayor con séptima menor (Sol mixolidio = blancas desde Sol).'],
    demos: [
      { label: 'Re dórico', notes: buildScale(62, 'dorian'), kind: 'arpeggio', gapMs: 260 },
      { label: 'Sol mixolidio', notes: buildScale(55, 'mixolydian'), kind: 'arpeggio', gapMs: 260 },
    ],
    exercise: { id: 'ex-l4-modes', title: 'Re dórico', mode: 'timed', skills: ['modes', 'scales'], build: () => scaleExercise({ rootMidi: 62, scaleId: 'dorian', hand: 'R', noteBeats: 0.5, bpm: 80 }) },
    passScore: 70,
  }),
  lesson({
    id: 'l4-extended',
    level: 4,
    title: 'Acordes extendidos',
    objective: 'Añadir novenas para un sonido más rico.',
    explanation: ['La novena es la segunda una octava más arriba. Cadd9 = Do-Mi-Sol-Re. En el teclado a menudo se omite la quinta.'],
    demos: [
      { label: 'Cadd9', notes: buildChord(C4, 'add9'), kind: 'chord' },
      { label: 'Cmaj9', notes: buildChord(48, 'maj9'), kind: 'chord' },
    ],
    exercise: { id: 'ex-l4-ext', title: 'Cadd9 – Fadd9 – G9', mode: 'timed', skills: ['extended-chords'], build: () => chordsExercise([{ rootMidi: 60, typeId: 'add9' }, { rootMidi: 53, typeId: 'add9' }, { rootMidi: 55, typeId: '9' }, { rootMidi: 60, typeId: 'add9' }], { beatsEach: 4, bpm: 60, title: 'Extendidos' }) },
    passScore: 65,
  }),
  lesson({
    id: 'l4-independence',
    level: 4,
    title: 'Independencia de manos: bajo Alberti',
    objective: 'Mantener un patrón continuo en la izquierda bajo una melodía larga.',
    explanation: ['El bajo Alberti (grave–agudo–medio–agudo) es típico de Mozart. La derecha toca notas largas encima.'],
    demos: [],
    exercise: {
      id: 'ex-l4-alberti',
      title: 'Alberti + melodía',
      mode: 'timed',
      skills: ['independence', 'accompaniment'],
      build: () => {
        const p = progressionExercise({ tonicMidi: C4, degrees: [0, 4, 0, 4], lhStyle: 'alberti', rhChords: false, bpm: 72, title: 'Alberti' })
        const rh = melodyExercise('x', '', 'E5:2 D5:2 | D5:2 C5:2 | E5:2 G5:2 | F5:2 D5:2', { bpm: 72 }).notes
        return { ...p, title: 'Alberti + melodía', notes: [...p.notes, ...rh].sort((a, b) => a.start - b.start) }
      },
    },
    passScore: 65,
  }),
  lesson({
    id: 'l4-arp2',
    level: 4,
    title: 'Arpegios de dos octavas',
    objective: 'Extender los arpegios pasando el pulgar.',
    explanation: ['Digitación derecha para Do: 1-2-3-1-2-3-5. Mantén la muñeca suelta al pasar el pulgar.'],
    demos: [],
    exercise: { id: 'ex-l4-arp2', title: 'Arpegio de La menor, 2 octavas', mode: 'timed', skills: ['arpeggios'], build: () => arpeggioExercise(57, 'min', 'R', 2, 72, 0.5) },
    passScore: 65,
  }),
  lesson({
    id: 'l4-song',
    level: 4,
    title: 'Pieza: Jingle Bells',
    objective: 'Interpretar una canción de dificultad media con bajo–acorde.',
    explanation: ['Notas repetidas en la derecha y patrón de bajo y acorde en la izquierda.'],
    demos: [],
    exercise: { id: 'ex-l4-song', title: 'Jingle Bells', mode: 'timed', skills: ['repertoire', 'independence'], songRef: { songId: 'jingle-bells', difficulty: 'advanced' }, build: () => { throw new Error('songRef') } },
    passScore: 65,
  }),
]

// ───────────────────────────── NIVEL 5 ─────────────────────────────
const level5: Lesson[] = [
  lesson({
    id: 'l5-harmonize',
    level: 5,
    title: 'Armonizar una melodía',
    objective: 'Elegir acordes I, IV y V que encajan con la melodía.',
    explanation: ['Regla práctica: elige el acorde que contiene la nota más importante (la del pulso fuerte) de la melodía.', 'Aquí tocas "Estrellita" con acordes en bloque en la izquierda.'],
    demos: [],
    exercise: { id: 'ex-l5-harm', title: 'Estrellita armonizada', mode: 'timed', skills: ['harmonization', 'two-hands'], build: () => melodyExercise('twinkle-harm', 'Estrellita armonizada', 'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2', { lh: 'C3+E3+G3:2 C3+E3+G3:2 | C3+F3+A3:2 C3+E3+G3:2 | C3+F3+A3:2 C3+E3+G3:2 | B2+D3+G3:2 C3+E3+G3:2', bpm: 76, chords: chordSeq('C:2 C:2 F:2 C:2 F:2 C:2 G:2 C:2') }) },
    passScore: 70,
  }),
  lesson({
    id: 'l5-reharm',
    level: 5,
    title: 'Rearmonización básica',
    objective: 'Sustituir tríadas por séptimas y acordes relativos.',
    explanation: ['C – Am – F – G se convierte en Cmaj7 – Am7 – Dm7 – G7: misma función, más color.'],
    demos: [],
    exercise: { id: 'ex-l5-reharm', title: 'I–vi–ii–V con séptimas', mode: 'timed', skills: ['harmonization', 'sevenths', 'voice-leading'], build: () => progressionExercise({ tonicMidi: C4, degrees: [0, 5, 1, 4], sevenths: true, lhStyle: 'root', bpm: 80, repeat: 2, title: 'Rearmonización' }) },
    passScore: 70,
  }),
  lesson({
    id: 'l5-improv',
    level: 5,
    title: 'Improvisación con la pentatónica',
    objective: 'Improvisar sobre una base usando la pentatónica menor de La.',
    explanation: [
      'La pentatónica menor de La (La-Do-Re-Mi-Sol) encaja sobre Lam–Fa–Do–Sol. Las teclas resaltadas son "seguras".',
      'Evaluación: porcentaje de tus notas que pertenecen a la escala, y que toques de forma continuada. No hay notas fijas.',
    ],
    highlight: buildScale(57, 'minor-pentatonic', 2),
    demos: [{ label: 'Pentatónica de La', notes: buildScale(57, 'minor-pentatonic', 2), kind: 'arpeggio', gapMs: 200 }],
    exercise: { id: 'ex-l5-improv', title: 'Improvisa sobre Lam–Fa–Do–Sol', mode: 'improv', skills: ['improvisation'], improv: { rootPc: 9, scaleId: 'minor-pentatonic', bars: 8 }, build: () => improvBacking(57, [0, 5, 2, 6], 'natural-minor', 8, 84) },
    passScore: 80,
  }),
  lesson({
    id: 'l5-variation',
    level: 5,
    title: 'Variaciones melódicas',
    objective: 'Adornar una melodía con notas de paso y ritmo.',
    explanation: ['Variar = mantener la estructura y cambiar el detalle: notas de paso entre grados, anticipaciones, corcheas.'],
    demos: [],
    exercise: { id: 'ex-l5-var', title: 'Oda a la alegría variada', mode: 'timed', skills: ['melody', 'syncopation'], build: () => melodyExercise('ode-var', 'Oda variada', 'E4 E4:0.5 F4:0.5 G4 G4:0.5 A4:0.5 | G4:0.5 F4:0.5 E4 D4:0.5 E4:0.5 D4 | C4 C4:0.5 D4:0.5 E4 E4:0.5 G4:0.5 | E4:1.5 D4:0.5 D4:2', { bpm: 80, lh: 'C3:4 | G2:4 | C3:4 | G2:4' }) },
    passScore: 65,
  }),
  lesson({
    id: 'l5-voicings',
    level: 5,
    title: 'Conducción de voces en varias tonalidades',
    objective: 'ii–V–I en Do, Fa y Si♭.',
    explanation: ['Transportar a otras tonalidades obliga a entender la forma, no a memorizar teclas.'],
    demos: [],
    exercise: {
      id: 'ex-l5-vl',
      title: 'ii–V–I en tres tonalidades',
      mode: 'timed',
      skills: ['voice-leading', 'sevenths'],
      build: () => {
        const parts = [60, 65, 58].map((t) => progressionExercise({ tonicMidi: t, degrees: [1, 4, 0], sevenths: true, lhStyle: 'root', bpm: 76 }))
        const notes = parts.flatMap((p, i) => p.notes.map((n) => ({ ...n, start: n.start + i * 12 })))
        const chords = parts.flatMap((p, i) => p.chords.map((c) => ({ ...c, start: c.start + i * 12 })))
        return { ...parts[0], id: 'vl-3keys', title: 'ii–V–I en Do, Fa y Si♭', notes, chords, sections: [{ id: 'c', name: 'Do', start: 0, end: 12 }, { id: 'f', name: 'Fa', start: 12, end: 24 }, { id: 'bb', name: 'Si♭', start: 24, end: 36 }] }
      },
    },
    passScore: 65,
  }),
  lesson({
    id: 'l5-poly',
    level: 5,
    title: 'Ritmos complejos: 3 contra 2',
    objective: 'Tocar tresillos en una mano contra corcheas en la otra.',
    explanation: ['La derecha divide el compás en 3 partes iguales y la izquierda en 2. Solo coinciden en el primer pulso.'],
    demos: [],
    exercise: { id: 'ex-l5-poly', title: 'Polirritmo 3:2', mode: 'timed', skills: ['independence', 'rhythm'], build: () => polyrhythmExercise(6, 4, 4, 56) },
    passScore: 60,
  }),
  lesson({
    id: 'l5-canon',
    level: 5,
    title: 'Acompañamiento elaborado: Canon',
    objective: 'Arpegios continuos sobre la progresión del Canon de Pachelbel.',
    explanation: ['I–V–vi–iii–IV–I–IV–V con la izquierda en arpegio y la derecha en acordes.'],
    demos: [],
    exercise: { id: 'ex-l5-canon', title: 'Canon en Re', mode: 'timed', skills: ['accompaniment', 'independence'], build: () => progressionExercise({ tonicMidi: 62, degrees: [0, 4, 5, 2, 3, 0, 3, 4], lhStyle: 'broken', bpm: 72, title: 'Canon (progresión)' }) },
    passScore: 65,
  }),
  lesson({
    id: 'l5-blues',
    level: 5,
    title: 'Estilos: blues de 12 compases',
    objective: 'Tocar la forma del blues con acordes de séptima.',
    explanation: ['El blues usa I7, IV7 y V7. Forma: I I I I | IV IV I I | V IV I V.'],
    demos: [],
    exercise: {
      id: 'ex-l5-blues',
      title: 'Blues en Do',
      mode: 'timed',
      skills: ['progressions', 'sevenths'],
      build: () => {
        const chords = chordSeq('C7 C7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7')
        return {
          ...progressionExercise({ tonicMidi: C4, degrees: [0], lhStyle: 'root', bpm: 92 }),
          id: 'blues12',
          title: 'Blues de 12 compases en Do',
          chords,
          notes: chords.flatMap((c) => {
            const root = { C7: 48, F7: 53, G7: 43 }[c.symbol as 'C7' | 'F7' | 'G7']
            const v = { C7: [58, 64, 67], F7: [57, 63, 65], G7: [59, 65, 67] }[c.symbol as 'C7' | 'F7' | 'G7']
            return [
              { midi: root, start: c.start, duration: 1.9, velocity: 72, hand: 'L' as const },
              { midi: root + 7, start: c.start + 2, duration: 1.9, velocity: 68, hand: 'L' as const },
              ...v.map((m) => ({ midi: m, start: c.start, duration: 1.5, velocity: 74, hand: 'R' as const })),
              ...v.map((m) => ({ midi: m, start: c.start + 2.5, duration: 1.4, velocity: 70, hand: 'R' as const })),
            ]
          }),
          sections: [{ id: 'a', name: 'Compases 1–4', start: 0, end: 16 }, { id: 'b', name: 'Compases 5–8', start: 16, end: 32 }, { id: 'c', name: 'Compases 9–12', start: 32, end: 48 }],
        }
      },
    },
    passScore: 65,
  }),
  lesson({
    id: 'l5-elise',
    level: 5,
    title: 'Pieza: Para Elisa',
    objective: 'Interpretar el tema de Para Elisa con ambas manos.',
    explanation: ['Las manos se reparten el arpegio: izquierda La-Mi-La, derecha Do-Mi-La. Practica cada motivo por separado.'],
    demos: [],
    exercise: { id: 'ex-l5-elise', title: 'Para Elisa', mode: 'timed', skills: ['repertoire', 'independence'], songRef: { songId: 'fur-elise', difficulty: 'advanced' }, build: () => { throw new Error('songRef') } },
    passScore: 65,
  }),
]

export const CURRICULUM: Level[] = [
  { id: 1, name: 'Fundamentos', subtitle: 'Desde cero', description: 'El teclado, las notas, la postura, el pulso y tus primeras melodías con ambas manos.', lessons: level1 },
  { id: 2, name: 'Primeras herramientas', subtitle: 'Escalas y acordes', description: 'Tonos y semitonos, escalas mayores y menores, intervalos, tríadas y progresiones.', lessons: level2 },
  { id: 3, name: 'Desarrollo musical', subtitle: 'Fluidez', description: 'Inversiones, séptimas, ritmos, síncopas, patrones de izquierda y piezas completas.', lessons: level3 },
  { id: 4, name: 'Intermedio-avanzado', subtitle: 'Armonía', description: 'Armonía funcional, ii–V–I, modos, extendidos e independencia de manos.', lessons: level4 },
  { id: 5, name: 'Avanzado', subtitle: 'Creatividad', description: 'Armonizar, rearmonizar, improvisar, polirritmos y estilos.', lessons: level5 },
]

export const ALL_LESSONS: Lesson[] = CURRICULUM.flatMap((l) => l.lessons)
export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(ALL_LESSONS.map((l) => [l.id, l]))

export type LessonState = 'completed' | 'available' | 'locked'

/** Estado de cada lección según las lecciones completadas. */
export function lessonStates(completed: Set<string>): Record<string, LessonState> {
  const out: Record<string, LessonState> = {}
  for (const level of CURRICULUM) {
    level.lessons.forEach((l, i) => {
      if (completed.has(l.id)) out[l.id] = 'completed'
      else if (i === 0) {
        // la primera lección de un nivel se abre al completar el 70 % del nivel anterior
        const prev = CURRICULUM.find((x) => x.id === level.id - 1)
        const ok = !prev || prev.lessons.filter((p) => completed.has(p.id)).length >= Math.ceil(prev.lessons.length * 0.7)
        out[l.id] = ok ? 'available' : 'locked'
      } else out[l.id] = completed.has(level.lessons[i - 1].id) ? 'available' : 'locked'
    })
  }
  return out
}

export function nextLesson(completed: Set<string>): Lesson | undefined {
  const st = lessonStates(completed)
  return ALL_LESSONS.find((l) => st[l.id] === 'available')
}
