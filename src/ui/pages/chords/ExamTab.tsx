import { GraduationCap, Play, RotateCcw, SkipForward, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildExam,
  CATEGORY_INFO,
  cardsForGroups,
  cardSymbol,
  chordLongName,
  CHORD_GROUPS,
  examPoints,
  HAND_LABEL,
  HAND_PROMPT,
  minNotesFor,
  type HandMode,
  INVERSION_MODE_LABEL,
  judgeChord,
  type ChordCard,
  type InversionMode,
  type JudgeStatus,
  type Judgement,
} from '../../../core/chords/trainer'
import { detectChord, inversionName } from '../../../core/music/theory'
import type { InputSource } from '../../../core/midi/types'
import type { AttemptRecord } from '../../../core/storage/db'
import { saveAttempt } from '../../../lib/attempts'
import { useFrame, useHeldNotes } from '../../../lib/hooks'
import { useChordTrainer } from '../../../state/chordTrainer'
import { useSettings } from '../../../state/settings'
import { PianoKeyboard } from '../../components/PianoKeyboard'
import { baseSymbol, CATEGORIES, feedbackText, groupSymbols, judgeMarks, STATUS_COLOR, STATUS_LABEL } from './common'
import { useChordGesture } from './useChordGesture'

interface Answer {
  card: ChordCard
  status: JudgeStatus | 'skipped'
  judgement?: Judgement
  notes: number[]
  ms: number
}

type Phase = { kind: 'setup' } | { kind: 'running'; questions: ChordCard[]; startedAt: number } | { kind: 'done'; answers: Answer[]; sec: number; saved: boolean; simulated: boolean }

