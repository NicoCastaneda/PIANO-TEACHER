import { ArrowRight, CalendarCheck, Check, ChevronRight, Ear, Hand, Layers, ListMusic, Music, RefreshCw, SkipForward, Sparkles, Target } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LESSON_BY_ID } from '../../core/curriculum/curriculum'
import { PROGRESSIONS, progressionArrangement } from '../../core/chords/progressions'
import { ALL_CARDS, buildSpec, planProgress, type DailyStep, type StepResult } from '../../core/daily/plan'
import type { SessionResult } from '../../core/practice/PracticeSession'
import { compingArrangement } from '../../core/songs/accompaniment'
import { makeDifficultyVersion } from '../../core/songs/adapt'
import { DIFFICULTY_LABEL } from '../../core/songs/schema'
import { href } from '../../lib/router'
import { useDaily } from '../../state/daily'
import { findSong, useLibrary } from '../../state/library'
import { PageHeader } from '../layout/Shell'
import { PracticePlayer } from '../components/PracticePlayer'
import { StudyTab } from './chords/StudyTab'
import { EarDrillView } from './ear/EarTrainingPage'

const ICON: Record<DailyStep['kind'], ReactNode> = {
  cards: <Layers size={16} />,
  exercise: <Target size={16} />,
  lesson: <Target size={16} />,
  section: <Music size={16} />,
  comp: <Hand size={16} style={{ transform: 'scaleX(-1)' }} />,
  ear: <Ear size={16} />,
  progression: <Sparkles size={16} />,
}
const STEP_LABEL: Record<DailyStep['id'], string> = { cards: 'Repaso', weak: 'Punto débil', section: 'Canción', ear: 'Oído', new: 'Algo nuevo' }

type Done = (r: Omit<StepResult, 'status' | 'seconds'>) => void

const fromSession = (r: SessionResult, saved: boolean) => ({ score: r.score, detail: `${Math.round(r.score)}/100${saved ? '' : ' · no guardado'}` })

/** Cuenta respuestas y marca el paso como hecho al llegar al objetivo (se puede seguir practicando). */
function useCounter(target: number, onDone: Done, unit: string) {
  const ref = useRef({ n: 0, ok: 0 })
  const [c, setC] = useState(ref.current)
  const fired = useRef(false)
  const count = (a: { correct: boolean }) => {
    const n = { n: ref.current.n + 1, ok: ref.current.ok + (a.correct ? 1 : 0) }
    ref.current = n
    setC(n)
    if (target > 0 && n.n >= target && !fired.current) {
      fired.current = true
      onDone({ score: Math.round((n.ok / n.n) * 100), detail: `${n.ok}/${n.n} ${unit} a la primera` })
    }
  }
  return [c, count] as const
}

