import { Download, MessageCircleQuestion, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { ALL_LESSONS } from '../../core/curriculum/curriculum'
import { dailySeries, recommendations, skillStats, summary, type Recommendation } from '../../core/progress/stats'
import { exportAll, importAll } from '../../core/storage/db'
import { href } from '../../lib/router'
import { CopyLine } from './SongsPage'
import { useEarTrainer } from '../../state/earTrainer'
import { useChordTrainer } from '../../state/chordTrainer'
import { useLibrary, useProgress } from '../../state/library'
import { useSettings } from '../../state/settings'
import { PageHeader } from '../layout/Shell'
import { LineChart } from '../components/LineChart'

export function recTarget(r: Recommendation) {
  if (r.target.kind === 'practice') return href(`/practice/${r.target.preset}`)
  if (r.target.kind === 'lesson') return href(`/learn/${r.target.lessonId}`)
  return href(`/songs/${r.target.songId.replace(/-(beginner|intermediate|advanced)$/, '')}?section=${r.target.sectionId}`)
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function DataTransfer() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const reload = async () => {
    await Promise.all([useProgress.getState().load(), useLibrary.getState().load(), useSettings.getState().load(), useChordTrainer.getState().load(), useEarTrainer.getState().load()])
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn btn-sm" onClick={async () => downloadJson(`piano-coach-${new Date().toISOString().slice(0, 10)}.json`, await exportAll())}>
        <Download size={14} /> Exportar datos
      </button>
      <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
        <Upload size={14} /> Importar datos
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          try {
            const r = await importAll(JSON.parse(await f.text()), true)
            await reload()
            setMsg(`Importados: ${r.attempts} intentos, ${r.lessons} lecciones, ${r.songs} canciones.`)
          } catch (err) {
            setMsg((err as Error).message)
          }
          e.target.value = ''
        }}
      />
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  )
}

export function ProgressPage() {
  const { attempts, lessons } = useProgress()
  const sum = summary(attempts)
  const series = dailySeries(attempts)
  const skills = skillStats(attempts)
  const recs = recommendations(attempts)
  const completed = lessons.filter((l) => l.completedAt).length
  const weak = skills.filter((s) => s.level < 70).sort((a, b) => a.level - b.level)

  return (
    <div className="space-y-6">
      <PageHeader title="Progreso" subtitle="Todo lo que ves aquí se calcula a partir de tus intentos reales registrados en este navegador. Los eventos simulados nunca se guardan." actions={<DataTransfer />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Intentos" value={sum.totalAttempts} />
        <Kpi label="Tiempo total" value={sum.totalPracticeSec < 60 ? `${Math.round(sum.totalPracticeSec)} s` : `${Math.round(sum.totalPracticeSec / 60)} min`} />
        <Kpi label="Racha actual" value={`${sum.streak.current} d`} sub={`Mejor: ${sum.streak.best} d`} />
        <Kpi label="Lecciones" value={`${completed}/${ALL_LESSONS.length}`} />
        <Kpi label="Canciones trabajadas" value={sum.songsPracticed} />
      </div>

      {attempts.length === 0 ? (
        <div className="card p-8 text-center text-muted">Todavía no hay datos. Completa un ejercicio para ver tu evolución.</div>
      ) : (
        <>
          <div className="card p-5">
            <h2 className="mb-1 text-lg font-bold">Evolución diaria</h2>
            <p className="mb-3 text-xs text-muted">Media por día (0–100). Precisión rítmica solo en ejercicios con tempo.</p>
            <LineChart
              labels={series.map((d) => d.day.slice(5).split('-').reverse().join('/'))}
              series={[
                { key: 'score', label: 'Puntuación', color: 'var(--series-1)', values: series.map((d) => d.score) },
                { key: 'notes', label: 'Notas correctas', color: 'var(--series-2)', values: series.map((d) => d.notes) },
                { key: 'timing', label: 'Precisión rítmica', color: 'var(--series-3)', values: series.map((d) => d.timing) },
              ]}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-3 text-lg font-bold">Habilidades</h2>
              <div className="space-y-2.5">
                {skills.map((s) => (
                  <div key={s.skill}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">
                        {s.label} {s.mastered && <span className="chip ml-1 text-[10px]" style={{ color: 'var(--ok)' }}>Dominada</span>}
                      </span>
                      <span className="tabular-nums text-muted">
                        {s.level} · {s.attempts} int.
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full" style={{ width: `${s.level}%`, background: 'var(--series-1)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-faint">Nivel = media móvil de tus puntuaciones (los intentos recientes pesan más). "Dominada" = los 2–3 últimos intentos ≥ 85.</p>
            </div>
            <div className="space-y-6">
              <div className="card p-5">
                <h2 className="mb-3 text-lg font-bold">Recomendaciones</h2>
                {recs.length ? (
                  <div className="space-y-2">
                    {recs.map((r) => (
                      <a key={r.id} href={recTarget(r)} className="card-flat block p-3 hover:border-accent">
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-sm text-muted">{r.reason}</div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No hay suficientes intentos con tempo para recomendar algo concreto.</p>
                )}
              </div>
              <div className="card p-5">
                <h2 className="mb-2 text-lg font-bold">Áreas a reforzar</h2>
                {weak.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {weak.map((s) => (
                      <span key={s.skill} className="chip">
                        {s.label}: {s.level}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Ninguna habilidad por debajo de 70.</p>
                )}
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <MessageCircleQuestion size={14} /> Consejos del profesor (Claude Code)
                  </div>
                  <p className="text-xs text-muted">
                    Pulsa <b>Exportar datos</b> (arriba) y, en Claude Code, escribe <span className="kbd">/coach</span> con la ruta del archivo. Claude calcula el resumen con el mismo código que esta página y basa cada consejo en esas cifras.
                  </p>
                  <CopyLine text="/coach C:\Users\…\Downloads\piano-coach-AAAA-MM-DD.json" />
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Historial</h2>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Actividad</th>
                    <th className="py-2 pr-3">Modo</th>
                    <th className="py-2 pr-3 text-right">Puntos</th>
                    <th className="py-2 pr-3 text-right">Notas</th>
                    <th className="py-2 pr-3 text-right">Ritmo</th>
                    <th className="py-2 pr-3 text-right">Omit./Incorr./Extra</th>
                    <th className="py-2 pr-3">Entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {[...attempts].reverse().map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-1.5 pr-3 whitespace-nowrap text-muted">{new Date(a.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="py-1.5 pr-3">{a.title}</td>
                      <td className="py-1.5 pr-3 text-muted">{a.refId.startsWith('chord-exam') ? 'Examen' : a.refId.startsWith('acomp:') ? 'Acomp.' : a.mode === 'wait' ? 'Guiado' : a.mode === 'improv' ? 'Improv.' : a.kind === 'challenge' ? 'Desafío' : 'Tempo'}</td>
                      <td className="py-1.5 pr-3 text-right font-bold tabular-nums">{Math.round(a.score)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{Math.round(a.noteAccuracy * 100)} %</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{a.timingScore === null ? '—' : `${Math.round(a.timingScore * 100)} %`}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted">
                        {a.counts.missed}/{a.counts.wrong + a.counts.octave}/{a.counts.extra}
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-muted">{a.input === 'midi' ? 'MIDI' : a.input === 'mouse' ? 'Ratón' : a.input === 'computer-keyboard' ? 'Teclado PC' : a.input}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}
