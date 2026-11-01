import { audioEngine } from '../audio/AudioEngine'
import { inputBus } from '../midi/inputBus'
import type { InputSource, MusicEvent } from '../midi/types'
import { evaluateComping, type CompingResult } from '../scoring/comping'
import { tempoScale } from '../scoring/tolerance'
import { effectiveWindowsMs, evaluatePerformance, evaluateWaitMode, type WaitStepRecord } from '../scoring/evaluate'
import type { EvaluationOptions, EvaluationResult, ExpectedNote, PlayedNote } from '../scoring/types'
import { toTimeline, type Timeline } from '../songs/adapt'
import { clickInterval, type Arrangement } from '../songs/schema'
import { inScaleRatio } from './exercises'

/**
 * SESIÓN DE PRÁCTICA
 *
 * Reloj: tiempo de canción (s, a tempo de práctica) = anclaSong + (performance.now() − anclaPerf)/1000.
 * Ese mismo reloj se usa para:
 *   - programar el audio (convertido al reloj del AudioContext en AudioEngine.perfToAudio)
 *   - enviar MIDI al Casio con marca de tiempo (Web MIDI usa el reloj de performance.now())
 *   - situar los eventos MIDI recibidos (event.timeStamp también es performance.now())
 *   - dibujar las notas descendentes
 * La compensación de latencia (calibración) se resta a los eventos de entrada.
 */

/** comp = acompañar con cifrados: la app toca la melodía y se evalúa la armonía (scoring/comping.ts) */
export type SessionMode = 'wait' | 'timed' | 'improv' | 'listen' | 'comp'
export type SessionStatus = 'idle' | 'countin' | 'playing' | 'waiting' | 'paused' | 'finished'
export type AssistLevel = 'full' | 'reduced' | 'none'

export interface SessionConfig {
  arrangement: Arrangement
  mode: SessionMode
  hands: 'both' | 'R' | 'L'
  tempoFactor: number
  fromBeat?: number
  toBeat?: number
  loop: boolean
  metronome: boolean
  countInBars: number
  playAccompaniment: boolean
  evaluation: EvaluationOptions
  latencyMs: number
  improv?: { rootPc: number; scaleId: string; bars: number }
}

export type LiveJudgment = 'hit' | 'wrong' | 'extra' | 'missed'

export interface LiveFlash {
  midi: number
  kind: LiveJudgment
  at: number
}

export interface SessionResult {
  mode: SessionMode
  evaluation?: EvaluationResult
  wait?: ReturnType<typeof evaluateWaitMode>
  improv?: { score: number; inScale: number; notes: number; formula: string }
  comping?: CompingResult
  score: number
  practiceSec: number
  played: PlayedNote[]
  expected: ExpectedNote[]
  timeline: Timeline
  input: 'midi' | 'mouse' | 'computer-keyboard' | 'simulated' | 'mixed'
  chordChangeLagMs: number | null
  /** inicio (s) del tramo evaluado: los tiempos de `evaluation` son relativos a él */
  evalFrom: number
}

type Listener = () => void

let playedCounter = 0

export class PracticeSession {
  cfg: SessionConfig
  timeline!: Timeline
  status: SessionStatus = 'idle'
  private anchorPerf = 0
  private anchorSong = 0
  private frozenSong = 0
  private timer: number | null = null
  private scheduledUntil = -Infinity
  private nextAccIdx = 0
  private nextClick = 0
  private unsub: (() => void) | null = null
  private listeners = new Set<Listener>()
  private windows = new Map<string, number>()
  private startedAtPerf = 0
  private evalFrom = 0

  played: PlayedNote[] = []
  private openPlayed = new Map<number, PlayedNote>()
  /** estado en vivo de cada nota esperada */
  live = new Map<string, LiveJudgment>()
  flashes: LiveFlash[] = []
  combo = 0
  bestCombo = 0
  sources = new Set<InputSource>()

  // modo espera
  steps: ExpectedNote[][] = []
  stepIdx = 0
  private stepPressed = new Set<number>()
  private stepWrong: number[] = []
  private stepActivatedAt = 0
  private waitRecords: WaitStepRecord[] = []

  lastResult: SessionResult | null = null
  onFinish?: (r: SessionResult) => void