function StepActivity({ step, onDone }: { step: DailyStep; onDone: Done }) {
  const { userSongs } = useLibrary()
  const [cards, countCard] = useCounter(step.kind === 'cards' ? step.answers : step.kind === 'ear' ? step.answers : 0, onDone, step.kind === 'cards' ? 'tarjetas' : 'respuestas')
  const cardList = useMemo(() => (step.kind === 'cards' ? step.cardIds.map((id) => ALL_CARDS.find((c) => c.id === id)!).filter(Boolean) : []), [step])
  const arrangement = useMemo(() => {
    if (step.kind === 'exercise') return buildSpec(step.spec)
    if (step.kind === 'progression')
      return progressionArrangement(
        PROGRESSIONS.find((p) => p.id === step.progressionId)!,
        step.tonic,
        'bass-rh',
      )
    if (step.kind === 'section' || step.kind === 'comp') {
      const full = findSong(step.songId, userSongs)
      if (!full) return null
      return step.kind === 'section' ? makeDifficultyVersion(full, step.level) : compingArrangement(full, 'root')
    }
    return null
  }, [step, userSongs])
  const progress = (target: number) => (
    <div className="flex items-center gap-2 text-sm text-muted">
      <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(1, cards.n / target) * 100}%` }} />
      </div>
      {Math.min(cards.n, target)}/{target}
    </div>
  )

  switch (step.kind) {
    case 'cards':
      return (
        <div className="space-y-3">
          {progress(step.answers)}
          <StudyTab
            groupId={cardList[0]?.groupId ?? 'f1'}
            initialCards={cardList}
            reviewLabel={`${cardList.length} tarjetas para hoy: las que más te cuestan salen más a menudo.`}
            onAnswer={countCard}
          />
        </div>
      )
    case 'ear':
      return (
        <div className="space-y-3">
          {progress(step.answers)}
          <EarDrillView drill={step.drill} level={step.level} onAnswer={countCard} />
        </div>
      )
    case 'lesson': {
      const l = LESSON_BY_ID[step.lessonId]
      return (
        <div className="card-flat space-y-3 p-4">
          <div className="font-bold">{l?.title ?? step.lessonId}</div>
          {l && <p className="text-sm text-muted">{l.objective}</p>}
          <div className="flex gap-2">
            <a className="btn btn-primary" href={href(`/learn/${step.lessonId}`)}>
              Abrir la lección <ArrowRight size={15} />
            </a>
            <button className="btn" onClick={() => onDone({ detail: 'lección repasada' })}>
              <Check size={15} /> Ya la hice
            </button>
          </div>
        </div>
      )
    }
    case 'exercise':
      return (
        <PracticePlayer
          key={arrangement!.id}
          arrangement={arrangement!}
          refId={arrangement!.id}
          kind="exercise"
          title={step.title}
          skills={step.skills}
          defaultMode={step.mode}
          modes={[step.mode, 'listen']}
          onResult={(r, saved) => r.mode !== 'listen' && onDone(fromSession(r, saved))}
        />
      )
    case 'progression':
      return (
        <PracticePlayer
          key={arrangement!.id}
          arrangement={arrangement!}
          refId={arrangement!.id}
          kind="exercise"
          title={arrangement!.title}
          skills={['progressions', 'inversions', 'chord-changes', 'two-hands']}
          defaultMode="wait"
          modes={['wait', 'timed', 'listen']}
          defaultHands="both"
          onResult={(r, saved) => r.mode !== 'listen' && onDone(fromSession(r, saved))}
        />
      )
    case 'section':
      if (!arrangement) return <p className="text-sm text-muted">La canción ya no está en la biblioteca. Salta este paso.</p>
      return (
        <PracticePlayer
          key={arrangement.id}
          arrangement={arrangement}
          refId={arrangement.id}
          kind="song"
          title={`${arrangement.title} · ${DIFFICULTY_LABEL[step.level]}`}
          skills={['repertoire']}
          initialSectionId={step.sectionId}
          defaultMode="timed"
          onResult={(r, saved) => r.mode !== 'listen' && onDone(fromSession(r, saved))}
        />
      )
    case 'comp':
      if (!arrangement) return <p className="text-sm text-muted">La canción ya no está en la biblioteca. Salta este paso.</p>
      return (
        <PracticePlayer
          key={arrangement.id}
          arrangement={arrangement}
          refId={`acomp:${step.songId}`}
          kind="song"
          title={`${arrangement.title} (solo el bajo)`}
          skills={['accompaniment', 'chord-changes', 'left-hand']}
          defaultMode="comp"
          modes={['comp', 'listen']}
          defaultHands="L"
          defaultView="chords"
          defaultAssist="none"
          onResult={(r, saved) => r.mode !== 'listen' && onDone(fromSession(r, saved))}
        />
      )
  }
}

function fmtMin(sec: number) {
  const m = Math.round(sec / 60)
  return m < 1 ? '<1 min' : `${m} min`
}

export function TodayPage() {
  const { plan, results, ensure, setResult, regenerate } = useDaily()
  const [current, setCurrent] = useState<string | null>(null)
  const startedAt = useRef(performance.now())
  useEffect(() => void ensure(), [ensure])
  useEffect(() => {
    startedAt.current = performance.now()
  }, [current])
  // fija el paso en curso: al completarlo no se salta solo al siguiente
  useEffect(() => {
    if (plan && current === null) setCurrent(plan.steps.find((s) => !results[s.id])?.id ?? 'summary')
  }, [plan, current, results])
  if (!plan) return <div className="text-muted">Preparando tu práctica…</div>

  const prog = planProgress(plan, results)
  const firstPending = plan.steps.find((s) => !results[s.id])
  const step = plan.steps.find((s) => s.id === current) ?? (current === null ? firstPending : undefined)
  const finish = (id: string, r: StepResult) => {
    setResult(id, { ...r, seconds: Math.round((performance.now() - startedAt.current) / 1000) + (results[id]?.seconds ?? 0) })
  }
  const goNext = () => {
    // se lee el estado recién guardado (el paso que se acaba de saltar ya cuenta como resuelto)
    const res = useDaily.getState().results
    const pending = (s: DailyStep) => !res[s.id] && s.id !== step?.id
    const after = plan.steps.slice(plan.steps.findIndex((s) => s.id === step?.id) + 1).find(pending) ?? plan.steps.find(pending)
    setCurrent(after?.id ?? 'summary')
  }
  const totalMin = plan.steps.reduce((s, x) => s + x.minutes, 0)
  const showSummary = current === 'summary' || (!step && prog.complete)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Práctica de hoy"
        subtitle={`Unos ${totalMin} minutos en ${plan.steps.length} pasos, elegidos con tus resultados registrados. Puedes saltar cualquier paso.`}
        actions={
          <button className="btn btn-sm btn-ghost" onClick={() => void regenerate().then(() => setCurrent(null))} title="Recalcular el plan con tus datos actuales (se pierde lo marcado hoy)">
            <RefreshCw size={14} /> Recalcular
          </button>
        }
      />

      <ol className="grid gap-2 sm:grid-cols-5" aria-label="Pasos">
        {plan.steps.map((s, i) => {
          const r = results[s.id]
          const active = !showSummary && step?.id === s.id
          return (
            <li key={s.id}>
              <button
                onClick={() => setCurrent(s.id)}
                className="card-flat flex h-full w-full flex-col gap-1 p-3 text-left transition-colors hover:border-accent"
                style={active ? { borderColor: 'var(--accent)', background: 'color-mix(in oklab, var(--accent) 10%, var(--surface-2))' } : undefined}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-black"
                    style={{ background: r ? (r.status === 'done' ? 'var(--ok)' : 'var(--surface-3)') : 'var(--surface-3)', color: r?.status === 'done' ? 'var(--bg)' : undefined }}
                  >
                    {r?.status === 'done' ? <Check size={12} /> : i + 1}
                  </span>
                  {STEP_LABEL[s.id]} · {s.minutes} min
                </span>
                <span className="text-sm font-bold leading-snug">{s.title}</span>
                {r && (
                  <span className="text-xs" style={{ color: r.status === 'done' ? 'var(--ok)' : 'var(--faint)' }}>
                    {r.status === 'done' ? (r.detail ?? 'hecho') : 'saltado'}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {showSummary ? (
        <Summary onRestart={() => setCurrent(plan.steps[0].id)} />
      ) : step ? (
        <section key={step.id} className="space-y-3">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: 'color-mix(in oklab, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
              {ICON[step.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">{step.title}</h2>
              <p className="text-sm text-muted">
                <span className="font-semibold">Por qué: </span>
                {step.reason}
              </p>
            </div>
            {results[step.id]?.status === 'done' ? (
              <button className="btn btn-primary" onClick={goNext}>
                Siguiente paso <ChevronRight size={16} />
              </button>
            ) : (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  finish(step.id, { status: 'skipped' })
                  goNext()
                }}
              >
                <SkipForward size={15} /> Saltar
              </button>
            )}
          </div>
          {results[step.id]?.status === 'done' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 px-4 py-2 text-sm">
              <Check size={16} style={{ color: 'var(--ok)' }} /> Paso completado: {results[step.id].detail}. Puedes repetirlo o seguir.
            </div>
          )}
          <StepActivity key={step.id} step={step} onDone={(r) => finish(step.id, { status: 'done', ...r })} />
        </section>
      ) : null}
    </div>
  )
}

function Summary({ onRestart }: { onRestart: () => void }) {
  const { plan, results } = useDaily()
  if (!plan) return null
  const done = plan.steps.filter((s) => results[s.id]?.status === 'done')
  const sec = Object.values(results).reduce((s, r) => s + (r.seconds ?? 0), 0)
  return (
    <div className="card relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--ok)' }} />
      <div className="relative space-y-4">
        <div className="flex items-center gap-2">
          <CalendarCheck size={22} style={{ color: 'var(--ok)' }} />
          <h2 className="text-2xl font-black">{done.length === plan.steps.length ? '¡Práctica de hoy completada!' : `Resumen de hoy: ${done.length} de ${plan.steps.length} pasos`}</h2>
        </div>
        <p className="text-sm text-muted">Tiempo en los pasos: {fmtMin(sec)}. Mañana el plan se recalcula con estos resultados.</p>
        <ul className="divide-y divide-border">
          {plan.steps.map((s) => {
            const r = results[s.id]
            return (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-muted">{ICON[s.kind]}</span>
                <span className="flex-1 font-semibold">{s.title}</span>
                <span className="tabular-nums" style={{ color: r?.status === 'done' ? 'var(--ok)' : 'var(--faint)' }}>
                  {r ? (r.status === 'done' ? (r.detail ?? 'hecho') : 'saltado') : 'pendiente'}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href={href('/progress')}>
            Ver progreso <ArrowRight size={15} />
          </a>
          <button className="btn" onClick={onRestart}>
            Repasar algún paso
          </button>
        </div>
      </div>
    </div>
  )
}

/** Tarjeta para Inicio. */
export function TodayCard() {
  const { plan, results, ensure } = useDaily()
  useEffect(() => void ensure(), [ensure])
  if (!plan) return null
  const p = planProgress(plan, results)
  const total = plan.steps.reduce((s, x) => s + x.minutes, 0)
  return (
    <a href={href('/hoy')} className="card group relative flex flex-wrap items-center gap-4 overflow-hidden p-5 transition-transform hover:-translate-y-0.5">
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--ok)' }} />
      <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--ok), var(--accent))' }}>
        <CalendarCheck size={22} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-lg font-extrabold">Práctica de hoy {p.complete && '· completada'}</div>
        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
          {plan.steps.map((s) => (
            <span key={s.id} className="chip" style={results[s.id]?.status === 'done' ? { color: 'var(--ok)', borderColor: 'var(--ok)' } : undefined}>
              {results[s.id]?.status === 'done' ? <Check size={11} /> : s.id === 'ear' ? <Ear size={11} /> : s.id === 'new' ? <ListMusic size={11} /> : null} {STEP_LABEL[s.id]}
            </span>
          ))}
        </div>
      </div>
      <div className="relative text-right">
        <div className="text-sm font-bold">{p.complete ? 'Ver resumen' : p.finished ? `Continuar (${p.finished}/${p.total})` : `Empezar · ~${total} min`}</div>
      </div>
      <ChevronRight size={20} className="relative text-muted transition-transform group-hover:translate-x-1" />
    </a>
  )
}
