import { AlertTriangle, ArrowRight, Info, RotateCcw, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { midiToName } from '../../core/music/notes'
import type { SessionResult } from '../../core/practice/PracticeSession'
import type { EvaluationResult } from '../../core/scoring/types'
import { noteNameOpts, useSettings } from '../../state/settings'
import { CompingResults } from './CompingResults'
import { ResultTimeline } from './PianoRoll'

export function feedbackFor(ev: EvaluationResult): { tone: 'good' | 'warn' | 'info'; text: string }[] {
  const out: { tone: 'good' | 'warn' | 'info'; text: string }[] = []
  const c = ev.counts
  const off = ev.timing.meanOffsetMs
  if (ev.score >= 90) out.push({ tone: 'good', text: 'Excelente interpretación. Prueba a subir el tempo o reducir las ayudas visuales.' })
  if (c.expected && c.missed / c.expected > 0.2) out.push({ tone: 'warn', text: `Omitiste ${c.missed} de ${c.expected} notas. Reduce el tempo o usa el modo guiado (espera) para aprender las posiciones.` })
  if (c.wrong + c.octave > 2) out.push({ tone: 'warn', text: `${c.wrong + c.octave} notas incorrectas${c.octave ? ` (${c.octave} en la octava equivocada)` : ''}. Mira el teclado de la pantalla antes de cada cambio.` })
  if (off !== null && c.hits >= 4 && Math.abs(off) > 35) out.push({ tone: 'warn', text: off > 0 ? `Tiendes a retrasarte (de media +${Math.round(off)} ms). Escucha el metrónomo y anticipa el movimiento.` : `Tiendes a adelantarte (de media ${Math.round(off)} ms). No corras: espera al pulso.` })
  if (ev.timing.stdDevMs !== null && ev.timing.stdDevMs > 70 && c.hits >= 6) out.push({ tone: 'info', text: `Tu ritmo es irregular (variación ±${Math.round(ev.timing.stdDevMs)} ms). Practica con metrónomo a un tempo más lento.` })
  if (c.shortReleases > 2) out.push({ tone: 'info', text: `Soltaste ${c.shortReleases} notas antes de tiempo. Mantén la tecla hasta el final de la barra.` })
  if (c.longReleases > 2) out.push({ tone: 'info', text: `Mantuviste ${c.longReleases} notas demasiado tiempo. Suelta al empezar la siguiente.` })
  if (ev.chords.total && ev.chords.complete > ev.chords.simultaneous + 1) out.push({ tone: 'info', text: 'Algunos acordes salieron "arpegiados": baja todos los dedos a la vez.' })
  if (c.extra > Math.max(2, c.expected * 0.15)) out.push({ tone: 'warn', text: `${c.extra} notas adicionales. Coloca la mano antes de tocar y evita rozar teclas vecinas.` })
  const weak = [...ev.sections].filter((s) => s.expected > 0 && s.accuracy < 0.75).sort((a, b) => a.accuracy - b.accuracy)[0]
  if (weak) out.push({ tone: 'info', text: `La sección "${weak.name}" es la más difícil (${Math.round(weak.accuracy * 100)} %). Practícala sola en bucle.` })
  if (!out.length) out.push({ tone: 'good', text: 'Buen trabajo. Repite para consolidar o pasa al siguiente reto.' })
  return out
}

function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="card-flat px-4 py-3">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

function Bar({ label, value, color, hint }: { label: string; value: number | null; color: string; hint?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-muted">{value === null ? 'no evaluado' : `${Math.round(value * 100)} %`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(value ?? 0) * 100}%`, background: color, opacity: value === null ? 0.25 : 1 }} />
      </div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  )
}

export function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const color = score >= 85 ? 'var(--ok)' : score >= 60 ? 'var(--miss)' : 'var(--bad)'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-4xl font-black tabular-nums">{Math.round(score)}</div>
          <div className="text-xs font-semibold text-muted">de 100</div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  result: SessionResult
  passScore?: number
  onRetry: () => void
  onNext?: () => void
  nextLabel?: string
  onPracticeSection?: (sectionId: string) => void
  saved: boolean
}

