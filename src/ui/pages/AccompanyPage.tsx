import { ArrowLeft, Hand, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { canAccompany, chordChart, COMPING_PATTERNS, compingArrangement, type CompingPattern } from '../../core/songs/accompaniment'
import { beatsPerBar } from '../../core/songs/schema'
import { href } from '../../lib/router'
import { findSong, useLibrary } from '../../state/library'
import { PageHeader } from '../layout/Shell'
import { PracticePlayer } from '../components/PracticePlayer'
import { TypeBadge } from './SongsPage'

/**
 * Acompañar con cifrados: solo ves los acordes, eliges un patrón para la izquierda,
 * la app toca la melodía y se evalúa si cambias de acorde a tiempo (cualquier posición vale).
 */
export function AccompanyPage({ songId }: { songId: string }) {
  const { userSongs } = useLibrary()
  const song = findSong(songId, userSongs)
  const [pattern, setPattern] = useState<CompingPattern>('root')
  const arrangement = useMemo(() => (song && canAccompany(song) ? compingArrangement(song, pattern) : null), [song, pattern])
  const chart = useMemo(() => (song ? chordChart(song) : []), [song])

  if (!song) return <div className="text-muted">Canción no encontrada.</div>
  const back = (
    <a href={href(`/songs/${songId}`)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft size={14} /> {song.title}
    </a>
  )
  if (!arrangement) {
    return (
      <div className="space-y-4">
        {back}
        <div className="card p-5 text-sm text-muted">
          Esta canción no tiene acordes definidos, así que no se puede acompañar con cifrados. Pide a Claude Code una versión con acordes (/cancion) o importa un archivo que los incluya.
        </div>
      </div>
    )
  }
  const bar = beatsPerBar(song.timeSignature)
  const sectionAt = (b: number) => song.sections.find((s) => Math.abs(s.start - b * bar) < 1e-6)

  return (
    <div className="space-y-5">
      {back}
      <PageHeader
        title="Acompañar con cifrados"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text">{song.title}</span>
            {song.artist && <span>{song.artist}</span>}
            <TypeBadge type={song.arrangementType} />
          </span>
        }
      />

      <div className="card space-y-3 p-5">
        <div className="flex items-start gap-2 text-sm text-muted">
          <Info size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
          <span>
            La app toca la melodía y tú acompañas con la <b style={{ color: 'var(--lh)' }}>mano izquierda</b> leyendo solo los acordes. Vale cualquier posición u octava: se evalúa que las notas
            pertenezcan al acorde y que llegues a tiempo a cada cambio. Toca solo el acompañamiento (las notas de la melodía contarían como fuera del acorde).
          </span>
        </div>
        <div className="label">Patrón de mano izquierda</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {COMPING_PATTERNS.map((p) => (
            <button
              key={p.id}
              aria-pressed={pattern === p.id}
              onClick={() => setPattern(p.id)}
              className="card-flat p-3 text-left transition-colors"
              style={pattern === p.id ? { borderColor: 'var(--lh)', background: 'color-mix(in oklab, var(--lh) 10%, var(--surface-2))' } : undefined}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Hand size={13} style={{ color: 'var(--lh)', transform: 'scaleX(-1)' }} /> {p.name}
              </div>
              <div className="text-xs text-muted">{p.description}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-faint">El patrón es tu guía: pulsa «Escuchar» en el reproductor para oírlo con la melodía, o activa «Ayudas» y la vista «Notas» para verlo caer.</p>
      </div>

      <div className="card p-5">
        <div className="label mb-2">Hoja de cifrados</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" data-testid="chord-chart">
          {chart.map((b) => {
            const s = sectionAt(b.bar)
            return (
              <div key={b.bar} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5">
                <div className="flex justify-between text-[10px] text-faint">
                  <span>{b.bar + 1}</span>
                  {s && (
                    <span className="font-semibold" style={{ color: 'var(--accent-2)' }}>
                      {s.name}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-lg font-black">{b.chords.length ? b.chords.map((c, i) => <span key={i}>{c.symbol}</span>) : <span className="text-faint">%</span>}</div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-faint">«%» = se repite el acorde del compás anterior. «G/B» = Sol mayor con Si en el bajo.</p>
      </div>

      <PracticePlayer
        key={arrangement.id}
        arrangement={arrangement}
        refId={`acomp:${song.id}`}
        kind="song"
        title={`${song.title} · acompañamiento (${COMPING_PATTERNS.find((p) => p.id === pattern)!.name.toLowerCase()})`}
        skills={['accompaniment', 'chord-changes', 'left-hand']}
        defaultMode="comp"
        modes={['comp', 'listen']}
        defaultHands="L"
        defaultView="chords"
        defaultAssist="none"
      />
    </div>
  )
}
