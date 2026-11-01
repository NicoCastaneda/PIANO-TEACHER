import { describe, expect, it } from 'vitest'
import { validateArrangement } from '../songs/validate'
import { PROGRESSIONS, progressionArrangement, voiceProgression } from './progressions'
import {
  buildExam,
  cardsForGroups,
  cardSymbol,
  cardTips,
  cardVoicing,
  CHORD_GROUPS,
  examPoints,
  judgeChord,
  mastery,
  maxInversion,
  pickNextCard,
  recommendedGroup,
  updateStat,
  handVoicing,
  minNotesFor,
  type CardStat,
} from './trainer'

const C_MAJ = (inversion: number) => ({ rootPc: 0, typeId: 'maj', inversion })

describe('evaluación de tarjetas de acordes', () => {
  it('acepta cualquier octava y duplicaciones si el bajo es correcto', () => {
    expect(judgeChord([60, 64, 67], C_MAJ(0)).status).toBe('correct')
    expect(judgeChord([36, 52, 55, 60, 64], C_MAJ(0)).status).toBe('correct') // C2 E3 G3 C4 E4
    expect(judgeChord([64, 67, 72], C_MAJ(1)).status).toBe('correct') // E G C
    expect(judgeChord([43, 48, 52], C_MAJ(2)).status).toBe('correct') // G2 C3 E3
  })
  it('notas correctas con otra inversión: lo dice y vale medio punto en el examen', () => {
    const j = judgeChord([60, 64, 67], C_MAJ(1))
    expect(j.status).toBe('wrong-inversion')
    expect(j.playedInversion).toBe(0)
    expect(examPoints(j.status)).toBe(0.5)
  })
  it('detecta notas de más y acordes incompletos', () => {
    const wrong = judgeChord([60, 63, 67], C_MAJ(0)) // Cm en vez de C
    expect(wrong.status).toBe('wrong-notes')
    expect(wrong.extraPcs).toEqual([3])
    expect(wrong.missingPcs).toEqual([4])
    expect(judgeChord([60, 64], C_MAJ(0)).status).toBe('incomplete')
    expect(examPoints('wrong-notes')).toBe(0)
  })
  it('séptimas e inversiones de cuatríadas', () => {
    const g7_3 = { rootPc: 7, typeId: '7', inversion: 3 }
    expect(judgeChord([53, 55, 59, 62], g7_3).status).toBe('correct') // F G B D
    expect(cardSymbol(g7_3)).toBe('G7/F')
    expect(cardSymbol({ rootPc: 9, typeId: 'min', inversion: 1 })).toBe('Am/C')
  })
  it('la disposición de referencia está en el rango y corresponde a la tarjeta', () => {
    for (const card of cardsForGroups(CHORD_GROUPS.map((g) => g.id), 'all')) {
      const v = cardVoicing(card)
      expect(v[0]).toBeGreaterThanOrEqual(36)
      expect(v[v.length - 1]).toBeLessThanOrEqual(96)
      expect(judgeChord(v, card).status).toBe('correct')
      expect(cardTips(card).length).toBeGreaterThan(0)
    }
  })
})

describe('grupos y tarjetas', () => {
  it('grupos pequeños (2–4 acordes) y en las tres categorías', () => {
    for (const g of CHORD_GROUPS) {
      expect(g.chords.length).toBeGreaterThanOrEqual(2)
      expect(g.chords.length).toBeLessThanOrEqual(4)
    }
    expect(new Set(CHORD_GROUPS.map((g) => g.category))).toEqual(new Set(['fundamental', 'useful', 'occasional']))
  })
  it('inversiones según el tipo de acorde', () => {
    expect(maxInversion('maj')).toBe(2)
    expect(maxInversion('7')).toBe(3)
    expect(maxInversion('add9')).toBe(0)
    expect(cardsForGroups(['f1'], 'root')).toHaveLength(3)
    expect(cardsForGroups(['f1'], 'inversions')).toHaveLength(6)
    expect(cardsForGroups(['f1'], 'all')).toHaveLength(9)
    // los de fundamental solamente siguen apareciendo en "solo inversiones"
    expect(cardsForGroups(['o5'], 'inversions')).toHaveLength(4)
  })
})