export function ResultsView({ result, passScore, onRetry, onNext, nextLabel, onPracticeSection, saved }: Props) {
  const settings = useSettings()
  const opts = noteNameOpts(settings)
  const ev = result.evaluation
  const passed = passScore === undefined ? undefined : result.score >= passScore
  const simulated = result.input === 'simulated' || result.input === 'mixed'

  return (
    <div className="animate-pop space-y-5">
      <div className="flex flex-wrap items-center gap-6">
        <ScoreRing score={result.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-extrabold">{passed === undefined ? 'Resultado' : passed ? '¡Superado!' : 'Sigue practicando'}</h3>
            {passScore !== undefined && <span className="chip">Objetivo: {passScore}</span>}
            {result.input === 'midi' && <span className="chip" style={{ color: 'var(--accent-2)' }}>Teclado MIDI</span>}
            {(result.input === 'mouse' || result.input === 'computer-keyboard') && <span className="chip">Entrada: {result.input === 'mouse' ? 'ratón' : 'teclado del ordenador'}</span>}
            {simulated && (
              <span className="chip" style={{ color: 'var(--miss)', borderColor: 'var(--miss)' }}>
                <AlertTriangle size={12} /> Incluye eventos SIMULADOS — no se guarda en tu progreso
              </span>
            )}
          </div>
          {ev && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Bar label="Notas correctas" value={ev.noteAccuracy} color="var(--ok)" />
              <Bar label="Precisión rítmica" value={ev.breakdown.timingScore} color="var(--rh)" />
              <Bar label="Duración" value={ev.breakdown.durationScore} color="var(--lh)" hint={ev.breakdown.durationScore === null ? 'No forma parte de este ejercicio' : undefined} />
            </div>
          )}
          {result.wait && <p className="mt-2 text-sm text-muted">Modo guiado: la música esperó a que tocaras cada nota, así que solo se cuentan los errores (no el ritmo).</p>}
          {result.improv && <p className="mt-2 text-sm text-muted">{Math.round(result.improv.inScale * 100)} % de tus {result.improv.notes} notas pertenecen a la escala.</p>}
          {result.comping && <p className="mt-2 text-sm text-muted">Acompañamiento con cifrados: vale cualquier posición u octava del acorde; se evalúa la armonía y la llegada a cada cambio.</p>}
        </div>
      </div>
      {result.comping && <CompingResults c={result.comping} />}

      {ev && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Stat label="Aciertos" value={`${ev.counts.hits}/${ev.counts.expected}`} color="var(--ok)" />
            <Stat label="Incorrectas" value={ev.counts.wrong + ev.counts.octave} sub={ev.counts.octave ? `${ev.counts.octave} de octava` : undefined} color="var(--bad)" />
            <Stat label="Omitidas" value={ev.counts.missed} color="var(--miss)" />
            <Stat label="Adicionales" value={ev.counts.extra} color="var(--extra)" />
            <Stat label="Mejor racha" value={ev.bestStreak} sub="notas seguidas" />
            <Stat
              label="Acordes"
              value={ev.chords.total ? `${ev.chords.complete}/${ev.chords.total}` : '—'}
              sub={ev.chords.total ? `${ev.chords.simultaneous} simultáneos` : 'sin acordes'}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label="Desfase medio" value={ev.timing.meanOffsetMs === null ? '—' : `${ev.timing.meanOffsetMs > 0 ? '+' : ''}${Math.round(ev.timing.meanOffsetMs)} ms`} sub={ev.timing.meanOffsetMs === null ? undefined : ev.timing.meanOffsetMs > 0 ? 'tendencia a retrasarte' : 'tendencia a adelantarte'} />
            <Stat label="Regularidad" value={ev.timing.stdDevMs === null ? '—' : `±${Math.round(ev.timing.stdDevMs)} ms`} sub="desviación del ritmo" />
            <Stat label="A tiempo / pronto / tarde" value={`${ev.counts.onTime} / ${ev.counts.early} / ${ev.counts.late}`} />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="font-semibold text-text">Esperado vs. tocado</span>
              <Legend color="var(--ok)" label="Correcta" />
              <Legend color="var(--bad)" label="Incorrecta" />
              <Legend color="var(--miss)" label="Omitida" />
              <Legend color="var(--extra)" label="Adicional" />
              <Legend color="var(--text)" label="Lo que tocaste" thin />
            </div>
            <ResultTimeline outcomes={ev.outcomes} extras={ev.extras} played={result.played.map((p) => ({ ...p, start: p.start - result.evalFrom, end: p.end === null ? null : p.end - result.evalFrom }))} lengthSec={ev.durationSec} />
            {ev.outcomes.some((o) => o.status !== 'hit') && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ev.outcomes.slice(0, 120).map((o) => (
                  <span
                    key={o.expected.id}
                    title={o.status === 'hit' ? `${midiToName(o.expected.midi, opts)} ${o.timingMs !== undefined ? `${o.timingMs > 0 ? '+' : ''}${Math.round(o.timingMs)} ms` : ''}` : o.status === 'missed' ? `Omitida: ${midiToName(o.expected.midi, opts)}` : `Esperada ${midiToName(o.expected.midi, opts)}, tocaste ${o.played ? midiToName(o.played.midi, opts) : '?'}`}
                    className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold"
                    style={{
                      background: `color-mix(in oklab, ${o.status === 'hit' ? 'var(--ok)' : o.status === 'missed' ? 'var(--miss)' : 'var(--bad)'} 22%, transparent)`,
                      color: o.status === 'hit' ? 'var(--ok)' : o.status === 'missed' ? 'var(--miss)' : 'var(--bad)',
                      textDecoration: o.status === 'missed' ? 'line-through' : undefined,
                    }}
                  >
                    {midiToName(o.expected.midi, { ...opts, withOctave: false })}
                    {(o.status === 'wrong' || o.status === 'octave') && o.played ? `→${midiToName(o.played.midi, { ...opts, withOctave: o.status === 'octave' })}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {ev.sections.length > 1 && (
            <div>
              <div className="label mb-2">Por sección</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ev.sections.map((s) => (
                  <div key={s.id} className="card-flat flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <div className="text-xs text-muted">
                        {Math.round(s.accuracy * 100)} % · {s.hits}/{s.expected} notas{s.meanAbsTimingMs !== null ? ` · ±${Math.round(s.meanAbsTimingMs)} ms` : ''}
                      </div>
                    </div>
                    {onPracticeSection && s.accuracy < 0.9 && (
                      <button className="btn btn-sm" onClick={() => onPracticeSection(s.id)}>
                        <Target size={14} /> Practicar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {ev && (
        <div className="space-y-2">
          {feedbackFor(ev).map((f, i) => (
            <div key={i} className="flex gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: `color-mix(in oklab, ${f.tone === 'good' ? 'var(--ok)' : f.tone === 'warn' ? 'var(--miss)' : 'var(--rh)'} 12%, transparent)` }}>
              <Info size={16} className="mt-0.5 shrink-0" style={{ color: f.tone === 'good' ? 'var(--ok)' : f.tone === 'warn' ? 'var(--miss)' : 'var(--rh)' }} />
              {f.text}
            </div>
          ))}
        </div>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer font-semibold">¿Cómo se calcula la puntuación?</summary>
        <div className="mt-2 space-y-1 font-mono">
          <div>{ev?.breakdown.formula ?? result.wait?.formula ?? result.improv?.formula ?? result.comping?.formula}</div>
          {ev && (
            <div>
              N = {ev.breakdown.noteScore.toFixed(3)} · R = {ev.breakdown.timingScore?.toFixed(3) ?? '—'} · D = {ev.breakdown.durationScore?.toFixed(3) ?? '—'} · V = {ev.breakdown.dynamicsScore?.toFixed(3) ?? '—'}
            </div>
          )}
          <div className="font-sans">R: 100 % dentro de la ventana "perfecta"; baja linealmente hasta 25 % en el borde de la ventana. Fuera de la ventana la nota no cuenta como acierto. Las ventanas dependen del nivel (Ajustes → Evaluación), del tempo y de la distancia entre notas repetidas.</div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={onRetry}>
          <RotateCcw size={16} /> Repetir
        </button>
        {onNext && (
          <button className="btn btn-primary" onClick={onNext}>
            {nextLabel ?? 'Continuar'} <ArrowRight size={16} />
          </button>
        )}
        <span className="text-xs text-faint">{saved ? 'Guardado en tu progreso.' : simulated ? '' : 'No guardado.'}</span>
      </div>
    </div>
  )
}

function Legend({ color, label, thin }: { color: string; label: string; thin?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block rounded-sm" style={{ background: color, width: 12, height: thin ? 3 : 9 }} />
      {label}
    </span>
  )
}
