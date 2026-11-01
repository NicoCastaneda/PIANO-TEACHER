import { isBlackKey, pitchClass, pitchClassName, type NamingStyle } from '../music/notes'
import { buildChord, CHORD_TYPE_BY_ID, chordSymbol, inversionName, preferredAccidental } from '../music/theory'

/**
 * Entrenador de acordes: tarjetas de memoria por grupos pequeños, inversiones,
 * examen y repaso espaciado (cajas de Leitner). Todo es determinista y se evalúa
 * con las notas reales que llegan por MIDI: vale cualquier octava, pero las notas
 * deben ser exactamente las del acorde y la más grave debe ser la de la inversión pedida.
 */

export type ChordCategory = 'fundamental' | 'useful' | 'occasional'

export const CATEGORY_INFO: Record<ChordCategory, { title: string; description: string }> = {
  fundamental: { title: 'Fundamentales', description: 'Las tríadas mayores y menores que aparecen en casi todas las canciones. Empieza aquí.' },
  useful: { title: 'Útiles', description: 'Séptimas, suspendidos y tonalidades con más alteraciones: dan color y aparecen a menudo en pop, baladas y jazz.' },
  occasional: { title: 'Ocasionales', description: 'Acordes de tensión y de color (disminuidos, aumentados, sextas, novenas). Menos frecuentes, pero clave para sonar más rico.' },
}

export interface ChordRef {
  rootPc: number
  typeId: string
}

export interface ChordGroup {
  id: string
  category: ChordCategory
  title: string
  /** truco para recordar el grupo */
  tip: string
  chords: ChordRef[]
}

const c = (rootPc: number, typeId: string): ChordRef => ({ rootPc, typeId })
// Clases de altura
const C = 0, Db = 1, D = 2, Eb = 3, E = 4, F = 5, Gb = 6, G = 7, Ab = 8, A = 9, Bb = 10, B = 11

