import { describe, expect, it } from 'vitest'
import { evaluateComping, type CompChord } from './comping'
import type { PlayedNote } from './types'

// C – G/B – Am – F, un acorde por segundo
const chords: CompChord[] = [
  { symbol: 'C', start: 0, duration: 1, pcs: [0, 4, 7] },
  { symbol: 'G/B', start: 1, duration: 1, pcs: [7, 11, 2] },
  { symbol: 'Am', start: 2, duration: 1, pcs: [9, 0, 4] },
  { symbol: 'F', start: 3, duration: 1, pcs: [5, 9, 0] },
]
let id = 0
const n = (midi: number, start: number): PlayedNote => ({ id: `p${++id}`, midi, start, end: start + 0.4, velocity: 80, source: 'midi' })
const block = (notes: number[], at: number) => notes.map((m) => n(m, at))

describe('acompañamiento con cifrados', () => {
  it('cualquier posición del acorde vale: 100 si las notas son del acorde y llegan a tiempo', () => {
    const played = [...block([48, 52, 55], 0.01), ...block([47, 50, 55], 1.02), ...block([45, 48, 52], 2), ...block([41, 45, 48], 3.03)]
    const r = evaluateComping(chords, played, { windowMs: 150 })
    expect(r.outcomes.map((o) => o.status)).toEqual(['ok', 'ok', 'ok', 'ok'])
    expect(r.score).toBe(100)
    expect(r.bassAccuracy).toBe(1)
    // otra inversión (C/E en lugar de C) también vale en armonía; el bajo solo informa
    const inv = evaluateComping(chords.slice(0, 1), block([52, 55, 60], 0), { windowMs: 150 })
    expect(inv.outcomes[0].status).toBe('ok')
    expect(inv.outcomes[0].bassOk).toBe(false)
    expect(inv.score).toBe(100)
  })

  it('detecta cambios tarde, notas fuera del acorde y acordes omitidos', () => {
    // G/B tarde, Am tocado como Bbm (fuera del acorde), F sin tocar
    const played = [...block([48, 52, 55], 0), ...block([47, 50, 55], 1.4), ...block([46, 49, 53], 2)]
    const r = evaluateComping(chords, played, { windowMs: 150 })
    expect(r.outcomes.map((o) => o.status)).toEqual(['ok', 'late', 'wrong', 'missed'])
    expect(r.counts).toMatchObject({ ok: 1, late: 1, wrong: 1, missed: 1, chords: 4 })
    expect(r.outcomes[1].offsetMs).toBe(400)
    expect(r.meanLagMs).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(60)
  })

  it('una anticipación pequeña cuenta para el acorde nuevo, no como nota mala del anterior', () => {
    const played = [...block([48, 52, 55], 0), ...block([47, 50, 55], 0.9)]
    const r = evaluateComping(chords.slice(0, 2), played, { windowMs: 150 })
    expect(r.outcomes[0].status).toBe('ok')
    expect(r.outcomes[0].notes).toEqual([48, 52, 55])
    expect(r.outcomes[1].status).toBe('ok')
    expect(r.outcomes[1].offsetMs).toBe(-100)
  })

  it('un acorde repetido seguido (C C) es uno solo: mantenerlo no cuenta como omitido', () => {
    const cc: CompChord[] = [
      { symbol: 'C', start: 0, duration: 1, pcs: [0, 4, 7] },
      { symbol: 'C', start: 1, duration: 1, pcs: [0, 4, 7] },
      { symbol: 'F', start: 2, duration: 1, pcs: [5, 9, 0] },
    ]
    const r = evaluateComping(cc, [...block([48, 52, 55], 0), ...block([48, 53, 57], 2)], { windowMs: 150 })
    expect(r.outcomes.map((o) => `${o.symbol}:${o.status}`)).toEqual(['C:ok', 'F:ok'])
    expect(r.score).toBe(100)
  })

  it('solo cuentan los ataques: un arpegio dentro del acorde es armonía perfecta', () => {
    const played = [n(48, 0), n(52, 0.5), n(55, 0.75)]
    const r = evaluateComping(chords.slice(0, 1), played, { windowMs: 150 })
    expect(r.outcomes[0].notes).toHaveLength(3)
    expect(r.harmony).toBe(1)
  })
})
