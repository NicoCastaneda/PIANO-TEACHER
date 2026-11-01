import { beforeEach, describe, expect, it } from 'vitest'
import { practiceStreak, recommendations, recommendedDifficulty, skillStats, summary } from '../progress/stats'
import { BUILTIN_SONGS } from '../songs/library'
import { _resetDbForTests, exportAll, importAll, store, type AttemptRecord } from './db'

const DAY = 86400000
const attempt = (p: Partial<AttemptRecord> = {}): AttemptRecord => ({
  id: Math.random().toString(36).slice(2),
  at: Date.now(),
  kind: 'exercise',
  refId: 'x',
  title: 'Ejercicio',
  mode: 'timed',
  score: 80,
  noteAccuracy: 0.9,
  timingScore: 0.8,
  durationScore: null,
  meanOffsetMs: 10,
  stdDevMs: 30,
  counts: { expected: 20, hits: 18, wrong: 1, octave: 0, missed: 1, extra: 0, early: 2, late: 3 },
  chords: { total: 0, complete: 0, simultaneous: 0 },
  bestStreak: 10,
  practiceSec: 60,
  skills: ['scales'],
  tolerance: 'beginner',
  tempoFactor: 1,
  hands: 'R',
  input: 'midi',
  ...p,
})

describe('almacenamiento (IndexedDB)', () => {
  beforeEach(async () => {
    await _resetDbForTests()
  })

  it('guarda y recupera intentos, lecciones y canciones', async () => {
    await store.addAttempt(attempt({ id: 'a1', score: 70 }))
    await store.addAttempt(attempt({ id: 'a2', score: 90, refId: 'y' }))
    expect((await store.attempts()).map((a) => a.id)).toEqual(expect.arrayContaining(['a1', 'a2']))
    expect((await store.attemptsFor('y')).length).toBe(1)
    await store.recordLesson('l1', 60, false)
    const p = await store.recordLesson('l1', 85, true)
    expect(p).toMatchObject({ attempts: 2, bestScore: 85 })
    expect(p.completedAt).not.toBeNull()
    await store.saveSong(BUILTIN_SONGS[0])
    expect((await store.songs())[0].id).toBe(BUILTIN_SONGS[0].id)
    await store.setKV('settings', { theme: 'light' })
    expect(await store.getKV('settings')).toEqual({ theme: 'light' })
  })

  it('exporta e importa todos los datos (y rechaza archivos ajenos)', async () => {
    await store.addAttempt(attempt({ id: 'z' }))
    await store.recordLesson('l2', 90, true)
    const dump = await exportAll()
    await _resetDbForTests()
    expect((await store.attempts()).length).toBe(0)
    const r = await importAll(JSON.parse(JSON.stringify(dump)))
    expect(r).toMatchObject({ attempts: 1, lessons: 1 })
    expect((await store.attempts())[0].id).toBe('z')
    await expect(importAll({ foo: 1 })).rejects.toThrow()
  })
})

describe('estadísticas y recomendaciones (solo con datos reales)', () => {
  it('sin datos no se inventa nada', () => {
    expect(summary([]).avgScore).toBeNull()
    expect(recommendations([])).toEqual([])
    expect(skillStats([])).toEqual([])
    expect(practiceStreak([])).toEqual({ current: 0, best: 0 })
  })
  it('racha de días consecutivos', () => {
    const now = Date.now()
    const list = [attempt({ at: now }), attempt({ at: now - DAY }), attempt({ at: now - 2 * DAY }), attempt({ at: now - 5 * DAY })]
    expect(practiceStreak(list, now).current).toBe(3)
  })
  it('recomienda cambios de acorde si las notas son buenas pero llega tarde a los cambios', () => {
    const list = Array.from({ length: 4 }, () => attempt({ noteAccuracy: 0.95, chordChangeLagMs: 120, skills: ['progressions'] }))
    const recs = recommendations(list)
    expect(recs[0].id).toBe('chord-changes')
    expect(recs[0].reason).toMatch(/120 ms/)
  })
  it('recomienda ritmo si la precisión rítmica es baja', () => {
    const list = Array.from({ length: 4 }, () => attempt({ noteAccuracy: 0.9, timingScore: 0.5, meanOffsetMs: 80 }))
    expect(recommendations(list).some((r) => r.id === 'timing' && /retrasando/.test(r.title))).toBe(true)
  })
  it('dificultad recomendada según resultados', () => {
    expect(recommendedDifficulty([]).level).toBe('beginner')
    const strong = Array.from({ length: 5 }, () => attempt({ score: 92, hands: 'both', skills: ['two-hands'] }))
    expect(recommendedDifficulty(strong).level).toBe('advanced')
  })
  it('nivel de habilidad con media móvil y dominio', () => {
    const list = [70, 88, 90, 95].map((s, i) => attempt({ score: s, at: i, skills: ['chords'] }))
    const st = skillStats(list)[0]
    expect(st.skill).toBe('chords')
    expect(st.mastered).toBe(true)
  })
})