export const CHORD_GROUPS: ChordGroup[] = [
  // ─── Fundamentales ───
  { id: 'f1', category: 'fundamental', title: 'Las tres de Do: C, F, G', tip: 'Solo teclas blancas y la misma forma en las tres: tecla sí, tecla no, tecla sí. Son el I, IV y V de Do mayor: con ellas ya acompañas cientos de canciones.', chords: [c(C, 'maj'), c(F, 'maj'), c(G, 'maj')] },
  { id: 'f2', category: 'fundamental', title: 'Menores blancas: Am, Dm, Em', tip: 'También todas blancas y con la misma forma "tecla sí, tecla no". Suenan más tristes porque la nota del medio está un semitono más abajo que en un mayor. Junto al grupo anterior forman casi toda la tonalidad de Do.', chords: [c(A, 'min'), c(D, 'min'), c(E, 'min')] },
  { id: 'f3', category: 'fundamental', title: 'Mayores con negra en medio: D, E, A', tip: 'Patrón blanca – NEGRA – blanca. Si tocas la menor (Dm, Em, Am) y subes solo la nota del medio un semitono, obtienes la mayor.', chords: [c(D, 'maj'), c(E, 'maj'), c(A, 'maj')] },
  { id: 'f4', category: 'fundamental', title: 'Menores con negra en medio: Cm, Fm, Gm', tip: 'Patrón blanca – NEGRA – blanca. Son C, F y G con la nota del medio bajada un semitono.', chords: [c(C, 'min'), c(F, 'min'), c(G, 'min')] },
  { id: 'f5', category: 'fundamental', title: 'Bemoles frecuentes: Bb, Eb', tip: 'Bb es negra – blanca – blanca; Eb es negra – blanca – negra. Aparecen muchísimo en pop, baladas y canciones en Fa o Si bemol.', chords: [c(Bb, 'maj'), c(Eb, 'maj')] },
  // ─── Útiles ───
  { id: 'u1', category: 'useful', title: 'Séptimas de dominante: G7, C7, D7', tip: 'Acorde mayor + la nota que está un tono por debajo de la fundamental (7.ª menor). Suena "en suspenso", pidiendo resolver: G7 quiere ir a C.', chords: [c(G, '7'), c(C, '7'), c(D, '7')] },
  { id: 'u2', category: 'useful', title: 'Más dominantes: A7, E7, B7', tip: 'Misma receta: mayor + 7.ª menor. E7 resuelve a Am y A7 a Dm: son el "puente" hacia los acordes menores de Do.', chords: [c(A, '7'), c(E, '7'), c(B, '7')] },
  { id: 'u3', category: 'useful', title: 'Séptimas mayores: Cmaj7, Fmaj7, Gmaj7', tip: 'Acorde mayor + la nota un semitono por debajo de la fundamental. Sonido suave y "de balada o jazz". Truco: Cmaj7 = C + Em superpuestos.', chords: [c(C, 'maj7'), c(F, 'maj7'), c(G, 'maj7')] },
  { id: 'u4', category: 'useful', title: 'Menores séptima: Am7, Dm7, Em7', tip: 'Acorde menor + 7.ª menor (un tono por debajo de la fundamental). Am7 tiene las mismas notas que C6: comparten sonido cálido.', chords: [c(A, 'm7'), c(D, 'm7'), c(E, 'm7')] },
  { id: 'u5', category: 'useful', title: 'Suspendidos: Csus2, Csus4, Gsus4, Dsus4', tip: 'Sin tercera: ni mayor ni menor. En sus4 la nota del medio sube a la 4.ª; en sus2 baja a la 2.ª. Suelen resolver al acorde mayor (Csus4 → C).', chords: [c(C, 'sus2'), c(C, 'sus4'), c(G, 'sus4'), c(D, 'sus4')] },
  { id: 'u6', category: 'useful', title: 'Menores con sostenidos: Bm, F#m, C#m', tip: 'Bm = blanca – blanca – negra; F#m y C#m = negra – blanca – negra. Son el vi de D, A y E mayor.', chords: [c(B, 'min'), c(Gb, 'min'), c(Db, 'min')] },
  { id: 'u7', category: 'useful', title: 'Mayores "difíciles": B, Ab, Db, F#', tip: 'F# es la única tríada mayor de solo teclas negras. Ab y Db son negra – blanca – negra. B es blanca – negra – negra.', chords: [c(B, 'maj'), c(Ab, 'maj'), c(Db, 'maj'), c(Gb, 'maj')] },
  // ─── Ocasionales ───
  { id: 'o1', category: 'occasional', title: 'Disminuidos: Bdim, C#dim, F#dim', tip: 'Dos terceras menores apiladas (3 + 3 semitonos). Suena tenso, de paso. Bdim es el vii° de Do y casi siempre va hacia C.', chords: [c(B, 'dim'), c(Db, 'dim'), c(Gb, 'dim')] },
  { id: 'o2', category: 'occasional', title: 'Aumentados: Caug, Faug, Gaug', tip: 'Dos terceras mayores apiladas (4 + 4). Divide la octava en tres partes iguales: Caug, Eaug y G#aug tienen las mismas notas.', chords: [c(C, 'aug'), c(F, 'aug'), c(G, 'aug')] },
  { id: 'o3', category: 'occasional', title: 'Semidisminuidos: Bm7b5, Em7b5, F#m7b5', tip: 'Disminuido + 7.ª menor. Es el ii de las tonalidades menores (Bm7b5 → E7 → Am). Truco: Bm7b5 tiene las mismas notas que Dm6.', chords: [c(B, 'm7b5'), c(E, 'm7b5'), c(Gb, 'm7b5')] },
  { id: 'o4', category: 'occasional', title: 'Disminuidos séptima: Bdim7, C#dim7, G#dim7', tip: 'Cuatro terceras menores: la octava dividida en cuatro partes iguales. Solo existen 3 distintos; cualquier nota del acorde puede ser su fundamental.', chords: [c(B, 'dim7'), c(Db, 'dim7'), c(Ab, 'dim7')] },
  { id: 'o5', category: 'occasional', title: 'Sextas y añadidas: C6, Am6, Cadd9, Gadd9', tip: 'Acordes de color: se añade la 6.ª o la 9.ª (la 2.ª una octava arriba) al acorde básico. Valen en cualquier disposición; se practican en estado fundamental.', chords: [c(C, '6'), c(A, 'm6'), c(C, 'add9'), c(G, 'add9')] },
  { id: 'o6', category: 'occasional', title: 'Novenas: C9, G9, Dm9', tip: 'Séptima + novena. Puedes tocarlas compactas (la 9.ª como 2.ª) o repartidas entre las dos manos: la app solo comprueba las notas y el bajo.', chords: [c(C, '9'), c(G, '9'), c(D, 'm9')] },
]