describe('repaso espaciado', () => {
  it('sube de caja con aciertos rápidos y vuelve a la 1 con errores o ayuda', () => {
    let s: CardStat | undefined
    s = updateStat(s, { correct: true, revealed: false, ms: 2000 })
    s = updateStat(s, { correct: true, revealed: false, ms: 2000 })
    expect(s.box).toBe(2)
    expect(updateStat(s, { correct: true, revealed: false, ms: 9000 }).box).toBe(2)
    expect(updateStat(s, { correct: false, revealed: false, ms: 1000 }).box).toBe(1)
    expect(updateStat(s, { correct: true, revealed: true, ms: 1000 }).box).toBe(1)
  })
  it('elige más las tarjetas poco dominadas y no repite la anterior', () => {
    const cards = cardsForGroups(['f1'], 'root')
    const stats: Record<string, CardStat> = { [cards[0].id]: { box: 5, seen: 9, correct: 9, wrong: 0, avgMs: 1000, lastSeen: 0 } }
    let seq = 0
    const rng = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280)
    const counts = new Map<string, number>()
    for (let i = 0; i < 600; i++) {
      const c = pickNextCard(cards, stats, rng)
      counts.set(c.id, (counts.get(c.id) ?? 0) + 1)
    }
    expect(counts.get(cards[0].id) ?? 0).toBeLessThan(counts.get(cards[1].id)! / 4)
    for (let i = 0; i < 50; i++) expect(pickNextCard(cards, stats, Math.random, cards[1].id).id).not.toBe(cards[1].id)
  })
  it('dominio, grupo recomendado y examen sin repeticiones', () => {
    const f1 = cardsForGroups(['f1'], 'all')
    expect(mastery(f1, {})).toBe(0)
    expect(recommendedGroup({}).id).toBe('f1')
    const full = Object.fromEntries(f1.map((c) => [c.id, { box: 4, seen: 4, correct: 4, wrong: 0, avgMs: 1500, lastSeen: 0 }]))
    expect(mastery(f1, full)).toBe(1)
    expect(recommendedGroup(full).id).toBe('f2')
    const exam = buildExam(f1, 9, {})
    expect(new Set(exam.map((c) => c.id)).size).toBe(9)
    expect(buildExam(f1, 12, {})).toHaveLength(12)
  })
})

describe('progresiones con inversiones', () => {
  it('pop I–V–vi–IV en Do: C, G/B, Am/C, F/C en la derecha y bajo en la izquierda', () => {
    const v = voiceProgression(PROGRESSIONS.find((p) => p.id === 'pop-axis')!)
    expect(v.map((x) => x.symbol)).toEqual(['C', 'G', 'Am', 'F'])
    expect(v[0].notes).toEqual([60, 64, 67])
    expect(v.map((x) => x.inversion)).toEqual([0, 1, 1, 2])
    expect(v.every((x) => x.chordHand === 'R' && x.bass !== undefined)).toBe(true)
  })
  it('el bajo descendente no salta de octava', () => {
    const v = voiceProgression(PROGRESSIONS.find((p) => p.id === 'descending-bass')!)
    expect(v.map((x) => x.symbol)).toEqual(['C', 'G/B', 'Am', 'C/G', 'F', 'C/E', 'Dm', 'G'])
    const bass = v.map((x) => x.bass!)
    for (let i = 1; i < 7; i++) expect(bass[i]).toBeLessThan(bass[i - 1])
  })
  it('acordes con la izquierda: zona grave y los acordes con barra llevan su bajo abajo', () => {
    const v = voiceProgression(PROGRESSIONS.find((p) => p.id === 'descending-bass')!, 0, 'lh-chords')
    for (const x of v) {
      expect(x.chordHand).toBe('L')
      expect(x.bass).toBeUndefined()
      expect(x.notes[0]).toBeGreaterThanOrEqual(43)
      expect(x.notes[x.notes.length - 1]).toBeLessThanOrEqual(65)
    }
    expect(v[1].notes[0] % 12).toBe(11) // G/B → Si abajo
    expect(v[5].notes[0] % 12).toBe(4) // C/E → Mi abajo
  })
  it('todas las progresiones generan arreglos válidos en cualquier tonalidad y reparto', () => {
    for (const p of PROGRESSIONS)
      for (const tonic of [0, 2, 5, 7, 9, 10])
        for (const layout of ['bass-rh', 'lh-chords', 'rh-chords'] as const) {
          const r = validateArrangement(progressionArrangement(p, tonic, layout))
          expect(r.issues.filter((i) => i.level === 'error')).toEqual([])
          expect(r.ok).toBe(true)
        }
  })
})

