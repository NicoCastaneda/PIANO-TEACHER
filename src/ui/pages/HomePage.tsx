import { ArrowRight, Dumbbell, Flame, GraduationCap, Music, Piano, Sparkles, Timer, Usb } from 'lucide-react'
import { midiService } from '../../core/midi/MidiService'
import { ALL_LESSONS, CURRICULUM, nextLesson } from '../../core/curriculum/curriculum'
import { recommendations, summary } from '../../core/progress/stats'
import { href } from '../../lib/router'
import { useHeldNotes, useMidiState } from '../../lib/hooks'
import { useProgress } from '../../state/library'
import { PianoKeyboard } from '../components/PianoKeyboard'
import { recTarget } from './ProgressPage'
import { TodayCard } from './TodayPage'

function fmtDuration(sec: number) {
  const m = Math.round(sec / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

export function HomePage() {
  const { attempts, lessons } = useProgress()
  const midi = useMidiState()
  const held = useHeldNotes()
  const completed = new Set(lessons.filter((l) => l.completedAt).map((l) => l.id))
  const next = nextLesson(completed)
  const sum = summary(attempts)
  const recs = recommendations(attempts).slice(0, 2)
  const level = next ? CURRICULUM.find((l) => l.id === next.level)! : CURRICULUM[4]
  const levelDone = level.lessons.filter((l) => completed.has(l.id)).length
  const connected = midi.status === 'ready' && midi.inputConnected

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="card relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--accent)' }} />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--accent-2)' }} />
        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="chip mb-3">
              <Sparkles size={12} /> Nivel {level.id} · {level.name}
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">{next ? 'Tu siguiente paso' : '¡Has completado el programa!'}</h1>
            {next && (
              <>
                <p className="mt-2 text-lg font-semibold">{next.title}</p>
                <p className="mt-1 max-w-xl text-muted">{next.objective}</p>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {next && (
                <a className="btn btn-primary" href={href(`/learn/${next.id}`)}>
                  Continuar lección <ArrowRight size={16} />
                </a>
              )}
              <a className="btn" href={href('/practice')}>
                <Dumbbell size={16} /> Práctica libre
              </a>
              <a className="btn" href={href('/songs')}>
                <Music size={16} /> Canciones
              </a>
            </div>
            <div className="mt-5 max-w-md">
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Progreso del nivel {level.id}</span>
                <span>
                  {levelDone}/{level.lessons.length} lecciones · {completed.size}/{ALL_LESSONS.length} en total
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(levelDone / level.lessons.length) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="card-flat flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
              <Usb size={16} style={{ color: connected ? 'var(--ok)' : 'var(--miss)' }} />
              <span className="font-bold">{connected ? 'Teclado conectado' : 'Conecta tu Casio CT-S300'}</span>
            </div>
            <p className="text-sm text-muted">
              {connected
                ? 'Toca cualquier tecla del Casio: se iluminará aquí abajo al instante.'
                : midi.status === 'unsupported'
                  ? 'Tu navegador no soporta Web MIDI. Usa Google Chrome o Microsoft Edge en Windows.'
                  : 'Conecta el cable USB (A a Micro-B, con datos) y pulsa el botón. El navegador te pedirá permiso para acceder a dispositivos MIDI.'}
            </p>
            {!connected && midi.status !== 'unsupported' && (
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => void midiService.connect()}>
                  Conectar teclado
                </button>
                <a className="btn btn-sm" href={href('/settings/midi')}>
                  Ayuda y diagnóstico
                </a>
              </div>
            )}
            <div className="mt-auto rounded-xl bg-surface p-2">
              <PianoKeyboard height={70} held={held} labels="none" low={48} high={84} />
            </div>
          </div>
        </div>
      </section>

      <TodayCard />

      {/* Resumen */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Flame size={18} />} label="Racha" value={sum.streak.current ? `${sum.streak.current} día${sum.streak.current > 1 ? 's' : ''}` : '—'} sub={sum.streak.best ? `Mejor: ${sum.streak.best}` : 'Practica hoy para empezar'} color="var(--miss)" />
        <Tile icon={<Timer size={18} />} label="Tiempo de práctica" value={sum.totalAttempts ? fmtDuration(sum.totalPracticeSec) : '—'} sub={`${sum.last7Days} sesiones en 7 días`} color="var(--rh)" />
        <Tile icon={<GraduationCap size={18} />} label="Lecciones" value={`${completed.size}/${ALL_LESSONS.length}`} sub="completadas" color="var(--accent)" />
        <Tile icon={<Piano size={18} />} label="Puntuación media" value={sum.avgScore === null ? '—' : Math.round(sum.avgScore)} sub={sum.avgNoteAccuracy === null ? 'Sin datos todavía' : `${Math.round(sum.avgNoteAccuracy * 100)} % de notas correctas`} color="var(--ok)" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Recomendado para ti</h2>
          {recs.length ? (
            <div className="space-y-2">
              {recs.map((r) => (
                <a key={r.id} href={recTarget(r)} className="card-flat block p-3 transition-colors hover:border-accent">
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-sm text-muted">{r.reason}</div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Las recomendaciones aparecerán cuando hayas completado algunos ejercicios con tempo. Se basan únicamente en tus resultados registrados.</p>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Actividad reciente</h2>
          {attempts.length ? (
            <div className="divide-y divide-border">
              {[...attempts]
                .reverse()
                .slice(0, 6)
                .map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-2">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black tabular-nums" style={{ background: 'var(--surface-2)', color: a.score >= 85 ? 'var(--ok)' : a.score >= 60 ? 'var(--miss)' : 'var(--bad)' }}>
                      {Math.round(a.score)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{a.title}</div>
                      <div className="text-xs text-muted">
                        {new Date(a.at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} · {a.refId.startsWith('acomp:') ? 'acompañamiento' : a.mode === 'wait' ? 'guiado' : a.mode === 'improv' ? 'improvisación' : 'con tempo'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Aún no hay intentos registrados. ¡Empieza por la primera lección!</p>
          )}
        </section>
      </div>
    </div>
  )
}

function Tile({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-muted">
        <span style={{ color }}>{icon}</span>
        <span className="label">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      <div className="truncate text-xs text-muted">{sub}</div>
    </div>
  )
}