export const GROUP_BY_ID: Record<string, ChordGroup> = Object.fromEntries(CHORD_GROUPS.map((g) => [g.id, g]))

/** Inversión máxima que tiene sentido practicar (los de 6.ª, añadida o novena solo en fundamental). */
export function maxInversion(typeId: string): number {
  const t = CHORD_TYPE_BY_ID[typeId]
  if (!t || t.intervals.some((i) => i >= 12) || typeId === '6' || typeId === 'm6') return 0
  return t.intervals.length - 1
}

export type InversionMode = 'root' | 'inversions' | 'all'
export const INVERSION_MODE_LABEL: Record<InversionMode, string> = { root: 'Solo fundamental', inversions: 'Solo inversiones', all: 'Todo mezclado' }

export interface ChordCard {
  /** "rootPc:typeId:inversion" */
  id: string
  rootPc: number
  typeId: string
  inversion: number
  groupId: string
}

export const cardId = (rootPc: number, typeId: string, inversion: number) => `${rootPc}:${typeId}:${inversion}`

export function cardsForGroups(groupIds: string[], mode: InversionMode): ChordCard[] {
  const out: ChordCard[] = []
  for (const gid of groupIds) {
    const g = GROUP_BY_ID[gid]
    if (!g) continue
    for (const ch of g.chords) {
      const max = maxInversion(ch.typeId)
      for (let inv = 0; inv <= max; inv++) {
        if (mode === 'root' && inv > 0) continue
        if (mode === 'inversions' && inv === 0 && max > 0) continue
        out.push({ id: cardId(ch.rootPc, ch.typeId, inv), rootPc: ch.rootPc, typeId: ch.typeId, inversion: inv, groupId: gid })
      }
    }
  }
  return out
}

/** Clases de altura del acorde, en orden fundamental–3.ª–5.ª–7.ª… */
export function chordPcs(ch: ChordRef): number[] {
  return CHORD_TYPE_BY_ID[ch.typeId].intervals.map((i) => pitchClass(ch.rootPc + i))
}

/** Clase de altura que debe sonar en el bajo para la inversión pedida. */
export function bassPcFor(card: Pick<ChordCard, 'rootPc' | 'typeId' | 'inversion'>): number {
  return chordPcs(card)[card.inversion]
}

const MINORISH = ['min', 'm7', 'm6', 'm9', 'dim', 'm7b5', 'dim7']
/** Ortografía: bemoles/sostenidos según la tonalidad habitual; F# se escribe siempre con sostenido. */
const accFor = (ch: ChordRef) => (ch.rootPc === 6 ? 'sharp' : preferredAccidental(ch.rootPc, MINORISH.includes(ch.typeId)))

/** Cifrado con barra cuando no está en estado fundamental: "C/E". */
export function cardSymbol(card: Pick<ChordCard, 'rootPc' | 'typeId' | 'inversion'>): string {
  return chordSymbol(card.rootPc, card.typeId, accFor(card), card.inversion ? bassPcFor(card) : undefined)
}

export function noteName(pc: number, ch: ChordRef, style: NamingStyle): string {
  return pitchClassName(pc, accFor(ch), style)
}

/** "Do mayor", "La menor séptima"… */
export function chordLongName(ch: ChordRef, style: NamingStyle = 'latin'): string {
  return `${noteName(ch.rootPc, ch, style)} ${CHORD_TYPE_BY_ID[ch.typeId].name.toLowerCase()}`
}

export function cardPrompt(card: ChordCard, style: NamingStyle = 'latin'): string {
  return `${chordLongName(card, style)} · ${inversionName(card.inversion).toLowerCase()}`
}

/** Disposición cerrada de referencia, con la nota grave cerca de `around` (Do central por defecto). */
export function cardVoicing(card: Pick<ChordCard, 'rootPc' | 'typeId' | 'inversion'>, around = 60): number[] {
  let best: number[] = []
  let bestDist = Infinity
  for (let oct = 2; oct <= 5; oct++) {
    const v = buildChord((oct + 1) * 12 + card.rootPc, card.typeId, card.inversion)
    const d = Math.abs(v[0] - around) + (v[v.length - 1] > 84 ? 100 : 0)
    if (d < bestDist) {
      bestDist = d
      best = v
    }
  }
  return best
}

