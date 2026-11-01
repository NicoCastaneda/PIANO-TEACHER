import type { CompingResult, CompStatus } from '../../core/scoring/comping'

const COLOR: Record<CompStatus, string> = { ok: 'var(--ok)', early: 'var(--rh)', late: 'var(--miss)', wrong: 'var(--bad)', missed: 'var(--extra)' }
const LABEL: Record<CompStatus, string> = { ok: 'A tiempo', early: 'Pronto', late: 'Tarde', wrong: 'Notas fuera del acorde', missed: 'Sin tocar' }

function Bar({ label, value, color, hint }: { label: string; value: number | null; color: string; hint?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-muted">{value === null ? '—' : `${Math.round(value * 100)} %`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(value ?? 0) * 100}%`, background: color }} />
      </div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  )
}

export function compingFeedback(c: CompingResult): string[] {
  const out: string[] = []
  const n = c.counts.chords
  if (c.score >= 90) out.push('Acompañamiento sólido. Prueba otro patrón o sube el tempo.')
  if (c.counts.missed > n * 0.2) out.push(`No tocaste ${c.counts.missed} de ${n} acordes. Empieza con «Solo el bajo» y baja el tempo.`)
  if (c.counts.wrong > 1) out.push(`${c.counts.wrong} acordes con notas que no pertenecen al cifrado. Antes de cada cambio, mira el «Siguiente» y prepara la mano.`)
  if (c.meanLagMs !== null && c.meanLagMs > 60) out.push(`Llegas de media ${Math.round(c.meanLagMs)} ms tarde a los cambios: mueve la mano durante el último pulso del acorde anterior.`)
  if (c.meanLagMs !== null && c.meanLagMs < -60) out.push(`Te adelantas a los cambios (${Math.round(c.meanLagMs)} ms de media). Espera al pulso del cambio.`)
  if (c.bassAccuracy !== null && c.bassAccuracy < 0.7 && c.harmony > 0.7)
    out.push('Las notas del acorde están bien, pero la más grave no siempre es la del cifrado. En «G/B», por ejemplo, el bajo es Si.')
  if (!out.length) out.push('Buen trabajo. Repite para consolidar los cambios.')
  return out
}

export function CompingResults({ c }: { c: CompingResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Bar label="Armonía" value={c.harmony} color="var(--ok)" hint="Notas que pertenecen al acorde que suena" />
        <Bar label="Cambios a tiempo" value={c.punctuality} color="var(--rh)" hint={`Ventana ±${c.windowMs} ms`} />
        <Bar label="Bajo correcto" value={c.bassAccuracy} color="var(--lh)" hint="Informativo: no resta puntos" />
      </div>
      <div>
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted">
          {(Object.keys(LABEL) as CompStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[s] }} /> {LABEL[s]} ({c.counts[s]})
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="comp-strip">
          {c.outcomes.map((o, i) => (
            <div
              key={i}
              className="min-w-14 rounded-lg border px-2 py-1 text-center"
              style={{ borderColor: COLOR[o.status], background: `color-mix(in oklab, ${COLOR[o.status]} 14%, transparent)` }}
              title={`${o.symbol}: ${LABEL[o.status]}${o.offsetMs !== null ? ` (${o.offsetMs > 0 ? '+' : ''}${o.offsetMs} ms)` : ''}${o.notes.length ? ` · ${o.chordTones}/${o.notes.length} notas del acorde` : ''}${o.bassOk === false ? ' · bajo distinto' : ''}`}
            >
              <div className="text-sm font-black">{o.symbol}</div>
              <div className="text-[10px] tabular-nums text-muted">{o.offsetMs === null ? '—' : `${o.offsetMs > 0 ? '+' : ''}${o.offsetMs} ms`}</div>
            </div>
          ))}
        </div>
      </div>
      <ul className="space-y-1 text-sm text-muted">
        {compingFeedback(c).map((t, i) => (
          <li key={i}>• {t}</li>
        ))}
      </ul>
    </div>
  )
}
