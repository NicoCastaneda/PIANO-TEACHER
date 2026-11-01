import type { SessionConfig, SessionResult } from '../core/practice/PracticeSession'
import type { Skill } from '../core/practice/exercises'
import { store, type AttemptKind, type AttemptRecord } from '../core/storage/db'
import { useProgress } from '../state/library'

/**
 * Construye el registro de un intento a partir del resultado REAL de la sesión.
 * Los intentos con eventos simulados no se guardan nunca (no se crean estadísticas falsas).
 * Los intentos sin ninguna nota tocada tampoco.
 */
export function buildAttempt(r: SessionResult, cfg: SessionConfig, meta: { kind: AttemptKind; refId: string; title: string; skills: Skill[]; tolerance: string }): AttemptRecord | null {
  if (r.mode === 'listen') return null
  if (r.input === 'simulated' || r.input === 'mixed') return null
  if (r.played.length === 0) return null
  const ev = r.evaluation
  const chordSymbols = r.timeline.chords
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind: r.mode === 'improv' ? 'improv' : meta.kind,
    refId: meta.refId,
    title: meta.title,
    mode: r.mode === 'wait' ? 'wait' : r.mode === 'improv' ? 'improv' : 'timed',
    score: r.score,
    noteAccuracy: ev ? ev.noteAccuracy : r.wait ? r.wait.expected / Math.max(1, r.wait.expected + r.wait.wrongPresses) : r.improv?.inScale ?? 0,
    timingScore: ev?.breakdown.timingScore ?? null,
    durationScore: ev?.breakdown.durationScore ?? null,
    meanOffsetMs: ev?.timing.meanOffsetMs ?? null,
    stdDevMs: ev?.timing.stdDevMs ?? null,
    counts: ev
      ? { expected: ev.counts.expected, hits: ev.counts.hits, wrong: ev.counts.wrong, octave: ev.counts.octave, missed: ev.counts.missed, extra: ev.counts.extra, early: ev.counts.early, late: ev.counts.late }
      : { expected: r.wait?.expected ?? 0, hits: r.wait?.expected ?? 0, wrong: r.wait?.wrongPresses ?? 0, octave: 0, missed: 0, extra: 0, early: 0, late: 0 },
    chords: ev ? { total: ev.chords.total, complete: ev.chords.complete, simultaneous: ev.chords.simultaneous } : { total: 0, complete: 0, simultaneous: 0 },
    bestStreak: ev?.bestStreak ?? r.wait?.bestStreak ?? 0,
    practiceSec: r.practiceSec,
    skills: meta.skills,
    tolerance: meta.tolerance,
    tempoFactor: cfg.tempoFactor,
    hands: cfg.hands,
    sections: ev?.sections.map((s) => ({ id: s.id, name: s.name, accuracy: s.accuracy })),
    chordResults: ev?.chords.outcomes.map((c) => ({ symbol: chordSymbols.find((x) => Math.abs(x.start - (c.start + r.evalFrom)) < 0.05)?.symbol ?? '?', complete: c.complete })),
    chordChangeLagMs: r.chordChangeLagMs,
    input: r.input,
  }
}

export async function saveAttempt(a: AttemptRecord | null) {
  if (a) {
    await store.addAttempt(a)
    await useProgress.getState().load()
  }
  return a
}
