import { useMemo, useRef, useState } from 'react'
import { useElementWidth } from '../../lib/hooks'

export interface Series {
  key: string
  label: string
  color: string
  values: (number | null)[]
}

/**
 * Gráfico de líneas SVG (escala única 0–100): líneas de 2 px, marcadores ≥ 8 px,
 * cuadrícula discreta, leyenda + etiqueta directa del último valor, cruz y tooltip
 * al pasar el ratón, y vista de tabla accesible.
 */
export function LineChart({ labels, series, height = 240, yMax = 100 }: { labels: string[]; series: Series[]; height?: number; yMax?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const pad = { l: 34, r: 74, t: 12, b: 26 }
  const w = Math.max(200, width)
  const iw = w - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const n = labels.length
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => pad.t + ih - (v / yMax) * ih
  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = ''
        let pen = false
        s.values.forEach((v, i) => {
          if (v === null) {
            pen = false
            return
          }
          d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
          pen = true
        })
        return d
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, w, height, n],
  )
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 80))))
  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const px = e.clientX - r.left
    const i = n <= 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }
  const lastIdx = (s: Series) => {
    for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null) return i
    return -1
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-muted">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setTable(!table)}>
          {table ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>
      {table ? (
        <div className="max-h-[260px] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Día</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l} className="border-t border-border">
                  <td className="px-3 py-1.5">{l}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 tabular-nums">
                      {s.values[i] === null ? '—' : Math.round(s.values[i]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          <svg ref={svgRef} width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`Evolución: ${series.map((s) => s.label).join(', ')}`}>
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : '2 4'} />
                <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--faint)">
                  {v}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % tickEvery === 0 || i === n - 1 ? (
                <text key={l} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--faint)">
                  {l}
                </text>
              ) : null,
            )}
            {series.map((s, si) => (
              <g key={s.key}>
                <path d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) => (v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={n > 30 ? 2.5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />))}
                {lastIdx(s) >= 0 && (
                  <text x={x(lastIdx(s)) + 8} y={y(s.values[lastIdx(s)]!) + 4} fontSize={11} fontWeight={600} fill="var(--muted)">
                    {s.label.split(' ')[0]} {Math.round(s.values[lastIdx(s)]!)}
                  </text>
                )}
              </g>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--muted)" strokeWidth={1} />}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg" style={{ left: Math.min(x(hover) + 12, w - 160) }}>
              <div className="mb-1 font-semibold">{labels[hover]}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-muted">{s.label}</span>
                  <span className="font-semibold tabular-nums text-text">{s.values[hover] === null ? '—' : Math.round(s.values[hover]!)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
