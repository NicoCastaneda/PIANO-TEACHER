import { describe, expect, it } from 'vitest'
import { validateArrangement } from '../songs/validate'
import type { AttemptRecord } from '../storage/db'
import { buildDailyPlan, buildSpec, type ExerciseSpec } from './plan'

const attempt = (p: Partial<AttemptRecord>): AttemptRecord => ({
  id: Math.random().toString(36),
  at: Date.now(),
  kind: 'exercise',
  refId: 'x',
  title: 'X',
  mode: 'timed',
  score: 80,
  noteAccuracy: 0.9,
  timingScore: 0.9,
  durationScore: null,
  meanOffsetMs: 0,
  stdDevMs: 20,
  counts: { expected: 20, hits: 18, wrong: 1, octave: 0, missed: 1, extra: 0, early: 0, late: 0 },
  chords: { total: 0, complete: 0, simultaneous: 0 },
  bestStreak: 10,
  practiceSec: 60,
  skills: [],
  tolerance: 'beginner',
  tempoFactor: 1,
  hands: 'R',
  input: 'midi',
  ...p,
})

describe('práctica de hoy', () => {
  it('sin datos: grupo recomendado, calentamiento, acompañamiento, oído y algo nuevo', () => {
    const input = { attempts: [], chordStats: {}, earStats: {}, compSongIds: ['twinkle'], date: '2026-11-01' }
    const plan = buildDailyPlan(input)
    expect(plan.steps.map((s) => s.id)).toEqual(['cards', 'weak', 'section', 'ear', 'new'])
    const [cards, weak, section, ear] = plan.steps
    expect(cards.kind === 'cards' && cards.cardIds.length).toBeGreaterThan(0)
    expect(weak.kind).toBe('exercise')
    expect(weak.reason).toMatch(/suficientes/)
    expect(section.kind).toBe('comp')
    expect(ear.kind === 'ear' && ear.drill).toBe('play-melody')
    // determinista para la misma fecha y los mismos datos
    expect(buildDailyPlan(input)).toEqual(plan)
  })

  it('usa los datos: tarjetas de caja baja primero, punto débil y sección más floja', () => {
    const chordStats = Object.fromEntries(['0:maj:0', '7:maj:0', '5:maj:0', '9:min:0', '2:min:0'].map((id, i) => [id, { box: i % 3, seen: 3, correct: 1, wrong: 2, avgMs: 3000, lastSeen: i }]))
    const late = Array.from({ length: 4 }, () => attempt({ chordChangeLagMs: 140, noteAccuracy: 0.92 }))
    const song = attempt({
      kind: 'song',
      refId: 'twinkle-beginner',
      title: 'Estrellita · Principiante',
      sections: [
        { id: 'a', name: 'A', accuracy: 0.9 },
        { id: 'b', name: 'B', accuracy: 0.5 },
      ],
    })
    const plan = buildDailyPlan({ attempts: [...late, song], chordStats, earStats: {}, compSongIds: [], date: '2026-11-02' })
    const [cards, weak, section] = plan.steps
    expect(cards.kind === 'cards' && cards.cardIds[0]).toBe('0:maj:0')
    expect(weak.kind === 'exercise' && weak.spec.type).toBe('progression')
    expect(weak.reason).toMatch(/140 ms/)
    expect(section).toMatchObject({ kind: 'section', songId: 'twinkle', level: 'beginner', sectionId: 'b' })
  })

  it('el oído elige el ejercicio con peor precisión reciente', () => {
    const stat = (recent: boolean[]) => ({ seen: recent.length, correct: recent.filter(Boolean).length, streak: 0, best: 0, recent, lastAt: 0 })
    const plan = buildDailyPlan({
      attempts: [],
      chordStats: {},
      earStats: { 'play-melody:1': stat([true, true, true, true, false, true]), 'play-chord:1': stat([false, false, true, false, false]) },
      compSongIds: [],
      date: '2026-11-03',
    })
    const ear = plan.steps.find((s) => s.id === 'ear')!
    expect(ear.kind === 'ear' && ear.drill).toBe('play-chord')
  })

  it('todos los ejercicios del plan generan arreglos válidos', () => {
    const specs: ExerciseSpec[] = [
      { type: 'progression', degrees: [0, 4, 5, 3], tonicMidi: 60, bpm: 66, lhStyle: 'root' },
      { type: 'rhythm', pattern: [1, 1, 0.5, 0.5, 1], bpm: 72, name: 'x' },
      { type: 'notes', midis: [60, 62, 64] },
      { type: 'scale', rootMidi: 67, scaleId: 'major', bpm: 63 },
      { type: 'arpeggio', rootMidi: 60, typeId: 'maj', bpm: 66 },
    ]
    for (const spec of specs) expect(validateArrangement(buildSpec(spec)).ok).toBe(true)
  })
})
