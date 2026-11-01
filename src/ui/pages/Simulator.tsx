import { AlertTriangle, FlaskConical, Play } from 'lucide-react'
import { useState } from 'react'
import { ALL_LESSONS } from '../../core/curriculum/curriculum'
import { emitNote } from '../../core/midi/inputBus'
import type { SessionResult } from '../../core/practice/PracticeSession'
import { evaluatePerformance } from '../../core/scoring/evaluate'
import { defaultEvaluationOptions, resolveTolerance } from '../../core/scoring/tolerance'
import type { PlayedNote } from '../../core/scoring/types'
import { makeDifficultyVersion, toTimeline } from '../../core/songs/adapt'
import { BUILTIN_SONGS } from '../../core/songs/library'
import type { Arrangement } from '../../core/songs/schema'
import { useSettings } from '../../state/settings'
import { ResultsView } from '../components/ResultsView'

/**
 * MODO DIAGNÓSTICO / SIMULADOR
 * Permite verificar el motor de evaluación sin el teclado. Todo lo que se genera aquí
 * lleva la etiqueta "simulated": se muestra como SIMULADO y nunca se guarda en el progreso.
 */

type Profile = 'perfect' | 'late' | 'early' | 'missing' | 'wrong' | 'sloppy' | 'arpeggiated'
const PROFILES: { id: Profile; label: string }[] = [
  { id: 'perfect', label: 'Perfecta' },
  { id: 'late', label: 'Siempre +90 ms tarde' },
  { id: 'early', label: 'Siempre −70 ms pronto' },
  { id: 'missing', label: '20 % de notas omitidas' },
  { id: 'wrong', label: '15 % notas incorrectas + extras' },
  { id: 'sloppy', label: 'Ritmo irregular (±60 ms)' },
  { id: 'arpeggiated', label: 'Acordes arpegiados' },
]

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

export function simulatePerformance(expected: ReturnType<typeof toTimeline>['expected'], profile: Profile, seed = 7): PlayedNote[] {
  const r = rng(seed)
  const out: PlayedNote[] = []
  let i = 0
  const byStart = new Map<number, number>()
  for (const e of expected) {
    const k = Math.round(e.start * 100)
    const idxInChord = byStart.get(k) ?? 0
    byStart.set(k, idxInChord + 1)
    let midi = e.midi
    let dt = 0
    if (profile === 'late') dt = 0.09
    if (profile === 'early') dt = -0.07
    if (profile === 'sloppy') dt = (r() - 0.5) * 0.12
    if (profile === 'arpeggiated') dt = idxInChord * 0.06
    if (profile === 'missing' && r() < 0.2) continue
    if (profile === 'wrong' && r() < 0.15) midi += r() < 0.5 ? 1 : -2
    out.push({ id: `sim${i++}`, midi, start: e.start + dt, end: e.start + dt + e.duration * 0.92, velocity: 80, source: 'simulated' })
    if (profile === 'wrong' && r() < 0.06) out.push({ id: `sim${i++}`, midi: midi + 5, start: e.start + 0.3, end: e.start + 0.5, velocity: 60, source: 'simulated' })
  }
  return out
}

export function Simulator() {
  const settings = useSettings()
  const sources: { id: string; label: string; build: () => Arrangement }[] = [
    ...BUILTIN_SONGS.map((s) => ({ id: `song:${s.id}`, label: `Canción: ${s.title}`, build: () => makeDifficultyVersion(s, 'advanced') })),
    ...ALL_LESSONS.filter((l) => !l.exercise.songRef && l.exercise.mode === 'timed').map((l) => ({ id: `lesson:${l.id}`, label: `Lección: ${l.title}`, build: () => l.exercise.build() })),
  ]
  const [src, setSrc] = useState(sources[0].id)
  const [profile, setProfile] = useState<Profile>('late')
  const [result, setResult] = useState<SessionResult | null>(null)

  const run = () => {
    const a = sources.find((s) => s.id === src)!.build()
    const timeline = toTimeline(a, { hands: 'both', tempoFactor: 1 })
    const played = simulatePerformance(timeline.expected, profile)
    const evaluation = evaluatePerformance(
      timeline.expected,
      played,
      defaultEvaluationOptions({ tolerance: resolveTolerance(settings.difficulty, settings.customTolerance), weights: settings.weights, extraPenalty: settings.extraPenalty, beatSeconds: timeline.beatSeconds, sections: timeline.sections, evaluateDuration: true }),
      timeline.lengthSec,
    )
    setResult({ mode: 'timed', evaluation, score: evaluation.score, practiceSec: 0, played, expected: timeline.expected, timeline, input: 'simulated', chordChangeLagMs: null, evalFrom: 0 })
  }

  const chord = (notes: number[]) => {
    notes.forEach((n) => emitNote('simulated', 'noteon', n, 80))
    setTimeout(() => notes.forEach((n) => emitNote('simulated', 'noteoff', n)), 700)
  }

  return (
    <>
      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FlaskConical size={18} /> Eventos MIDI simulados
        </h2>
        <div className="flex gap-2 rounded-xl border border-miss/40 bg-miss/10 px-3 py-2 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--miss)' }} />
          <span>
            Estos eventos se marcan como <b>SIMULADOS</b> en todo momento: aparecen en ámbar en el diagnóstico, no proceden del Casio y los intentos que los contienen no se guardan.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" onClick={() => chord([60])}>
            Nota Do4
          </button>
          <button className="btn btn-sm" onClick={() => chord([60, 64, 67])}>
            Acorde Do–Mi–Sol
          </button>
          <button className="btn btn-sm" onClick={() => chord([57, 60, 64, 67])}>
            Am7
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              const seqn = [60, 62, 64, 65, 67]
              seqn.forEach((n, i) => {
                setTimeout(() => emitNote('simulated', 'noteon', n, 70 + i * 10), i * 250)
                setTimeout(() => emitNote('simulated', 'noteoff', n), i * 250 + 200)
              })
            }}
          >
            Escala Do–Sol
          </button>
        </div>
        <p className="text-xs text-muted">Abre «Diagnóstico» en otra pestaña para verlos llegar, o úsalos dentro de un ejercicio para comprobar la retroalimentación en vivo.</p>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Prueba del motor de evaluación</h2>
        <p className="text-sm text-muted">Genera una interpretación sintética con un perfil de errores conocido y la evalúa con el mismo algoritmo que la práctica real. Sirve para comprobar que la puntuación responde como se espera.</p>
        <div className="flex flex-wrap items-end gap-3">
          <select className="select max-w-sm" value={src} onChange={(e) => setSrc(e.target.value)}>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="select" value={profile} onChange={(e) => setProfile(e.target.value as Profile)}>
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={run}>
            <Play size={16} /> Simular y evaluar
          </button>
        </div>
        {result && (
          <div className="rounded-2xl border border-miss/40 p-4">
            <ResultsView result={result} saved={false} onRetry={run} />
          </div>
        )}
      </section>
    </>
  )
}
