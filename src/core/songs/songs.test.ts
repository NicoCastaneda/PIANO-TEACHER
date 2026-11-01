import { describe, expect, it } from 'vitest'
import { ALL_LESSONS, lessonStates, nextLesson } from '../curriculum/curriculum'
import { inScaleRatio } from '../practice/exercises'
import { fitToRange, makeDifficultyVersion, toTimeline } from './adapt'
import { BUILTIN_SONGS } from './library'
import { seq } from './notation'
import type { Arrangement } from './schema'
import { validateArrangement } from './validate'

const base = (notes: Arrangement['notes'], patch: Partial<Arrangement> = {}): Arrangement => ({
  id: 't',
  title: 'T',
  bpm: 120,
  timeSignature: [4, 4],
  difficulty: 'advanced',
  arrangementType: 'ai-generated',
  confidence: 0.5,
  sources: [],
  limitations: [],
  adaptations: [],
  sections: [{ id: 's', name: 'S', start: 0, end: 8 }],
  chords: [],
  notes,
  ...patch,
})

describe('validación de arreglos', () => {
  it('rechaza estructuras que no cumplen el esquema (texto libre, campos ausentes)', () => {
    expect(validateArrangement('C D E F G').ok).toBe(false)
    expect(validateArrangement({ title: 'x' }).ok).toBe(false)
    expect(validateArrangement(base([{ midi: 60, start: 0, duration: 0, velocity: 80, hand: 'R' }])).ok).toBe(false)
  })
  it('detecta notas fuera del rango del CT-S300', () => {
    const r = validateArrangement(base([{ midi: 100, start: 0, duration: 1, velocity: 80, hand: 'R' }]))
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.code === 'out-of-range')).toBe(true)
  })
  it('ordena eventos desordenados con aviso', () => {
    const r = validateArrangement(base([{ midi: 62, start: 1, duration: 1, velocity: 80, hand: 'R' }, { midi: 60, start: 0, duration: 1, velocity: 80, hand: 'R' }]))
    expect(r.ok).toBe(true)
    expect(r.issues.some((i) => i.code === 'unsorted')).toBe(true)
    expect(r.arrangement!.notes[0].midi).toBe(60)
  })
  it('detecta cifrados de acorde inválidos y secciones incoherentes', () => {
    const r = validateArrangement(base([{ midi: 60, start: 0, duration: 1, velocity: 80, hand: 'R' }], { chords: [{ start: 0, duration: 4, symbol: 'Xyz' }], sections: [{ id: 's', name: 'S', start: 4, end: 2 }] }))
    expect(r.issues.some((i) => i.code === 'invalid-chord')).toBe(true)
    expect(r.issues.some((i) => i.code === 'section')).toBe(true)
  })
  it('detecta partes intocables para una mano', () => {
    const notes = [36, 40, 43, 48, 52, 55].map((m) => ({ midi: m, start: 0, duration: 1, velocity: 80, hand: 'L' as const }))
    const r = validateArrangement(base(notes))
    expect(r.issues.some((i) => i.code === 'unplayable')).toBe(true)
  })
  it('corrige solapamientos de la misma tecla', () => {
    const r = validateArrangement(base([{ midi: 60, start: 0, duration: 2, velocity: 80, hand: 'R' }, { midi: 60, start: 1, duration: 1, velocity: 80, hand: 'R' }]))
    expect(r.arrangement!.notes[0].duration).toBe(1)
  })
})

describe('adaptación al rango y a la dificultad', () => {
  it('transpone una mano entera por octavas para que quepa', () => {
    const a = base(seq('C7 E7 G7', 'R').map((n) => ({ ...n, midi: n.midi + 12 })))
    const { arrangement, changes } = fitToRange(a)
    expect(arrangement.notes.every((n) => n.midi <= 96 && n.midi >= 36)).toBe(true)
    expect(changes.length).toBe(1)
    expect(validateArrangement(arrangement).ok).toBe(true)
  })
  it('crea versiones principiante/intermedia/avanzada válidas', () => {
    for (const s of BUILTIN_SONGS) {
      for (const lvl of ['beginner', 'intermediate', 'advanced'] as const) {
        const v = makeDifficultyVersion(s, lvl)
        const r = validateArrangement(v)
        expect(r.ok, `${s.id}/${lvl}: ${r.issues.map((i) => i.message).join('; ')}`).toBe(true)
        if (lvl === 'beginner') expect(v.notes.every((n) => n.hand === 'R')).toBe(true)
      }
    }
  })
  it('timeline: escala por tempo y separa la mano no practicada', () => {
    const song = BUILTIN_SONGS.find((s) => s.id === 'ode-to-joy')!
    const t = toTimeline(song, { hands: 'R', tempoFactor: 0.5 })
    expect(t.expected.every((n) => n.hand === 'R')).toBe(true)
    expect(t.accompaniment.every((n) => n.hand === 'L')).toBe(true)
    expect(t.beatSeconds).toBeCloseTo(1.2, 5)
    const sec = toTimeline(song, { hands: 'both', tempoFactor: 1, fromBeat: 16, toBeat: 32 })
    expect(sec.expected[0].start).toBeCloseTo(0, 5)
    expect(sec.lengthSec).toBeCloseTo(9.6, 5)
  })
})

describe('contenido incorporado', () => {
  it('todas las canciones de la biblioteca son válidas y tocables en el CT-S300', () => {
    for (const s of BUILTIN_SONGS) {
      const r = validateArrangement(s)
      expect(r.ok, `${s.id}: ${r.issues.map((i) => i.message).join('; ')}`).toBe(true)
      expect(s.arrangementType).not.toBe('authorized-transcription')
    }
  })
  it('todos los ejercicios del programa generan arreglos válidos', () => {
    for (const l of ALL_LESSONS) {
      if (l.exercise.songRef) {
        expect(BUILTIN_SONGS.some((s) => s.id === l.exercise.songRef!.songId), l.id).toBe(true)
        continue
      }
      const a = l.exercise.build()
      const r = validateArrangement(a)
      expect(r.ok, `${l.id}: ${r.issues.filter((i) => i.level === 'error').map((i) => i.message).join('; ')}`).toBe(true)
    }
  })
  it('desbloqueo progresivo de lecciones', () => {
    const none = lessonStates(new Set())
    expect(none['l1-keyboard']).toBe('available')
    expect(none['l1-white']).toBe('locked')
    expect(none['l2-steps']).toBe('locked')
    const st = lessonStates(new Set(['l1-keyboard']))
    expect(st['l1-white']).toBe('available')
    expect(nextLesson(new Set(['l1-keyboard']))!.id).toBe('l1-white')
  })
  it('improvisación: proporción de notas dentro de la escala', () => {
    expect(inScaleRatio([57, 60, 62, 64, 67, 61], 9, 'minor-pentatonic')).toBeCloseTo(5 / 6, 5)
  })
})
