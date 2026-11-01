import { describe, expect, it } from 'vitest'
import { seeded } from '../daily/plan'
import { pitchClass } from '../music/notes'
import { judgePlayedChord, melodyQuestion, melodyStep, playChordQuestion, readyForNext, recognizeQuestion, startMelody, suggestedLevel, updateEarStat, type EarStat } from './ear'

describe('reconocer', () => {
  it('la respuesta siempre está entre las opciones y suena en el rango del teclado', () => {
    const rng = seeded('ear')
    for (const drill of ['quality', 'inversion', 'interval'] as const)
      for (const level of [1, 2, 3])
        for (let i = 0; i < 40; i++) {
          const q = recognizeQuestion(drill, level, rng)
          expect(q.options.map((o) => o.id)).toContain(q.answer)
          for (const m of q.notes) expect(m >= 36 && m <= 96).toBe(true)
        }
  })
  it('inversiones: la nota grave identifica la inversión y queda siempre en la misma zona', () => {
    const rng = seeded('inv')
    for (let i = 0; i < 60; i++) {
      const q = recognizeQuestion('inversion', 2, rng)
      expect(q.notes[0]).toBeGreaterThanOrEqual(52)
      expect(q.notes[0]).toBeLessThanOrEqual(63)
      const { rootPc, typeId } = q.chord!
      const third = (rootPc + (typeId === 'min' ? 3 : 4)) % 12
      expect(pitchClass(q.notes[0])).toBe([rootPc, third, (rootPc + 7) % 12][Number(q.answer)])
    }
  })
})

describe('tocar de oído', () => {
  it('acorde: vale cualquier octava, pero el bajo debe coincidir', () => {
    const q = { ...playChordQuestion(1, seeded('c')), rootPc: 9, typeId: 'min', inversion: 0, notes: [57, 60, 64] }
    expect(judgePlayedChord([45, 48, 52], q).status).toBe('correct')
    expect(judgePlayedChord([48, 52, 57], q).status).toBe('wrong-inversion')
    expect(judgePlayedChord([57, 61, 64], q).status).toBe('wrong-notes')
    expect(judgePlayedChord([57, 60, 64], q).zoneHint).toBeUndefined()
  })
  it('melodía: longitud por nivel, dentro del rango y sin repetir nota seguida', () => {
    const rng = seeded('mel')
    for (const [level, len] of [
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 6],
    ] as const)
      for (let i = 0; i < 50; i++) {
        const q = melodyQuestion(level, rng)
        expect(q.notes).toHaveLength(len)
        for (let k = 1; k < q.notes.length; k++) expect(q.notes[k]).not.toBe(q.notes[k - 1])
        for (const m of q.notes) expect(m >= 52 && m <= 81).toBe(true)
      }
  })
  it('melodía: solo avanza con la nota correcta, cuenta tropiezos y acepta otra octava', () => {
    const q = { drill: 'play-melody' as const, notes: [60, 62, 64], tonicPc: 0, scaleId: 'major-pentatonic', bpm: 84 }
    let p = startMelody(q)
    p = melodyStep(p, q, 60).progress
    let r = melodyStep(p, q, 65) // error
    expect(r.correct).toBe(false)
    p = r.progress
    expect(p.index).toBe(1)
    p = melodyStep(p, q, 62).progress
    r = melodyStep(p, q, 76) // Mi en otra octava
    expect(r.octave).toBe(true)
    expect(r.progress.done).toBe(true)
    expect(r.progress.errors).toBe(1)
    expect(r.progress.firstTry).toEqual([true, false, true])
  })
})

describe('estadísticas de oído', () => {
  it('recomienda subir de nivel con 8 de las últimas 10', () => {
    let s: EarStat | undefined
    for (const ok of [true, true, false, true, true, true, true, false, true, true]) s = updateEarStat(s, ok)
    expect(readyForNext(s)).toBe(true)
    expect(suggestedLevel({ 'play-melody:1': s! }, 'play-melody')).toBe(2)
    expect(suggestedLevel({}, 'play-melody')).toBe(1)
    expect(s!.best).toBe(4)
  })
})
