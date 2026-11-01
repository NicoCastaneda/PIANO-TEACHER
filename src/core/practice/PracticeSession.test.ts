import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El motor de audio se sustituye: aquí se prueba la lógica de reloj y evaluación.
const scheduled: { midi: number; at: number }[] = []
vi.mock('../audio/AudioEngine', () => ({
  audioEngine: {
    start: async () => {},
    scheduleNote: (midi: number, at: number) => scheduled.push({ midi, at }),
    scheduleClick: () => {},
    stopAll: () => {},
  },
}))

const { PracticeSession } = await import('./PracticeSession')
const { inputBus } = await import('../midi/inputBus')
const { melodyExercise } = await import('./exercises')
const { chordSeq } = await import('../songs/notation')
const { defaultEvaluationOptions, TOLERANCE_PRESETS } = await import('../scoring/tolerance')

const evaluation = defaultEvaluationOptions({ tolerance: TOLERANCE_PRESETS.intermediate })
// 4 negras a 60 BPM (1 s cada una), mano derecha + un bajo en la izquierda
const arrangement = melodyExercise('t', 'Prueba', 'C4 D4 E4 F4', { bpm: 60, lh: 'C3:4' })

function press(midi: number, at: number, dur = 0.5, source: 'midi' | 'simulated' = 'midi') {
  inputBus.emit({ type: 'noteon', note: midi, velocity: 90, channel: 1, time: at, source })
  inputBus.emit({ type: 'noteoff', note: midi, velocity: 64, channel: 1, time: at + dur * 1000, source })
}

describe('PracticeSession', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] })
    scheduled.length = 0
  })
  afterEach(() => {
    vi.useRealTimers()
    inputBus.releaseAll()
  })

  it('modo con tempo: evalúa con el reloj de la sesión y compensa la latencia', async () => {
    const s = new PracticeSession({ arrangement, mode: 'timed', hands: 'R', tempoFactor: 1, loop: false, metronome: false, countInBars: 0, playAccompaniment: true, latencyMs: 40, evaluation })
    let result: Awaited<ReturnType<NonNullable<typeof s.onFinish>>> | undefined
    const done = new Promise<void>((res) => (s.onFinish = (r) => ((result = r as never), res())))
    await s.start()
    const t0 = performance.now() + 80 // la sesión arranca con 80 ms de margen
    // el usuario toca exactamente a tiempo, pero sus eventos llegan 40 ms tarde (latencia del sistema)
    ;[60, 62, 64, 65].forEach((m, i) => press(m, t0 + i * 1000 + 40))
    vi.advanceTimersByTime(5000)
    await done
    const r = result as unknown as import('./PracticeSession').SessionResult
    expect(r.evaluation!.counts.hits).toBe(4)
    expect(Math.abs(r.evaluation!.timing.meanOffsetMs!)).toBeLessThan(1)
    expect(r.score).toBe(100)
    expect(r.input).toBe('midi')
    // la mano izquierda (no practicada) se reprodujo como acompañamiento
    expect(scheduled.some((n) => n.midi === 48)).toBe(true)
  })

  it('modo espera: el reloj se detiene hasta tocar la nota correcta y cuenta los errores', async () => {
    const s = new PracticeSession({ arrangement, mode: 'wait', hands: 'R', tempoFactor: 1, loop: false, metronome: false, countInBars: 0, playAccompaniment: false, latencyMs: 0, evaluation })
    await s.start()
    vi.advanceTimersByTime(3000)
    expect(s.status).toBe('waiting')
    expect(s.songTime()).toBeCloseTo(0, 5)
    press(61, performance.now()) // error
    press(60, performance.now())
    vi.advanceTimersByTime(1100)
    expect(s.stepIdx).toBe(1)
    for (const m of [62, 64, 65]) {
      press(m, performance.now())
      vi.advanceTimersByTime(1100)
    }
    vi.advanceTimersByTime(2000)
    expect(s.status).toBe('finished')
    expect(s.lastResult!.wait!.wrongPresses).toBe(1)
    expect(s.lastResult!.wait!.cleanSteps).toBe(3)
  })

  it('modo acompañar: la app toca la melodía y se evalúa la armonía de cada cambio, en cualquier posición', async () => {
    const song = melodyExercise('c', 'Comp', 'C4 D4 E4 F4', { bpm: 60, lh: 'C3:4', chords: chordSeq('C:2 G:2') })
    const s = new PracticeSession({ arrangement: song, mode: 'comp', hands: 'L', tempoFactor: 1, loop: false, metronome: false, countInBars: 0, playAccompaniment: true, latencyMs: 0, evaluation })
    await s.start()
    const t0 = performance.now() + 80
    ;[48, 52, 55].forEach((m) => press(m, t0 + 10, 1.5)) // C en estado fundamental
    ;[47, 50, 55].forEach((m) => press(m, t0 + 2040, 1.5)) // G/B: otra posición, también vale
    vi.advanceTimersByTime(5000)
    const r = s.lastResult!
    expect(r.mode).toBe('comp')
    expect(r.comping!.outcomes.map((o) => o.status)).toEqual(['ok', 'ok'])
    expect(r.score).toBe(100)
    expect(scheduled.some((n) => n.midi === 60)).toBe(true) // melodía reproducida
    expect(scheduled.some((n) => n.midi === 48)).toBe(false) // la izquierda la toca el alumno
  })

  it('los eventos simulados se identifican como tales en el resultado', async () => {
    const s = new PracticeSession({ arrangement, mode: 'timed', hands: 'R', tempoFactor: 1, loop: false, metronome: false, countInBars: 0, playAccompaniment: false, latencyMs: 0, evaluation })
    await s.start()
    const t0 = performance.now() + 80
    press(60, t0, 0.5, 'simulated')
    vi.advanceTimersByTime(6000)
    expect(s.lastResult!.input).toBe('simulated')
  })

  it('el tempo de práctica escala los tiempos esperados y el retroceso reinicia el intento', async () => {
    const s = new PracticeSession({ arrangement, mode: 'timed', hands: 'R', tempoFactor: 0.5, loop: false, metronome: false, countInBars: 0, playAccompaniment: false, latencyMs: 0, evaluation })
    expect(s.timeline.expected.map((n) => n.start)).toEqual([0, 2, 4, 6])
    await s.start()
    press(60, performance.now() + 80)
    vi.advanceTimersByTime(3000)
    expect(s.played.length).toBe(1)
    s.seek(2)
    expect(s.played.length).toBe(0)
    expect(s.songTime()).toBeCloseTo(2, 1)
  })
})