// ─────────────────────────── Manos ───────────────────────────

/**
 * Con qué mano se practica:
 * - R: acorde completo con la derecha (cuando la izquierda lleva el bajo o para aprender formas);
 * - L: acorde completo con la izquierda (lo típico mientras la derecha toca la melodía);
 * - both: la izquierda toca SOLO el bajo y la derecha el acorde completo (acompañamiento pop/balada).
 */
export type HandMode = 'R' | 'L' | 'both'

export const HAND_LABEL: Record<HandMode, string> = { R: 'Mano derecha', L: 'Mano izquierda', both: 'Ambas: bajo + acorde' }
export const HAND_PROMPT: Record<HandMode, string> = {
  R: 'con la mano derecha',
  L: 'con la mano izquierda',
  both: 'izquierda: solo el bajo · derecha: el acorde completo',
}

/** Notas mínimas para evaluar un gesto (en "ambas" se espera el bajo más el acorde completo). */
export function minNotesFor(card: Pick<ChordCard, 'rootPc' | 'typeId'>, hand: HandMode): number {
  return chordPcs(card).length + (hand === 'both' ? 1 : 0)
}

/** Disposición de referencia según la mano: derecha cerca del Do central, izquierda una octava más abajo. */
export function handVoicing(card: Pick<ChordCard, 'rootPc' | 'typeId' | 'inversion'>, hand: HandMode): { lh: number[]; rh: number[] } {
  if (hand === 'R') return { lh: [], rh: cardVoicing(card, 60) }
  if (hand === 'L') return { lh: cardVoicing(card, 48), rh: [] }
  return { lh: [36 + bassPcFor(card)], rh: cardVoicing({ ...card, inversion: 0 }, 60) }
}

// ─────────────────────────── Evaluación ───────────────────────────

export type JudgeStatus = 'correct' | 'wrong-inversion' | 'wrong-notes' | 'incomplete'

export interface Judgement {
  status: JudgeStatus
  /** inversión que se tocó (si las notas eran correctas) */
  playedInversion?: number
  missingPcs: number[]
  extraPcs: number[]
  /** la disposición abarca más de una octava (válido, pero se sugiere posición cerrada) */
  wide: boolean
  /** modo "ambas": a la derecha (todo lo que está por encima del bajo) le faltan notas del acorde */
  rhIncomplete?: boolean
  /** sugerencia de zona del teclado para la mano elegida (no resta puntos) */
  zoneHint?: string
}

/**
 * Compara las notas tocadas con la tarjeta. Cualquier octava y duplicaciones valen:
 * importa el conjunto de notas (clases de altura) y cuál suena en el bajo.
 * En el modo "ambas", además, las notas por encima del bajo (la derecha) deben formar el acorde completo.
 * La zona del teclado solo genera una sugerencia, nunca resta puntos.
 */
export function judgeChord(played: number[], card: Pick<ChordCard, 'rootPc' | 'typeId' | 'inversion'>, hand: HandMode = 'R'): Judgement {
  const j = judgeNotes(played, card)
  const sorted = [...new Set(played)].sort((a, b) => a - b)
  if (hand === 'both' && (j.status === 'correct' || j.status === 'wrong-inversion')) {
    const upper = new Set(sorted.slice(1).map(pitchClass))
    const missing = chordPcs(card).filter((p) => !upper.has(p))
    if (missing.length) return { ...j, status: 'incomplete', missingPcs: missing, rhIncomplete: true }
  }
  return { ...j, zoneHint: zoneHint(sorted, hand) }
}

const DO3 = 48
const DO4 = 60

function zoneHint(sorted: number[], hand: HandMode): string | undefined {
  if (!sorted.length) return undefined
  const low = sorted[0]
  const high = sorted[sorted.length - 1]
  const closeLow = sorted.length >= 3 && sorted[1] - low <= 4 && low < DO3 - 2
  if (hand === 'R' && low < DO3 + 5) return 'Para la derecha, tócalo más arriba, cerca del Do central.'
  if (hand === 'L' && high > DO4 + 7) return 'Para la izquierda, tócalo más abajo: entre el Do grave (una octava bajo el central) y el Do central.'
  if (hand === 'both' && low >= DO4) return 'El bajo de la izquierda debería ir bastante más grave que el acorde de la derecha.'
  if (closeLow) return 'Muy grave y con las notas juntas suena turbio: en esa zona usa solo el bajo (o bajo + quinta).'
  return undefined
}