describe('manos', () => {
  it('"ambas": bajo con la izquierda y acorde completo con la derecha', () => {
    const c1 = { rootPc: 0, typeId: 'maj', inversion: 1 } // C/E
    expect(minNotesFor(c1, 'both')).toBe(4)
    expect(judgeChord([40, 60, 64, 67], c1, 'both').status).toBe('correct') // E2 + C4 E4 G4
    expect(judgeChord([40, 64, 67, 72], c1, 'both').status).toBe('correct') // la derecha puede ir invertida
    const inc = judgeChord([40, 55, 60], c1, 'both') // E2 + G3 C4: a la derecha le falta Mi
    expect(inc.status).toBe('incomplete')
    expect(inc.rhIncomplete).toBe(true)
    expect(inc.missingPcs).toEqual([4])
    expect(judgeChord([36, 64, 67, 72], c1, 'both').status).toBe('wrong-inversion') // bajo Do en vez de Mi
  })
  it('la zona solo sugiere, no resta', () => {
    const c0 = { rootPc: 0, typeId: 'maj', inversion: 0 }
    const highLeft = judgeChord([72, 76, 79], c0, 'L')
    expect(highLeft.status).toBe('correct')
    expect(highLeft.zoneHint).toMatch(/izquierda/)
    expect(judgeChord([48, 52, 55], c0, 'L').zoneHint).toBeUndefined()
    expect(judgeChord([48, 52, 55], c0, 'R').zoneHint).toMatch(/derecha/)
    expect(judgeChord([60, 64, 67], c0, 'R').zoneHint).toBeUndefined()
  })
  it('disposición y consejos según la mano', () => {
    const am1 = { id: 'x', rootPc: 9, typeId: 'min', inversion: 1, groupId: 'f2' }
    expect(handVoicing(am1, 'R').rh[0]).toBeGreaterThanOrEqual(55)
    const lh = handVoicing(am1, 'L').lh
    expect(lh[lh.length - 1]).toBeLessThanOrEqual(64)
    expect(handVoicing(am1, 'both')).toEqual({ lh: [36], rh: [57, 60, 64] }) // Do2 + La3 Do4 Mi4
    expect(cardTips(am1, 'latin', 'L').join(' ')).toMatch(/izquierda\): 5-3-1/)
    expect(cardTips(am1, 'latin', 'R').join(' ')).toMatch(/derecha\): 1-2-5/)
    expect(cardTips(am1, 'latin', 'both').join(' ')).toMatch(/Am\/C/)
  })
})

describe('ortografía de los cifrados', () => {
  it('nombres de grupo coherentes', async () => {
    const { groupSymbols } = await import('../../ui/pages/chords/common')
    const all = CHORD_GROUPS.flatMap(groupSymbols)
    expect(all).toEqual(expect.arrayContaining(['F#', 'C#m', 'F#m', 'Bb', 'Eb', 'Ab', 'Db', 'G#dim7', 'C#dim', 'F#m7b5', 'Bm7b5']))
  })
})
