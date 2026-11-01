import { describe, expect, it } from 'vitest'
import { alignSamePitch, effectiveWindowsMs, evaluatePerformance, evaluateWaitMode } from './evaluate'
import { defaultEvaluationOptions, TOLERANCE_PRESETS } from './tolerance'
import type { ExpectedNote, PlayedNote } from './types'

let pid = 0
const E = (midi: number, start: number, duration = 0.4, extra: Partial<ExpectedNote> = {}): ExpectedNote => ({ id: `e${midi}-${start}`, midi, start, duration, hand: 'R', ...extra })
const P = (midi: number, start: number, end: number | null = start + 0.4, velocity = 80): PlayedNote => ({ id: `p${pid++}`, midi, start, end, velocity, source: 'simulated' })
const opts = (p = {}) => defaultEvaluationOptions({ tolerance: TOLERANCE_PRESETS.intermediate, ...p })

describe('evaluatePerformance', () => {
  it('interpretación perfecta = 100', () => {
    const exp = [E(60, 0), E(62, 0.5), E(64, 1)]
    const r = evaluatePerformance(exp, [P(60, 0), P(62, 0.5), P(64, 1)], opts())
    expect(r.score).toBe(100)
    expect(r.counts.hits).toBe(3)
    expect(r.bestStreak).toBe(3)
  })

  it('detecta omitidas, adicionales e incorrectas', () => {
    const exp = [E(60, 0), E(62, 0.5), E(64, 1), E(65, 1.5)]
    // 60 ok, 62 → toca 63 (incorrecta), 64 omitida, 65 ok, y una nota extra lejos
    const r = evaluatePerformance(exp, [P(60, 0.01), P(63, 0.5), P(65, 1.5), P(70, 3)], opts())
    expect(r.counts.hits).toBe(2)
    expect(r.counts.wrong).toBe(1)
    expect(r.counts.missed).toBe(1)
    expect(r.counts.extra).toBe(1)
    const byMidi = Object.fromEntries(r.outcomes.map((o) => [o.expected.midi, o.status]))
    expect(byMidi).toEqual({ 60: 'hit', 62: 'wrong', 64: 'missed', 65: 'hit' })
  })

  it('detecta octava equivocada', () => {
    const r = evaluatePerformance([E(60, 0)], [P(72, 0.02)], opts())
    expect(r.outcomes[0].status).toBe('octave')
  })

  it('una nota tocada no cuenta dos veces aunque caiga en dos ventanas', () => {
    const exp = [E(60, 0, 0.1), E(60, 0.2, 0.1)]
    const r = evaluatePerformance(exp, [P(60, 0.1, 0.15)], opts())
    expect(r.counts.hits).toBe(1)
    expect(r.counts.missed).toBe(1)
  })

  it('notas repetidas no se cruzan: el orden se respeta', () => {
    const exp = [E(60, 0, 0.2), E(60, 0.25, 0.2), E(60, 0.5, 0.2)]
    const played = [P(60, 0.05), P(60, 0.28), P(60, 0.52)]
    const pairs = alignSamePitch(exp, played, effectiveWindowsMs(exp, TOLERANCE_PRESETS.beginner))
    expect(pairs.map(([e, p]) => [e.start, p.start])).toEqual([[0, 0.05], [0.25, 0.28], [0.5, 0.52]])
  })

  it('la ventana se limita a la mitad del intervalo entre notas repetidas', () => {
    const exp = [E(60, 0), E(60, 0.2)]
    const w = effectiveWindowsMs(exp, TOLERANCE_PRESETS.beginner)
    expect(w.get(exp[0].id)).toBe(100)
  })

  it('la ventana escala con el tempo dentro de [0,75; 1,5]', () => {
    const exp = [E(60, 0)]
    expect(effectiveWindowsMs(exp, TOLERANCE_PRESETS.intermediate, 1.0).get(exp[0].id)).toBe(225)
    expect(effectiveWindowsMs(exp, TOLERANCE_PRESETS.intermediate, 0.25).get(exp[0].id)).toBe(112.5)
  })

  it('clasifica anticipación y retraso, y la precisión rítmica baja con el error', () => {
    const exp = [E(60, 0), E(62, 1), E(64, 2)]
    const r = evaluatePerformance(exp, [P(60, -0.1), P(62, 1.0), P(64, 2.1)], opts())
    expect(r.outcomes.map((o) => o.timingClass)).toEqual(['early', 'on-time', 'late'])
    expect(r.breakdown.timingScore!).toBeLessThan(1)
    expect(r.timing.meanOffsetMs).toBeCloseTo(0, 5)
    expect(r.score).toBeLessThan(100)
  })

  it('notas fuera de ventana no son aciertos', () => {
    const r = evaluatePerformance([E(60, 0)], [P(60, 0.4)], opts())
    expect(r.counts.hits).toBe(0)
    expect(r.counts.missed).toBe(1)
    expect(r.counts.extra).toBe(1)
  })

  it('evalúa duración solo si está activada', () => {
    const exp = [E(60, 0, 1.0)]
    const short = [P(60, 0, 0.3)]
    const off = evaluatePerformance(exp, short, opts({ evaluateDuration: false }))
    expect(off.score).toBe(100)
    const on = evaluatePerformance(exp, short, opts({ evaluateDuration: true }))
    expect(on.outcomes[0].durationClass).toBe('short')
    expect(on.score).toBeLessThan(100)
    const long = evaluatePerformance(exp, [P(60, 0, 2.5)], opts({ evaluateDuration: true }))
    expect(long.outcomes[0].durationClass).toBe('long')
  })

  it('evalúa acordes: completos, incompletos, con notas extra y simultaneidad', () => {
    const chord = [E(60, 0, 1, { chordId: 'c1' }), E(64, 0, 1, { chordId: 'c1' }), E(67, 0, 1, { chordId: 'c1' })]
    const chord2 = [E(65, 1, 1, { chordId: 'c2' }), E(69, 1, 1, { chordId: 'c2' }), E(72, 1, 1, { chordId: 'c2' })]
    const played = [P(60, 0), P(64, 0.01), P(67, 0.02), P(65, 1), P(69, 1.0), P(71, 1.01)]
    const r = evaluatePerformance([...chord, ...chord2], played, opts())
    expect(r.chords.total).toBe(2)
    expect(r.chords.complete).toBe(1)
    expect(r.chords.outcomes[0].simultaneous).toBe(true)
    expect(r.chords.outcomes[1].complete).toBe(false)
    expect(r.chords.outcomes[1].missingMidis).toEqual([72])
    expect(r.chords.outcomes[1].extraMidis).toEqual([71])
  })

  it('acorde arpegiado (no simultáneo) se marca como no simultáneo', () => {
    const chord = [E(60, 0, 1, { chordId: 'c' }), E(64, 0, 1, { chordId: 'c' }), E(67, 0, 1, { chordId: 'c' })]
    const r = evaluatePerformance(chord, [P(60, -0.06), P(64, 0), P(67, 0.07)], opts())
    expect(r.chords.outcomes[0].complete).toBe(true)
    expect(r.chords.outcomes[0].simultaneous).toBe(false)
  })

  it('fórmula: las adicionales penalizan con λ', () => {
    const exp = [E(60, 0), E(62, 1)]
    const r = evaluatePerformance(exp, [P(60, 0), P(62, 1), P(80, 0.5), P(81, 0.6)], opts({ extraPenalty: 0.5 }))
    expect(r.score).toBeCloseTo(66.7, 1)
  })

  it('estadísticas por sección', () => {
    const exp = [E(60, 0), E(62, 1), E(64, 2), E(65, 3)]
    const r = evaluatePerformance(exp, [P(60, 0), P(62, 1)], opts({ sections: [{ id: 'a', name: 'A', start: 0, end: 2 }, { id: 'b', name: 'B', start: 2, end: 4 }] }))
    expect(r.sections.map((s) => s.accuracy)).toEqual([1, 0])
  })

  it('sin notas esperadas ni tocadas = 100; solo extras = 0', () => {
    expect(evaluatePerformance([], [], opts()).score).toBe(100)
    expect(evaluatePerformance([], [P(60, 0)], opts()).score).toBe(0)
  })
})

describe('evaluateWaitMode', () => {
  it('penaliza pulsaciones erróneas', () => {
    const r = evaluateWaitMode([
      { expected: [E(60, 0)], wrongPresses: [], reactionMs: 500 },
      { expected: [E(62, 1)], wrongPresses: [61], reactionMs: 900 },
    ])
    expect(r.score).toBeCloseTo(66.7, 1)
    expect(r.cleanSteps).toBe(1)
  })
})