function judgeNotes(played: number[], card: Pick<ChordCard, 'rootPc' | 'typeId' | 'inversion'>): Judgement {
  const sorted = [...new Set(played)].sort((a, b) => a - b)
  const target = chordPcs(card)
  const got = [...new Set(sorted.map(pitchClass))]
  const missingPcs = target.filter((p) => !got.includes(p))
  const extraPcs = got.filter((p) => !target.includes(p))
  const wide = sorted.length > 1 && sorted[sorted.length - 1] - sorted[0] > 14
  if (!sorted.length) return { status: 'incomplete', missingPcs: target, extraPcs: [], wide: false }
  if (extraPcs.length) return { status: 'wrong-notes', missingPcs, extraPcs, wide }
  if (missingPcs.length) return { status: 'incomplete', missingPcs, extraPcs, wide }
  const bass = pitchClass(sorted[0])
  const playedInversion = target.indexOf(bass)
  if (playedInversion === card.inversion) return { status: 'correct', playedInversion, missingPcs, extraPcs, wide }
  return { status: 'wrong-inversion', playedInversion, missingPcs, extraPcs, wide }
}

/** Puntos de una respuesta en el examen: correcta 1, notas bien pero inversión equivocada 0,5, resto 0. */
export function examPoints(status: JudgeStatus | 'skipped'): number {
  return status === 'correct' ? 1 : status === 'wrong-inversion' ? 0.5 : 0
}

// ─────────────────────────── Repaso espaciado (Leitner) ───────────────────────────

export interface CardStat {
  /** 0 = nueva … 5 = muy dominada */
  box: number
  seen: number
  correct: number
  wrong: number
  /** tiempo medio de respuesta correcta (ms) */
  avgMs: number | null
  lastSeen: number
}

export const MASTERED_BOX = 4
export const FAST_MS = 5000

export const emptyStat = (): CardStat => ({ box: 0, seen: 0, correct: 0, wrong: 0, avgMs: null, lastSeen: 0 })

/**
 * Actualiza una tarjeta. Acierto sin ayuda y en menos de 5 s → sube una caja.
 * Acierto lento → se queda (mínimo caja 1). Error o respuesta vista → vuelve a la caja 1.
 */
export function updateStat(prev: CardStat | undefined, o: { correct: boolean; revealed: boolean; ms: number; now?: number }): CardStat {
  const s = { ...(prev ?? emptyStat()) }
  s.seen++
  s.lastSeen = o.now ?? Date.now()
  if (o.correct && !o.revealed) {
    s.correct++
    s.avgMs = s.avgMs === null ? o.ms : Math.round(s.avgMs * 0.7 + o.ms * 0.3)
    s.box = o.ms <= FAST_MS ? Math.min(5, s.box + 1) : Math.max(1, s.box)
  } else {
    if (!o.correct) s.wrong++
    s.box = 1
  }
  return s
}

const BOX_WEIGHT = [8, 7, 4, 2, 1, 0.5]

