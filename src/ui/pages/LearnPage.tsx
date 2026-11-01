import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Ear, GraduationCap, Layers, ListMusic, Lock, Play, Sparkles, Target, Volume2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { audioEngine } from '../../core/audio/AudioEngine'
import { ALL_LESSONS, CURRICULUM, LESSON_BY_ID, lessonStates, type Lesson } from '../../core/curriculum/curriculum'
import { SKILL_LABEL } from '../../core/practice/exercises'
import { makeDifficultyVersion } from '../../core/songs/adapt'
import { BUILTIN_SONGS } from '../../core/songs/library'
import { store } from '../../core/storage/db'
import { href, navigate } from '../../lib/router'
import { useHeldNotes } from '../../lib/hooks'
import { useProgress } from '../../state/library'
import { PageHeader } from '../layout/Shell'
import { PianoKeyboard, type KeyMark } from '../components/PianoKeyboard'
import { PracticePlayer } from '../components/PracticePlayer'

export function LearnPage() {
  const { lessons } = useProgress()
  const completed = new Set(lessons.filter((l) => l.completedAt).map((l) => l.id))
  const best = new Map(lessons.map((l) => [l.id, l.bestScore]))
  const states = lessonStates(completed)
  return (
    <div>
      <PageHeader
        title="Aprender"
        subtitle="Un programa progresivo desde cero hasta nivel avanzado. Cada lección: ver, escuchar, entender, practicar con tu Casio y recibir una evaluación real."
      />
      <a href={href('/learn/acordes')} className="card group relative mb-3 flex flex-wrap items-center gap-4 overflow-hidden p-5 transition-transform hover:-translate-y-0.5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--accent-2)' }} />
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
          <Layers size={22} />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="text-lg font-extrabold">Entrenador de acordes</div>
          <div className="text-sm text-muted">Tarjetas de memoria por grupos (fundamentales, útiles y ocasionales), inversiones, consejos y progresiones de pop, jazz, blues y más.</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="chip">
              <Layers size={11} /> Tarjetas
            </span>
            <span className="chip">
              <GraduationCap size={11} /> Modo examen
            </span>
            <span className="chip">
              <ListMusic size={11} /> Progresiones con inversiones
            </span>
          </div>
        </div>
        <ChevronRight size={20} className="relative text-muted transition-transform group-hover:translate-x-1" />
      </a>
      <a href={href('/practice/oido')} className="card group relative mb-8 flex flex-wrap items-center gap-4 overflow-hidden p-5 transition-transform hover:-translate-y-0.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--rh), var(--accent))' }}>
          <Ear size={22} />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="text-lg font-extrabold">Oído: reconocer y sacar de oído</div>
          <div className="text-sm text-muted">Distingue mayor y menor, inversiones e intervalos; repite en tu teclado acordes y melodías que solo escuchas.</div>
        </div>
        <ChevronRight size={20} className="relative text-muted transition-transform group-hover:translate-x-1" />
      </a>
      <div className="space-y-8">
        {CURRICULUM.map((level) => {
          const done = level.lessons.filter((l) => completed.has(l.id)).length
          return (
            <section key={level.id} className="animate-fade-up">
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl text-sm font-black text-white" style={{ background: `linear-gradient(135deg, var(--accent), var(--accent-2))` }}>
                  {level.id}
                </div>
                <h2 className="text-xl font-extrabold">{level.name}</h2>
                <span className="text-sm text-muted">{level.description}</span>
                <span className="ml-auto chip">
                  {done}/{level.lessons.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {level.lessons.map((l, i) => {
                  const st = states[l.id]
                  return (
                    <a key={l.id} href={href(`/learn/${l.id}`)} className="card group flex gap-3 p-4 transition-transform hover:-translate-y-0.5" style={{ opacity: st === 'locked' ? 0.7 : 1 }}>
                      <div className="mt-0.5">
                        {st === 'completed' ? <CheckCircle2 size={20} style={{ color: 'var(--ok)' }} /> : st === 'locked' ? <Lock size={18} className="text-faint" /> : <Circle size={20} style={{ color: 'var(--accent)' }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-faint">
                          {level.id}.{i + 1}
                        </div>
                        <div className="font-bold leading-snug">{l.title}</div>
                        <div className="mt-1 line-clamp-2 text-sm text-muted">{l.objective}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {l.skills.slice(0, 3).map((s) => (
                            <span key={s} className="chip text-[10px]">
                              {SKILL_LABEL[s]}
                            </span>
                          ))}
                          {best.get(l.id) ? <span className="chip text-[10px]">Mejor: {Math.round(best.get(l.id)!)}</span> : null}
                        </div>
                        {st === 'locked' && <div className="mt-2 text-xs text-faint">Bloqueada — puedes intentarla como prueba de dominio.</div>}
                      </div>
                    </a>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function buildLessonArrangement(l: Lesson) {
  const ref = l.exercise.songRef
  if (ref) {
    const song = BUILTIN_SONGS.find((s) => s.id === ref.songId)!
    return makeDifficultyVersion(song, ref.difficulty)
  }
  return l.exercise.build()
}

export function LessonPage({ lessonId }: { lessonId: string }) {
  const lesson = LESSON_BY_ID[lessonId]
  const { lessons, load } = useProgress()
  const held = useHeldNotes()
  const [step, setStep] = useState<'learn' | 'practice'>('learn')
  const [passedNow, setPassedNow] = useState<boolean | null>(null)
  const arrangement = useMemo(() => (lesson ? buildLessonArrangement(lesson) : null), [lesson])
  if (!lesson || !arrangement) return <div className="text-muted">Lección no encontrada.</div>
  const completed = new Set(lessons.filter((l) => l.completedAt).map((l) => l.id))
  const state = lessonStates(completed)[lesson.id]
  const idx = ALL_LESSONS.indexOf(lesson)
  const next = ALL_LESSONS[idx + 1]
  const level = CURRICULUM.find((c) => c.id === lesson.level)!
  const marks = new Map<number, KeyMark>((lesson.highlight ?? []).map((m) => [m, 'scale']))

  return (
    <div className="space-y-5">
      <a href={href('/learn')} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} /> Nivel {level.id}: {level.name}
      </a>
      <PageHeader
        title={lesson.title}
        subtitle={
          <span className="flex items-center gap-2">
            <Target size={16} className="shrink-0" style={{ color: 'var(--accent)' }} /> {lesson.objective}
          </span>
        }
        actions={
          <div className="seg">
            <button aria-pressed={step === 'learn'} onClick={() => setStep('learn')}>
              1 · Ver y escuchar
            </button>
            <button aria-pressed={step === 'practice'} onClick={() => setStep('practice')}>
              2 · Practicar y evaluar
            </button>
          </div>
        }
      />
      {state === 'locked' && (
        <div className="rounded-xl border border-miss/40 bg-miss/10 px-4 py-2 text-sm">
          Esta lección aún está bloqueada. Puedes hacer el ejercicio como <b>prueba de dominio</b>: si alcanzas {lesson.passScore} puntos se marcará como completada.
        </div>
      )}

      {step === 'learn' ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="card space-y-4 p-6">
            {lesson.explanation.map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed">
                {p}
              </p>
            ))}
            {lesson.tips?.map((t, i) => (
              <div key={i} className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
                <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /> {t}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn btn-primary" onClick={() => setStep('practice')}>
                <Play size={16} /> Ir al ejercicio
              </button>
            </div>
            <p className="text-xs text-faint">
              ¿Dudas? Pregúntale a Claude Code en la consola o en VS Code, por ejemplo: «explícame la lección “{lesson.title}” con un ejercicio para el teclado».
            </p>
          </div>
          <div className="card space-y-4 p-5">
            <div className="label">Demostración</div>
            <PianoKeyboard height={120} held={held} marks={marks} />
            {lesson.demos.length ? (
              <div className="flex flex-wrap gap-2">
                {lesson.demos.map((d) => (
                  <button key={d.label} className="btn btn-sm" onClick={() => void audioEngine.demo(d.notes, { arpeggio: d.kind !== 'chord', gapMs: d.gapMs ?? 300, durationMs: d.kind === 'chord' ? 1400 : 700 })}>
                    <Volume2 size={14} /> {d.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Pulsa "Escuchar" en el ejercicio para oír la referencia completa.</p>
            )}
            <p className="text-xs text-muted">Toca en tu Casio (o con el ratón) para explorar. Las teclas resaltadas son las protagonistas de esta lección.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-semibold text-text">{lesson.exercise.title}</span>
            <span>· Para superarla: {lesson.passScore} puntos</span>
            {lesson.exercise.mode === 'wait' && <span>· Sin tempo: la música espera a que encuentres cada nota.</span>}
            {passedNow && <span className="chip" style={{ color: 'var(--ok)' }}>Lección completada</span>}
          </div>
          <PracticePlayer
            key={lesson.id}
            arrangement={arrangement}
            refId={lesson.id}
            kind="lesson"
            title={lesson.exercise.title}
            skills={lesson.skills}
            defaultMode={lesson.exercise.mode === 'improv' ? 'improv' : lesson.exercise.mode}
            modes={lesson.exercise.mode === 'improv' ? ['improv', 'listen'] : ['wait', 'timed', 'listen']}
            defaultHands={lesson.exercise.hands}
            improv={lesson.exercise.improv}
            evaluateDuration={lesson.exercise.evaluateDuration}
            countInBars={lesson.exercise.countInBars}
            passScore={lesson.passScore}
            onResult={async (r, saved) => {
              if (!saved) return
              const passed = r.score >= lesson.passScore
              await store.recordLesson(lesson.id, r.score, passed)
              await load()
              if (passed) setPassedNow(true)
            }}
            onNext={next ? () => navigate(`/learn/${next.id}`) : undefined}
            nextLabel={next ? `Siguiente: ${next.title}` : undefined}
          />
        </div>
      )}
    </div>
  )
}
