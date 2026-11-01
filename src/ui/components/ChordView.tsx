import { pitchClass } from '../../core/music/notes'
import type { PracticeSession } from '../../core/practice/PracticeSession'
import { parseChordSymbol, CHORD_TYPE_BY_ID } from '../../core/music/theory'
import { PianoKeyboard, type KeyMark } from './PianoKeyboard'

/** Vista de acordes y progresión, sincronizada con el reloj de la sesión. */
export function ChordView({ session }: { session: PracticeSession }) {
  const chords = session.timeline.chords
  const t = session.songTime()
  const idx = chords.findIndex((c) => c.start <= t + 0.05 && c.start + c.duration > t + 0.05)
  const cur = idx >= 0 ? chords[idx] : chords.find((c) => c.start > t)
  const next = idx >= 0 ? chords[idx + 1] : chords[chords.indexOf(cur!) + 1]
  const marks = new Map<number, KeyMark>()
  if (cur) {
    const p = parseChordSymbol(cur.symbol)
    for (let m = 48; m <= 72; m++) if (cur.pcs.includes(pitchClass(m))) marks.set(m, p && pitchClass(m) === p.rootPc ? 'root' : 'chord')
  }
  if (!chords.length) {
    return <div className="grid h-[260px] place-items-center text-sm text-muted">Esta pieza no tiene acordes definidos. Usa la vista de notas o el piano roll.</div>
  }
  const p = cur ? parseChordSymbol(cur.symbol) : null
  return (
    <div className="flex h-[260px] flex-col gap-3 p-4">
      <div className="flex items-end gap-6">
        <div>
          <div className="label">Ahora</div>
          <div className="text-6xl font-black tracking-tight" style={{ color: 'var(--accent)' }}>
            {cur?.symbol ?? '—'}
          </div>
          {p && <div className="text-sm text-muted">{CHORD_TYPE_BY_ID[p.typeId].name}</div>}
        </div>
        <div className="pb-2">
          <div className="label">Siguiente</div>
          <div className="text-3xl font-extrabold text-muted">{next?.symbol ?? '—'}</div>
        </div>
        <div className="ml-auto w-[320px] max-w-[45%]">
          <PianoKeyboard low={48} high={72} height={80} marks={marks} interactive={false} labels="c-only" />
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {chords.map((c, i) => (
          <div
            key={i}
            className="shrink-0 rounded-lg border px-3 py-2 text-center text-sm font-bold transition-colors"
            style={{
              minWidth: Math.max(48, c.duration * 22),
              borderColor: i === idx ? 'var(--accent)' : 'var(--border)',
              background: i === idx ? 'color-mix(in oklab, var(--accent) 22%, transparent)' : i < idx ? 'var(--surface-2)' : 'var(--surface)',
              color: i < idx ? 'var(--faint)' : undefined,
            }}
          >
            {c.symbol}
          </div>
        ))}
      </div>
    </div>
  )
}