/** Elige la siguiente tarjeta: las de cajas bajas salen más; nunca repite la anterior si hay alternativa. */
export function pickNextCard(cards: ChordCard[], stats: Record<string, CardStat>, rng: () => number = Math.random, avoidId?: string): ChordCard {
  const pool = cards.length > 1 ? cards.filter((x) => x.id !== avoidId) : cards
  const weights = pool.map((x) => BOX_WEIGHT[stats[x.id]?.box ?? 0])
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

/** Dominio de un conjunto de tarjetas (0–1): media de min(caja, 4)/4. */
export function mastery(cards: ChordCard[], stats: Record<string, CardStat>): number {
  if (!cards.length) return 0
  return cards.reduce((s, x) => s + Math.min(stats[x.id]?.box ?? 0, MASTERED_BOX) / MASTERED_BOX, 0) / cards.length
}

/** Primer grupo (en orden pedagógico) que aún no está dominado al 80 %. */
export function recommendedGroup(stats: Record<string, CardStat>): ChordGroup {
  return CHORD_GROUPS.find((g) => mastery(cardsForGroups([g.id], 'all'), stats) < 0.8) ?? CHORD_GROUPS[CHORD_GROUPS.length - 1]
}

/** Preguntas de examen: sin repetir mientras haya tarjetas; las menos dominadas tienen prioridad. */
export function buildExam(cards: ChordCard[], n: number, stats: Record<string, CardStat>, rng: () => number = Math.random): ChordCard[] {
  const out: ChordCard[] = []
  let pool: ChordCard[] = []
  while (out.length < n && cards.length) {
    if (!pool.length) pool = [...cards]
    const pick = pickNextCard(pool, stats, rng, out[out.length - 1]?.id)
    out.push(pick)
    pool = pool.filter((x) => x.id !== pick.id)
  }
  return out
}

// ─────────────────────────── Consejos ───────────────────────────

const FINGERS_RH = [[1, 3, 5], [1, 2, 5], [1, 3, 5]]
const FINGERS_LH = [[5, 3, 1], [5, 3, 1], [5, 2, 1]]

/** Digitación habitual para tríadas en posición cerrada (de grave a agudo). */
export function triadFingering(inversion: number): { rh: number[]; lh: number[] } | null {
  if (inversion < 0 || inversion > 2) return null
  return { rh: FINGERS_RH[inversion], lh: FINGERS_LH[inversion] }
}

/** Patrón de teclas blancas y negras de la disposición cerrada. */
export function keyPattern(voicing: number[]): string {
  return voicing.map((m) => (isBlackKey(m) ? 'NEGRA' : 'blanca')).join(' – ')
}

/** Consejos concretos para una tarjeta. */
export function cardTips(card: ChordCard, style: NamingStyle = 'latin', hand: HandMode = 'R'): string[] {
  const t = CHORD_TYPE_BY_ID[card.typeId]
  const pcs = chordPcs(card)
  const names = pcs.map((p) => noteName(p, card, style))
  const hv = handVoicing(card, hand)
  const v = hand === 'L' ? hv.lh : hv.rh
  const tips: string[] = []
  const order = [...names.slice(card.inversion), ...names.slice(0, card.inversion)]
  if (hand === 'both') {
    tips.push(`Izquierda: solo ${names[card.inversion]} (el bajo), en la zona grave. Derecha: ${names.join(' – ')}, el acorde completo, cerca del Do central (vale cualquier inversión).`)
    tips.push(`En cifrado se escribe ${cardSymbol(card)}: la letra tras la barra es la nota del bajo.`)
  } else tips.push(`Notas de grave a agudo: ${order.join(' – ')}. Teclas: ${keyPattern(v)}.`)
  const steps = t.intervals.slice(1).map((iv, k) => iv - t.intervals[k])
  if (t.intervals.length <= 4 && t.intervals.every((i) => i < 12)) tips.push(`Receta (${t.name.toLowerCase()}): desde la fundamental, ${steps.map((s) => `${s} semitonos`).join(' + ')}.`)
  const tertian = ['maj', 'min', 'dim'].includes(card.typeId)
  if (t.intervals.length === 3 && maxInversion(card.typeId) === 2) {
    if (card.inversion === 0) tips.push(tertian ? 'Estado fundamental: dos terceras apiladas, "tecla sí, tecla no". La nota de abajo da el nombre al acorde.' : `Estado fundamental: la fundamental (${names[0]}) va en el bajo.`)
    if (card.inversion === 1)
      tips.push(tertian ? `1.ª inversión: la fundamental (${names[0]}) sube arriba y en el bajo queda la 3.ª (${names[1]}). El hueco más ancho está ARRIBA y su nota superior es la fundamental.` : `1.ª inversión: la fundamental (${names[0]}) sube arriba; en el bajo va ${names[1]}.`)
    if (card.inversion === 2)
      tips.push(tertian ? `2.ª inversión: en el bajo queda la 5.ª (${names[2]}). El hueco más ancho está ABAJO; la fundamental (${names[0]}) es la nota superior de ese hueco, en el medio del acorde.` : `2.ª inversión: en el bajo va ${names[2]}; la fundamental (${names[0]}) queda en el medio.`)
    const f = triadFingering(hand === 'both' ? 0 : card.inversion)
    if (f && hand === 'R') tips.push(`Digitación (derecha): ${f.rh.join('-')}, de grave a agudo.`)
    if (f && hand === 'L') tips.push(`Digitación (izquierda): ${f.lh.join('-')}, de grave a agudo.`)
    if (f && hand === 'both') tips.push(`Digitación: izquierda dedo 5 en el bajo; derecha ${f.rh.join('-')} si tocas el acorde en estado fundamental.`)
  } else if (t.intervals.length === 4 && card.inversion > 0 && card.typeId === 'dim7') {
    tips.push(`Todas las distancias son iguales (3 semitonos): solo el bajo dice la inversión. Pon ${names[card.inversion]} abajo.`)
  } else if (t.intervals.length === 4 && card.inversion > 0) {
    tips.push(`${card.inversion}.ª inversión de una cuatríada: en el bajo va ${names[card.inversion]}. Busca el intervalo de 2.ª (dos teclas juntas o casi): la nota superior de esa 2.ª es la fundamental (${names[0]}).`)
  } else if (t.intervals.length === 4) {
    tips.push(hand === 'L' ? 'Cuatro notas apiladas por terceras. Digitación habitual con la izquierda: 5-3-2-1.' : 'Cuatro notas apiladas por terceras. Digitación habitual con la derecha: 1-2-3-5.')
  }
  tips.push(HAND_TIP[hand])
  return tips
}

const HAND_TIP: Record<HandMode, string> = {
  R: 'Derecha: tócalo alrededor del Do central. Cuando la derecha lleva los acordes y la izquierda el bajo, elige la inversión más cercana al acorde anterior para no saltar.',
  L: 'Izquierda: tócalo entre el Do grave (una octava bajo el central) y el Do central. Más abajo, los acordes con notas juntas suenan turbios. Así acompañas mientras la derecha toca la melodía.',
  both: 'Ambas: así se acompaña en pop y baladas. La izquierda da el bajo (grave y claro) y la derecha rellena la armonía con la inversión más cómoda.',
}

/** Consejos generales para aprender acordes (se muestran en la pestaña de consejos). */
export const GENERAL_TIPS: { title: string; text: string }[] = [
  {
    title: '¿Con qué mano?',
    text: 'Las tres formas son habituales. (1) Acorde con la izquierda y melodía con la derecha: la forma de empezar y de tocar canciones con melodía. (2) Bajo con la izquierda y acorde con la derecha: la forma típica de acompañar en pop y baladas, donde la derecha usa inversiones. (3) Acorde en una mano para aprender las formas. Practica cada grupo con las dos manos.',
  },
  { title: 'Pocos a la vez', text: 'Trabaja un grupo de 2–4 acordes hasta dominarlo al 80 % antes de pasar al siguiente. Repasa los anteriores de vez en cuando: el repaso espaciado elige más a menudo los que fallas.' },
  { title: 'Aprende la forma, no notas sueltas', text: 'Mayor = 4 + 3 semitonos; menor = 3 + 4. Fíjate en el patrón de blancas y negras: es la "huella" de cada acorde y se reconoce de un vistazo.' },
  { title: 'La escalera de inversiones', text: 'Toca el acorde en fundamental, 1.ª, 2.ª y otra vez fundamental una octava arriba, subiendo y bajando. Así aprendes las tres formas de cada acorde en un minuto.' },
  { title: 'Encuentra la fundamental', text: 'En una tríada invertida siempre hay un hueco de 4.ª (más ancho que los demás): la nota de arriba de ese hueco es la fundamental. En cuatríadas, la nota de arriba de la 2.ª.' },
  { title: 'Inversiones = menos movimiento', text: 'Las inversiones sirven para pasar de un acorde a otro moviendo la mano lo mínimo. C → F → G es más fácil como C, F/C (2.ª) y G/B (1.ª): la mano casi no se mueve.' },
  { title: 'Dilo en voz alta', text: 'Nombra el acorde y su inversión mientras lo tocas ("La menor, primera inversión"). Asociar nombre, forma y sonido acelera la memoria.' },
  { title: 'Sin mirar', text: 'Cuando un acorde ya te sale, tócalo mirando la pantalla en vez de las manos. La app te dice si las notas y el bajo son correctos.' },
  { title: 'Ambas manos', text: 'Practica también con la izquierda: es la que suele llevar los acordes en el acompañamiento. La app acepta cualquier octava.' },
  { title: 'Sesiones cortas y frecuentes', text: '5–10 minutos al día funcionan mejor que una hora a la semana. El examen te dice qué grupo repasar.' },
]