  constructor(cfg: SessionConfig) {
    this.cfg = cfg
    this.rebuild()
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notify() {
    for (const l of this.listeners) l()
  }

  /** Recalcula la línea de tiempo (cambio de tempo, manos o sección). */
  private rebuild() {
    const c = this.cfg
    this.timeline = toTimeline(c.arrangement, { hands: c.mode === 'listen' ? 'both' : c.hands, tempoFactor: c.tempoFactor, fromBeat: c.fromBeat, toBeat: c.toBeat })
    if (c.mode === 'listen') {
      this.timeline = { ...this.timeline, accompaniment: [...this.timeline.expected, ...this.timeline.accompaniment].sort((a, b) => a.start - b.start), expected: [] }
    }
    if (c.mode === 'improv') {
      this.timeline = { ...this.timeline, accompaniment: [...this.timeline.expected, ...this.timeline.accompaniment].sort((a, b) => a.start - b.start), expected: [] }
    }
    this.windows = effectiveWindowsMs(this.timeline.expected, c.evaluation.tolerance, this.timeline.beatSeconds)
    // pasos del modo espera: notas que empiezan juntas (±30 ms)
    const steps: ExpectedNote[][] = []
    for (const n of this.timeline.expected) {
      const last = steps[steps.length - 1]
      if (last && Math.abs(last[0].start - n.start) < 0.03) last.push(n)
      else steps.push([n])
    }
    this.steps = steps
  }

  update(patch: Partial<SessionConfig>) {
    const wasRunning = this.status === 'playing' || this.status === 'countin' || this.status === 'waiting'
    this.stop(false)
    this.cfg = { ...this.cfg, ...patch }
    this.rebuild()
    this.resetAttempt(0)
    this.frozenSong = this.countInSec() > 0 ? -this.countInSec() : 0
    this.notify()
    if (wasRunning) void this.start()
  }

  get beatSec() {
    return this.timeline.beatSeconds
  }

  countInSec() {
    const ts = this.cfg.arrangement.timeSignature
    return this.cfg.countInBars * ts[0] * clickInterval(ts) * this.beatSec
  }

  /** Tiempo de canción actual (s). Negativo durante la cuenta previa. */
  songTime(perf = performance.now()): number {
    if (this.status === 'playing' || this.status === 'countin') return this.anchorSong + (perf - this.anchorPerf) / 1000
    return this.frozenSong
  }

  private perfAt(songSec: number) {
    return this.anchorPerf + (songSec - this.anchorSong) * 1000
  }

  private resetAttempt(fromSong: number) {
    this.played = []
    this.openPlayed.clear()
    this.live.clear()
    this.flashes = []
    this.combo = 0
    this.bestCombo = 0
    this.sources.clear()
    this.evalFrom = fromSong
    this.waitRecords = []
    this.stepIdx = this.steps.findIndex((s) => s[0].start >= fromSong - 1e-6)
    if (this.stepIdx < 0) this.stepIdx = this.steps.length
    this.stepPressed.clear()
    this.stepWrong = []
    this.lastResult = null
  }

  async start() {
    await audioEngine.start()
    if (this.status === 'playing' || this.status === 'countin') return
    const now = performance.now() + 80 // pequeño margen para programar el primer evento
    if (this.status === 'idle' || this.status === 'finished') {
      this.resetAttempt(0)
      this.frozenSong = -this.countInSec()
      this.startedAtPerf = now
    }
    if (this.status === 'paused' && this.frozenSong >= 0 && this.countInSec() > 0) {
      // al reanudar, un compás de cuenta previa para volver a entrar a tiempo
      this.frozenSong = Math.max(-this.countInSec(), this.frozenSong - this.countInSec())
    }
    this.anchorPerf = now
    this.anchorSong = this.frozenSong
    this.status = this.anchorSong < 0 ? 'countin' : 'playing'
    this.scheduledUntil = this.anchorSong
    this.nextAccIdx = this.timeline.accompaniment.findIndex((n) => n.start >= this.anchorSong - 1e-6)
    if (this.nextAccIdx < 0) this.nextAccIdx = this.timeline.accompaniment.length
    const ci = clickInterval(this.cfg.arrangement.timeSignature) * this.beatSec
    this.nextClick = Math.ceil((this.anchorSong - 1e-6) / ci) * ci
    if (!this.unsub) this.unsub = inputBus.subscribe(this.onInput)
    if (this.timer === null) this.timer = window.setInterval(this.tick, 20)
    this.tick()
    this.notify()
  }

  pause() {
    if (this.status !== 'playing' && this.status !== 'countin' && this.status !== 'waiting') return
    this.frozenSong = Math.max(this.songTime(), this.status === 'countin' ? -this.countInSec() : this.songTime())
    this.status = 'paused'
    audioEngine.stopAll()
    this.notify()
  }

  stop(notify = true) {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.unsub?.()
    this.unsub = null
    if (this.status !== 'idle') audioEngine.stopAll()
    this.status = 'idle'
    this.frozenSong = 0
    if (notify) this.notify()
  }

  /** Retroceso / salto: reinicia el intento desde esa posición. */
  seek(songSec: number) {
    const running = this.status === 'playing' || this.status === 'countin' || this.status === 'waiting'
    audioEngine.stopAll()
    const pos = Math.max(0, Math.min(this.timeline.lengthSec, songSec))
    this.resetAttempt(pos)
    this.frozenSong = pos
    if (running) {
      this.status = 'paused'
      void this.start()
    } else if (this.status === 'finished' || this.status === 'idle') this.status = 'paused'
    this.notify()
  }

  restart() {
    this.stop(false)
    void this.start()
  }

  dispose() {
    this.stop(false)
    this.listeners.clear()
  }

  private tick = () => {
    const now = performance.now()
    const t = this.songTime(now)
    if (this.status === 'countin' && t >= 0) {
      this.status = 'playing'
      this.notify()
    }
    if (this.status !== 'playing' && this.status !== 'countin') return

    // Modo espera: detener el reloj al llegar al siguiente paso sin completar
    if (this.cfg.mode === 'wait' && this.stepIdx < this.steps.length) {
      const stepStart = this.steps[this.stepIdx][0].start
      if (t >= stepStart) {
        this.frozenSong = stepStart
        this.status = 'waiting'
        this.stepActivatedAt = now
        audioEngine.stopAll()
        this.notify()
        return
      }
    }

    const ahead = t + 0.15
    const limit = this.cfg.mode === 'wait' && this.stepIdx < this.steps.length ? Math.min(ahead, this.steps[this.stepIdx][0].start) : ahead
    // Acompañamiento (mano no practicada / modo escuchar / base de improvisación)
    if (this.cfg.playAccompaniment || this.cfg.mode === 'listen' || this.cfg.mode === 'improv') {
      const acc = this.timeline.accompaniment
      while (this.nextAccIdx < acc.length && acc[this.nextAccIdx].start < limit) {
        const n = acc[this.nextAccIdx++]
        if (n.start >= this.scheduledUntil - 1e-6) audioEngine.scheduleNote(n.midi, this.perfAt(n.start), n.duration * 1000, n.velocity ?? 80)
      }
    }
    // Metrónomo (incluye cuenta previa)
    if (this.cfg.metronome || this.status === 'countin') {
      const ts = this.cfg.arrangement.timeSignature
      const ci = clickInterval(ts) * this.beatSec
      const bar = ts[0] * ci
      while (this.nextClick < limit) {
        const rel = this.nextClick
        if (rel < 0 || this.cfg.metronome) {
          const accent = Math.abs(((rel % bar) + bar) % bar) < 1e-4 || Math.abs((((rel % bar) + bar) % bar) - bar) < 1e-4
          audioEngine.scheduleClick(this.perfAt(rel), accent)
        }
        this.nextClick += ci
      }
    }
    this.scheduledUntil = Math.max(this.scheduledUntil, limit)

    // Notas omitidas en vivo (modo con tempo)
    if (this.cfg.mode === 'timed') {
      for (const e of this.timeline.expected) {
        if (e.start < this.evalFrom - 1e-6 || this.live.has(e.id)) continue
        const w = (this.windows.get(e.id) ?? 150) / 1000
        if (e.start + w < t) {
          this.live.set(e.id, 'missed')
          this.combo = 0
        } else if (e.start > t) break
      }
    }

    // Fin del fragmento
    if (t >= this.timeline.lengthSec + 0.4) this.finish()
  }

  private onInput = (e: MusicEvent) => {
    if (e.type !== 'noteon' && e.type !== 'noteoff') return
    if (this.status === 'idle' || this.status === 'paused' || this.status === 'finished') return
    if (this.cfg.mode === 'listen') return
    const songT = this.status === 'waiting' ? this.frozenSong : this.songTime(e.time - this.cfg.latencyMs)
    if (e.type === 'noteon') {
      this.sources.add(e.source)
      const p: PlayedNote = { id: `p${++playedCounter}`, midi: e.note, start: songT, end: null, velocity: e.velocity, source: e.source }
      this.played.push(p)
      this.openPlayed.set(e.note, p)
      if (this.cfg.mode === 'timed') this.judgeLive(p)
      else if (this.cfg.mode === 'wait') this.judgeWait(e.note)
      else if (this.cfg.mode === 'comp') {
        const c = this.timeline.chords.find((x) => x.start - 0.25 <= songT && x.start + x.duration > songT)
        this.flash(e.note, c && c.pcs.includes(((e.note % 12) + 12) % 12) ? 'hit' : 'wrong')
      } else if (this.cfg.mode === 'improv') this.flash(e.note, inScaleRatio([e.note], this.cfg.improv?.rootPc ?? 0, this.cfg.improv?.scaleId ?? 'major') ? 'hit' : 'wrong')
    } else {
      const p = this.openPlayed.get(e.note)
      if (p) {
        p.end = Math.max(p.start, songT)
        this.openPlayed.delete(e.note)
      }
    }
  }

  private flash(midi: number, kind: LiveJudgment) {
    const now = performance.now()
    this.flashes.push({ midi, kind, at: now })
    if (this.flashes.length > 40) this.flashes = this.flashes.filter((f) => now - f.at < 1500)
  }

  /** Feedback inmediato (greedy). El resultado final usa el emparejamiento óptimo. */
  private judgeLive(p: PlayedNote) {
    let best: ExpectedNote | null = null
    let bestDt = Infinity
    let anyNear = false
    for (const e of this.timeline.expected) {
      if (e.start < this.evalFrom - 1e-6) continue
      const w = (this.windows.get(e.id) ?? 150) / 1000
      if (e.start - w > p.start) break
      const dt = Math.abs(p.start - e.start)
      if (dt > w) continue
      const st = this.live.get(e.id)
      if (st === 'hit') continue
      anyNear = true
      if (e.midi === p.midi && dt < bestDt) {
        best = e
        bestDt = dt
      }
    }
    if (best) {
      this.live.set(best.id, 'hit')
      this.combo++
      this.bestCombo = Math.max(this.bestCombo, this.combo)
      this.flash(p.midi, 'hit')
    } else {
      this.combo = 0
      this.flash(p.midi, anyNear ? 'wrong' : 'extra')
    }
  }

  private judgeWait(midi: number) {
    if (this.stepIdx >= this.steps.length) return
    const step = this.steps[this.stepIdx]
    const target = step.find((n) => n.midi === midi)
    if (!target) {
      this.stepWrong.push(midi)
      this.combo = 0
      this.flash(midi, 'wrong')
      return
    }
    this.stepPressed.add(midi)
    this.live.set(target.id, 'hit')
    this.flash(midi, 'hit')
    if (step.every((n) => this.stepPressed.has(n.midi))) {
      // paso completado
      const now = performance.now()
      this.waitRecords.push({ expected: step, wrongPresses: this.stepWrong, reactionMs: this.status === 'waiting' ? now - this.stepActivatedAt : 0 })
      if (!this.stepWrong.length) this.combo += step.length
      else this.combo = step.length
      this.bestCombo = Math.max(this.bestCombo, this.combo)
      this.stepIdx++
      this.stepPressed.clear()
      this.stepWrong = []
      if (this.status === 'waiting') {
        // reanudar el reloj desde el paso actual
        this.anchorPerf = now
        this.anchorSong = this.frozenSong
        this.scheduledUntil = this.frozenSong
        this.status = 'playing'
        this.tick()
      }
      this.notify()
    }
  }

  private finish() {
    const now = performance.now()
    for (const p of this.openPlayed.values()) p.end = this.songTime(now)
    this.openPlayed.clear()
    audioEngine.stopAll()
    const practiceSec = (now - this.startedAtPerf) / 1000
    const src = [...this.sources]
    const input = src.length === 0 ? 'midi' : src.length === 1 ? src[0] : 'mixed'
    const expected = this.timeline.expected.filter((e) => e.start >= this.evalFrom - 1e-6)
    let result: SessionResult
    const base = { practiceSec, played: [...this.played], expected, timeline: this.timeline, input: input as SessionResult['input'], chordChangeLagMs: null as number | null, evalFrom: this.evalFrom }
    if (this.cfg.mode === 'timed') {
      const evaluation = evaluatePerformance(
        expected.map((e) => ({ ...e, start: e.start - this.evalFrom })),
        this.played.map((p) => ({ ...p, start: p.start - this.evalFrom, end: p.end === null ? null : p.end - this.evalFrom })),
        { ...this.cfg.evaluation, beatSeconds: this.beatSec, sections: this.timeline.sections.map((s) => ({ ...s, start: s.start - this.evalFrom, end: s.end - this.evalFrom })) },
        this.timeline.lengthSec - this.evalFrom,
      )
      const lags = evaluation.chords.outcomes
        .slice(1)
        .map((c) => {
          const os = evaluation.outcomes.filter((o) => o.status === 'hit' && c.hitMidis.includes(o.expected.midi) && Math.abs(o.expected.start - c.start) < 0.04)
          return os.length ? os.reduce((s, o) => s + o.timingMs!, 0) / os.length : null
        })
        .filter((x): x is number => x !== null)
      result = { ...base, mode: 'timed', evaluation, score: evaluation.score, chordChangeLagMs: lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null }
    } else if (this.cfg.mode === 'wait') {
      const wait = evaluateWaitMode(this.waitRecords, this.cfg.evaluation.extraPenalty)
      result = { ...base, mode: 'wait', wait, score: wait.score }
    } else if (this.cfg.mode === 'comp') {
      const tol = this.cfg.evaluation.tolerance
      const comping = evaluateComping(
        this.timeline.chords.filter((c) => c.start >= this.evalFrom - 1e-6),
        this.played.filter((p) => p.start >= this.evalFrom - 0.5),
        // ventana algo más amplia que la de nota exacta: se juzga el cambio de acorde, no cada nota
        { windowMs: Math.round(tol.hitWindowMs * 1.25 * tempoScale(this.beatSec)), groupMs: Math.max(120, tol.chordSpreadMs * 1.5) },
      )
      result = { ...base, mode: 'comp', comping, score: comping.score, chordChangeLagMs: comping.meanLagMs }
    } else if (this.cfg.mode === 'improv') {
      const notes = this.played.map((p) => p.midi)
      const ratio = inScaleRatio(notes, this.cfg.improv?.rootPc ?? 0, this.cfg.improv?.scaleId ?? 'major')
      const bars = this.cfg.improv?.bars ?? 8
      const activity = Math.min(1, notes.length / (bars * 2))
      const score = Math.round(100 * ratio * activity * 10) / 10
      result = { ...base, mode: 'improv', improv: { score, inScale: ratio, notes: notes.length, formula: `100 × (notas en la escala / notas tocadas) × min(1, notas / ${bars * 2})` }, score }
    } else {
      result = { ...base, mode: 'listen', score: 0 }
    }
    this.lastResult = result
    this.status = 'finished'
    this.frozenSong = this.timeline.lengthSec
    this.notify()
    this.onFinish?.(result)
    if (this.cfg.loop && this.cfg.mode !== 'listen') {
      window.setTimeout(() => {
        if (this.status === 'finished') {
          this.status = 'idle'
          void this.start()
        }
      }, 1800)
    } else {
      if (this.timer !== null) window.clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Notas que la aplicación debe resaltar ahora en el teclado. */
  upcomingNotes(windowSec = 0.35): ExpectedNote[] {
    const t = this.songTime()
    if (this.cfg.mode === 'wait' && this.stepIdx < this.steps.length) {
      const s = this.steps[this.stepIdx]
      return s[0].start - t < windowSec + 0.5 ? s.filter((n) => !this.stepPressed.has(n.midi)) : []
    }
    return this.timeline.expected.filter((e) => e.start - t <= windowSec && e.start + Math.min(e.duration, 0.4) >= t && !this.live.has(e.id))
  }

  /** Notas de acompañamiento que suenan ahora. */
  soundingAccompaniment(): ExpectedNote[] {
    const t = this.songTime()
    return this.timeline.accompaniment.filter((n) => n.start <= t && n.start + n.duration > t)
  }

  currentChord() {
    const t = this.songTime()
    return this.timeline.chords.find((c) => c.start <= t + 0.05 && c.start + c.duration > t + 0.05)
  }
}