export function ExamTab({ defaultGroupId, onReview }: { defaultGroupId: string; onReview: (cards: ChordCard[]) => void }) {
  const style = useSettings((s) => s.namingStyle)
  const { stats, record, hand } = useChordTrainer()
  const studied = CHORD_GROUPS.filter((g) => cardsForGroups([g.id], 'all').some((c) => stats[c.id]?.seen)).map((g) => g.id)
  const [groups, setGroups] = useState<string[]>(() => (studied.length ? studied : [defaultGroupId]))
  const [invMode, setInvMode] = useState<InversionMode>('all')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const pool = useMemo(() => cardsForGroups(groups, invMode), [groups, invMode])

  const start = () => setPhase({ kind: 'running', questions: buildExam(pool, count, stats), startedAt: Date.now() })

  if (phase.kind === 'running')
    return (
      <ExamRunner
        key={phase.startedAt}
        questions={phase.questions}
        style={style}
        hand={hand}
        onAnswer={(a, sources) => {
          if (!sources.has('simulated') && a.status !== 'skipped') record(a.card.id, { correct: a.status === 'correct', revealed: false, ms: a.ms })
        }}
        onFinish={async (answers, sources) => {
          const sec = (Date.now() - phase.startedAt) / 1000
          const simulated = sources.has('simulated')
          let saved = false
          if (!simulated && answers.some((x) => x.status !== 'skipped')) {
            saved = !!(await saveAttempt(buildExamAttempt(answers, sec, sources, groups, hand)))
          }
          setPhase({ kind: 'done', answers, sec, saved, simulated })
        }}
        onCancel={() => setPhase({ kind: 'setup' })}
      />
    )

  if (phase.kind === 'done') return <ExamResults {...phase} style={style} onAgain={start} onSetup={() => setPhase({ kind: 'setup' })} onReview={onReview} />

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-center gap-2">
        <GraduationCap size={20} style={{ color: 'var(--accent)' }} />
        <h2 className="text-lg font-extrabold">Examen de acordes</h2>
      </div>
      <p className="text-sm text-muted">
        La app te pide un acorde y una inversión («Toca Do mayor en 1.ª inversión») y tú lo tocas sin ayudas. Vale cualquier octava, pero las notas deben ser exactamente las del acorde y la más grave debe ser la de la inversión pedida.
      </p>
      <div>
        <div className="label mb-2">Grupos</div>
        <div className="grid gap-3 md:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="space-y-1">
              <div className="text-xs font-bold text-muted">{CATEGORY_INFO[cat].title}</div>
              {CHORD_GROUPS.filter((g) => g.category === cat).map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={groups.includes(g.id)} onChange={(e) => setGroups((gs) => (e.target.checked ? [...gs, g.id] : gs.filter((x) => x !== g.id)))} />
                  {groupSymbols(g).join(' · ')}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <div className="label mb-1">Inversiones</div>
          <div className="seg">
            {(['root', 'inversions', 'all'] as const).map((m) => (
              <button key={m} aria-pressed={invMode === m} onClick={() => setInvMode(m)}>
                {INVERSION_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-1">Preguntas</div>
          <div className="seg">
            {[5, 10, 20].map((n) => (
              <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary ml-auto" disabled={!pool.length} onClick={start}>
          <Play size={16} /> Empezar examen ({pool.length} tarjetas posibles)
        </button>
      </div>
      <p className="text-xs text-faint">Puntuación: correcta = 1 punto; notas correctas con otra inversión = 0,5; notas incorrectas o saltada = 0. Total sobre 100. El resultado se guarda en Progreso (salvo con eventos simulados).</p>
    </div>
  )
}

function ExamRunner({
  questions,
  style,
  hand,
  onAnswer,
  onFinish,
  onCancel,
}: {
  questions: ChordCard[]
  style: 'latin' | 'english'
  hand: HandMode
  onAnswer: (a: Answer, sources: Set<InputSource>) => void
  onFinish: (answers: Answer[], sources: Set<InputSource>) => void
  onCancel: () => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [feedback, setFeedback] = useState<Answer | null>(null)
  const sources = useRef(new Set<InputSource>())
  const shownAt = useRef(performance.now())
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useHeldNotes()
  useFrame(!feedback, 10)
  useEffect(() => () => clearTimeout(timer.current), [])
  const card = questions[index]

  const answer = (a: Answer) => {
    onAnswer(a, sources.current)
    const all = [...answers, a]
    setAnswers(all)
    setFeedback(a)
    timer.current = setTimeout(
      () => {
        setFeedback(null)
        if (index + 1 >= questions.length) onFinish(all, sources.current)
        else {
          setIndex(index + 1)
          shownAt.current = performance.now()
        }
      },
      a.status === 'correct' ? 700 : 1800,
    )
  }

  useChordGesture({
    active: !feedback,
    minNotes: minNotesFor(card, hand),
    onChord: (g) => {
      g.sources.forEach((s) => sources.current.add(s))
      const j = judgeChord(g.notes, card, hand)
      answer({ card, status: j.status, judgement: j, notes: g.notes, ms: Math.round(g.at - shownAt.current) })
    },
  })

  const elapsed = (performance.now() - shownAt.current) / 1000
  const marks = feedback?.judgement ? judgeMarks(feedback.notes, card, feedback.judgement) : undefined
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="chip">
          Pregunta {index + 1} / {questions.length}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full transition-all" style={{ width: `${(index / questions.length) * 100}%`, background: 'var(--accent)' }} />
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <div className="card relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-72 rounded-full opacity-20 blur-3xl" style={{ background: feedback ? STATUS_COLOR[feedback.status] : 'var(--accent)' }} />
        <div className="relative">
          <div className="label">Toca</div>
          <div key={index} className="animate-pop mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            {chordLongName(card, style)} <span className="text-muted">({baseSymbol(card)})</span>
          </div>
          <div className="mt-1 text-2xl font-bold" style={{ color: card.inversion ? 'var(--accent-2)' : 'var(--accent)' }}>
            {inversionName(card.inversion)}
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: hand === 'L' ? 'var(--lh)' : hand === 'R' ? 'var(--rh)' : 'var(--muted)' }}>
            {HAND_PROMPT[hand]}
          </div>
          <div className="mt-4 min-h-12 text-[15px] font-semibold" aria-live="polite">
            {feedback ? (
              <span style={{ color: STATUS_COLOR[feedback.status] }}>{feedback.judgement ? feedbackText(card, feedback.judgement, style) : 'Saltada.'}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted tabular-nums">
                <Timer size={15} /> {elapsed.toFixed(1)} s
              </span>
            )}
          </div>
          {!feedback && (
            <button className="btn btn-sm btn-ghost mt-2" onClick={() => answer({ card, status: 'skipped', notes: [], ms: Math.round(performance.now() - shownAt.current) })}>
              <SkipForward size={14} /> No lo sé
            </button>
          )}
        </div>
      </div>
      <div className="card p-3">
        <PianoKeyboard height={120} held={held} marks={marks} />
      </div>
    </div>
  )
}

function ExamResults({
  answers,
  sec,
  saved,
  simulated,
  style,
  onAgain,
  onSetup,
  onReview,
}: {
  answers: Answer[]
  sec: number
  saved: boolean
  simulated: boolean
  style: 'latin' | 'english'
  onAgain: () => void
  onSetup: () => void
  onReview: (cards: ChordCard[]) => void
}) {
  const pts = answers.reduce((s, a) => s + examPoints(a.status), 0)
  const score = Math.round((pts / answers.length) * 100)
  const ok = answers.filter((a) => a.status === 'correct')
  const wrongInv = answers.filter((a) => a.status === 'wrong-inversion').length
  const wrong = answers.filter((a) => a.status === 'wrong-notes' || a.status === 'incomplete').length
  const skipped = answers.filter((a) => a.status === 'skipped').length
  const avg = ok.length ? ok.reduce((s, a) => s + a.ms, 0) / ok.length / 1000 : null
  const failedCards = [...new Map(answers.filter((a) => a.status !== 'correct').map((a) => [a.card.id, a.card])).values()]
  const color = score >= 85 ? 'var(--ok)' : score >= 60 ? 'var(--miss)' : 'var(--bad)'
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-6 p-6">
        <div className="text-center">
          <div className="text-6xl font-black tabular-nums" style={{ color }}>
            {score}
          </div>
          <div className="text-xs text-muted">de 100</div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
          <Box label="Correctas" value={ok.length} color="var(--ok)" />
          <Box label="Inversión equivocada" value={wrongInv} color="var(--miss)" />
          <Box label="Notas incorrectas" value={wrong} color="var(--bad)" />
          <Box label="Saltadas" value={skipped} />
          <Box label="Tiempo medio (correctas)" value={avg === null ? '—' : `${avg.toFixed(1)} s`} />
        </div>
        <div className="w-full text-xs text-muted">
          {simulated ? <span style={{ color: 'var(--miss)' }}>Examen con eventos SIMULADOS: no se guarda.</span> : saved ? 'Guardado en Progreso.' : 'No se guardó (sin respuestas tocadas).'} Duración: {Math.round(sec)} s. Puntuación = (correctas + 0,5 × inversión equivocada) / preguntas × 100.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {failedCards.length > 0 && (
          <button className="btn btn-primary" onClick={() => onReview(failedCards)}>
            <RotateCcw size={16} /> Repasar las {failedCards.length} falladas con tarjetas
          </button>
        )}
        <button className="btn" onClick={onAgain}>
          <Play size={16} /> Repetir examen
        </button>
        <button className="btn btn-ghost" onClick={onSetup}>
          Cambiar grupos
        </button>
      </div>
      <div className="card overflow-auto p-4">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1.5 pr-3">#</th>
              <th className="py-1.5 pr-3">Pedido</th>
              <th className="py-1.5 pr-3">Resultado</th>
              <th className="py-1.5 pr-3">Tocaste</th>
              <th className="py-1.5 pr-3 text-right">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {answers.map((a, i) => {
              const det = a.notes.length >= 2 ? detectChord(a.notes) : null
              return (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-muted">{i + 1}</td>
                  <td className="py-1.5 pr-3">
                    <b>{cardSymbol(a.card)}</b> <span className="text-muted">— {chordLongName(a.card, style)}, {inversionName(a.card.inversion).toLowerCase()}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-semibold" style={{ color: STATUS_COLOR[a.status] }}>
                    {STATUS_LABEL[a.status]}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{a.notes.length ? (det ? `${det.symbol} (${inversionName(det.inversion).toLowerCase()})` : 'no es un acorde reconocible') : '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{a.status === 'skipped' ? '—' : `${(a.ms / 1000).toFixed(1)} s`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Box({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-xl font-black tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[11px] leading-tight text-muted">{label}</div>
    </div>
  )
}

/** Registro del examen para Progreso (sin ritmo: es una prueba sin tempo). */
function buildExamAttempt(answers: Answer[], sec: number, sources: Set<InputSource>, groups: string[], hand: HandMode): AttemptRecord {
  const total = answers.length
  const ok = answers.filter((a) => a.status === 'correct').length
  const pts = answers.reduce((s, a) => s + examPoints(a.status), 0)
  const notesRight = answers.filter((a) => a.status === 'correct' || a.status === 'wrong-inversion').length
  let streak = 0
  let best = 0
  for (const a of answers) {
    streak = a.status === 'correct' ? streak + 1 : 0
    best = Math.max(best, streak)
  }
  const real = [...sources].filter((s) => s !== 'simulated')
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind: 'challenge',
    refId: `chord-exam:${[...groups].sort().join('+')}`,
    title: `Examen de acordes · ${HAND_LABEL[hand].toLowerCase()} (${total} preguntas)`,
    mode: 'wait',
    score: Math.round((pts / total) * 1000) / 10,
    noteAccuracy: notesRight / total,
    timingScore: null,
    durationScore: null,
    meanOffsetMs: null,
    stdDevMs: null,
    counts: {
      expected: total,
      hits: ok,
      wrong: answers.filter((a) => a.status === 'wrong-notes' || a.status === 'incomplete').length,
      octave: 0,
      missed: answers.filter((a) => a.status === 'skipped').length,
      extra: 0,
      early: 0,
      late: 0,
    },
    chords: { total, complete: ok, simultaneous: ok },
    bestStreak: best,
    practiceSec: sec,
    skills: answers.some((a) => a.card.inversion > 0) ? ['chords', 'inversions'] : ['chords'],
    tolerance: 'examen-acordes',
    tempoFactor: 1,
    hands: hand,
    chordResults: answers.map((a) => ({ symbol: cardSymbol(a.card), complete: a.status === 'correct' })),
    input: real.length === 1 ? (real[0] as AttemptRecord['input']) : 'mixed',
  }
}
