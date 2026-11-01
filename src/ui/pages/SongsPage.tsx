import { AlertTriangle, ArrowLeft, Hand, Check, Copy, ExternalLink, FileMusic, Music, ShieldCheck, Sparkles, Terminal, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { recommendedDifficulty } from '../../core/progress/stats'
import { canAccompany } from '../../core/songs/accompaniment'
import { makeDifficultyVersion } from '../../core/songs/adapt'
import { BUILTIN_NOTE, BUILTIN_SONGS } from '../../core/songs/library'
import { importMidiFile } from '../../core/songs/midiImport'
import { ARRANGEMENT_TYPE_LABEL, DIFFICULTY_LABEL, type Arrangement, type ArrangementType, type Difficulty } from '../../core/songs/schema'
import { loadSongFile } from '../../core/songs/songFile'
import { validateArrangement, type ValidationIssue } from '../../core/songs/validate'
import { href, navigate } from '../../lib/router'
import { FILE_SONGS } from '../../state/fileSongs'
import { findSong, useLibrary, useProgress } from '../../state/library'
import { PageHeader } from '../layout/Shell'
import { PracticePlayer } from '../components/PracticePlayer'

const TYPE_COLOR: Record<ArrangementType, string> = {
  'authorized-transcription': 'var(--ok)',
  'didactic-adaptation': 'var(--rh)',
  'ai-generated': 'var(--miss)',
  'user-import': 'var(--accent-2)',
  exercise: 'var(--muted)',
}

export function TypeBadge({ type }: { type: ArrangementType }) {
  return (
    <span className="chip" style={{ color: TYPE_COLOR[type], borderColor: `color-mix(in oklab, ${TYPE_COLOR[type]} 50%, transparent)` }}>
      {type === 'ai-generated' ? <Sparkles size={11} /> : type === 'user-import' ? <FileMusic size={11} /> : <ShieldCheck size={11} />}
      {ARRANGEMENT_TYPE_LABEL[type]}
    </span>
  )
}

function Confidence({ value }: { value: number }) {
  const color = value >= 0.8 ? 'var(--ok)' : value >= 0.5 ? 'var(--miss)' : 'var(--bad)'
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      Confianza
      <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
        <span className="block h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
      </span>
      <b className="tabular-nums" style={{ color }}>
        {Math.round(value * 100)} %
      </b>
    </span>
  )
}

function Issues({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) return null
  return (
    <ul className="space-y-1 text-xs">
      {issues.slice(0, 8).map((i, k) => (
        <li key={k} className="flex gap-1.5" style={{ color: i.level === 'error' ? 'var(--bad)' : 'var(--miss)' }}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {i.message}
        </li>
      ))}
    </ul>
  )
}

export function SongsPage() {
  const { userSongs, save, remove } = useLibrary()
  const [error, setError] = useState<string | null>(null)
  const [importIssues, setImportIssues] = useState<ValidationIssue[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const validFileSongs = FILE_SONGS.filter((s) => s.ok && s.arrangement)
  const brokenFileSongs = FILE_SONGS.filter((s) => !s.ok)

  const onFile = async (f: File) => {
    setImportIssues([])
    setError(null)
    try {
      if (/\.json$/i.test(f.name)) {
        // Archivo de canción (el mismo formato que crea /cancion en Claude Code).
        const r = loadSongFile(await f.text(), f.name)
        setImportIssues(r.issues)
        if (!r.ok || !r.arrangement) return setError('El archivo de canción no superó la validación (revisa los problemas abajo).')
        await save(r.arrangement)
        return navigate(`/songs/${r.arrangement.id}${r.recommendedStartLevel ? `?level=${r.recommendedStartLevel}` : ''}`)
      }
      const a = importMidiFile(await f.arrayBuffer(), f.name)
      const v = validateArrangement(a)
      setImportIssues(v.issues)
      if (!v.ok || !v.arrangement) return setError('El archivo MIDI no se puede usar tal cual (revisa los problemas abajo).')
      await save({ ...v.arrangement, groupId: v.arrangement.id })
      navigate(`/songs/${v.arrangement.id}`)
    } catch (e) {
      setError(`No se pudo leer el archivo: ${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Canciones" subtitle="Pide a Claude Code la canción que quieres aprender, importa un archivo MIDI propio o autorizado, o elige una de la biblioteca." />

      <section className="card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--accent)' }} />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <Terminal size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-bold">Crear una canción con Claude Code</h2>
          </div>
          <p className="text-sm text-muted">
            En la consola de Claude Code (o en la extensión de VS Code) abierta en la carpeta del proyecto, escribe el comando <span className="kbd">/cancion</span> seguido de lo que quieres. Claude investiga la canción, escribe el
            archivo en <span className="kbd">canciones/</span>, lo valida y la canción aparece aquí sola. No necesitas clave de API.
          </p>
          <CopyLine text={EXAMPLE_PROMPT} />
          <p className="text-xs text-muted">
            Orden de búsqueda: fuentes oficiales/autorizadas → información musical verificable → arreglo didáctico. Los arreglos generados se marcan siempre como tales, con sus fuentes y su grado de confianza; nunca como transcripción
            oficial.
          </p>
          {brokenFileSongs.length > 0 && (
            <div className="space-y-2 rounded-xl bg-bad/10 p-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--bad)' }}>
                Archivos de canciones/ con errores (pide a Claude Code que los corrija):
              </div>
              {brokenFileSongs.map((s) => (
                <div key={s.file}>
                  <div className="kbd text-xs">canciones/{s.file}</div>
                  <Issues issues={s.issues} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {validFileSongs.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Creadas con Claude Code</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {validFileSongs.map((s) => (
              <SongCard key={s.file} song={s.arrangement!} level={s.recommendedStartLevel} />
            ))}
          </div>
        </section>
      )}

      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Upload size={20} style={{ color: 'var(--accent-2)' }} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">Importar archivo MIDI o de canción</div>
          <div className="text-sm text-muted">
            Un .mid propio, comprado o de dominio público (se adapta al rango del CT-S300 y se separan las manos), o un .json de canción creado con <span className="kbd">/cancion</span>.
          </div>
          <Issues issues={importIssues} />
          {error && (
            <div className="mt-2 rounded-xl bg-bad/10 px-3 py-2 text-sm" style={{ color: 'var(--bad)' }}>
              {error}
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".mid,.midi,audio/midi,.json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <FileMusic size={16} /> Elegir archivo
        </button>
      </section>

      {userSongs.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Mi biblioteca</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {userSongs.map((s) => (
              <SongCard key={s.id} song={s} onDelete={() => void remove(s.id)} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-1 text-lg font-bold">Incluidas (dominio público)</h2>
        <p className="mb-3 text-sm text-muted">{BUILTIN_NOTE}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {BUILTIN_SONGS.map((s) => (
            <SongCard key={s.id} song={s} />
          ))}
        </div>
      </section>
    </div>
  )
}

const EXAMPLE_PROMPT = '/cancion Quiero aprender Someone Like You de Adele. Soy principiante: empezar con una versión sencilla y después la más completa.'

export function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-sm" title={text}>
        {text}
      </code>
      <button
        className="btn btn-sm btn-ghost shrink-0"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function Sources({ sources }: { sources: Arrangement['sources'] }) {
  if (!sources.length) return <div className="text-xs text-muted">Sin fuentes externas.</div>
  const KIND: Record<string, string> = { official: 'Oficial', licensed: 'Con licencia', 'public-domain': 'Dominio público', 'reference-info': 'Información de referencia', 'user-file': 'Archivo del usuario', 'model-knowledge': 'Conocimiento del modelo / app' }
  return (
    <div className="space-y-1">
      <div className="label">Fuentes y procedencia</div>
      {sources.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="chip text-[10px]">{KIND[s.kind] ?? s.kind}</span>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:underline">
              {s.title} <ExternalLink size={11} />
            </a>
          ) : (
            <span className="font-semibold">{s.title}</span>
          )}
          {s.usedFor && <span className="text-muted">— {s.usedFor}</span>}
        </div>
      ))}
    </div>
  )
}

function SongCard({ song, onDelete, level }: { song: Arrangement; onDelete?: () => void; level?: Difficulty }) {
  const { attempts } = useProgress()
  const mine = attempts.filter((a) => a.refId.startsWith(song.id))
  const best = mine.length ? Math.max(...mine.map((a) => a.score)) : null
  return (
    <div className="card group relative flex flex-col gap-2 p-4 transition-transform hover:-translate-y-0.5">
      <a href={href(`/songs/${song.id}${level ? `?level=${level}` : ''}`)} className="absolute inset-0" aria-label={song.title} />
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--accent) 35%, transparent), color-mix(in oklab, var(--accent-2) 25%, transparent))' }}>
          <Music size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{song.title}</div>
          <div className="truncate text-sm text-muted">{song.artist ?? '—'}</div>
        </div>
        {onDelete && (
          <button className="btn btn-ghost btn-sm relative z-10" onClick={onDelete} title="Eliminar de la biblioteca" aria-label="Eliminar">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {song.description && <p className="line-clamp-2 text-sm text-muted">{song.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <TypeBadge type={song.arrangementType} />
        {song.key && <span className="chip">{song.key}</span>}
        {best !== null && <span className="chip">Mejor: {Math.round(best)}</span>}
        {canAccompany(song) && (
          <a href={href(`/songs/${song.id}/acompanar`)} className="chip relative z-10 ml-auto hover:border-accent" title="Acompañar con cifrados" style={{ color: 'var(--lh)' }}>
            <Hand size={11} style={{ transform: 'scaleX(-1)' }} /> Acompañar
          </a>
        )}
      </div>
    </div>
  )
}

export function SongPage({ songId, sectionId }: { songId: string; sectionId: string | null }) {
  const { userSongs } = useLibrary()
  const { attempts } = useProgress()
  const full = findSong(songId, userSongs)
  const initialLevel = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('level') as Difficulty | null) ?? (sectionId ? 'advanced' : recommendedDifficulty(attempts).level)
  const [level, setLevel] = useState<Difficulty>(initialLevel)
  const version = useMemo(() => (full ? makeDifficultyVersion(full, level) : null), [full, level])
  if (!full || !version) return <div className="text-muted">Canción no encontrada.</div>
  const mine = attempts.filter((a) => a.refId === version.id)
  const weak = new Map<string, number[]>()
  for (const a of mine.slice(-10)) for (const s of a.sections ?? []) weak.set(s.id, [...(weak.get(s.id) ?? []), s.accuracy])

  return (
    <div className="space-y-5">
      <a href={href('/songs')} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} /> Canciones
      </a>
      <PageHeader
        title={full.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {full.artist && <span>{full.artist}</span>}
            <TypeBadge type={full.arrangementType} />
            <Confidence value={full.confidence} />
          </span>
        }
        actions={
          <div className="seg" role="group" aria-label="Dificultad">
            {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
              <button key={d} aria-pressed={level === d} onClick={() => setLevel(d)}>
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <PracticePlayer
          key={`${version.id}-${sectionId ?? 'all'}`}
          arrangement={version}
          refId={version.id}
          kind="song"
          title={`${full.title} · ${DIFFICULTY_LABEL[level]}`}
          skills={['repertoire', ...(version.notes.some((n) => n.hand === 'L') ? (['two-hands'] as const) : [])]}
          initialSectionId={sectionId}
          defaultMode={level === 'beginner' ? 'wait' : 'timed'}
        />
        <aside className="space-y-4">
          {canAccompany(full) && (
            <a href={href(`/songs/${songId}/acompanar`)} className="card block space-y-1 p-4 transition-colors hover:border-accent">
              <div className="flex items-center gap-2 font-bold">
                <Hand size={16} style={{ color: 'var(--lh)', transform: 'scaleX(-1)' }} /> Acompañar con cifrados
              </div>
              <p className="text-xs text-muted">Solo los acordes ({[...new Set(full.chords.map((c) => c.symbol))].slice(0, 5).join(' · ')}…): la app toca la melodía y tú acompañas con la izquierda.</p>
            </a>
          )}
          <div className="card space-y-3 p-4">
            <div className="label">Esta versión</div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {version.key && <span className="chip">{version.key}</span>}
              <span className="chip">{version.bpm} BPM</span>
              <span className="chip">{version.notes.filter((n) => n.hand === 'R').length} notas derecha</span>
              <span className="chip">{version.notes.filter((n) => n.hand === 'L').length} notas izquierda</span>
            </div>
            {version.description && <p className="text-sm text-muted">{version.description}</p>}
            {version.adaptations.length > 0 && (
              <div>
                <div className="label mb-1">Adaptaciones</div>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
                  {version.adaptations.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="card space-y-2 p-4">
            <div className="label">Secciones</div>
            {version.sections.map((s) => {
              const acc = weak.get(s.id)
              const m = acc ? acc.reduce((a, b) => a + b, 0) / acc.length : null
              return (
                <a key={s.id} href={href(`/songs/${songId}?section=${s.id}&level=${level}`)} className="card-flat flex items-center gap-2 px-3 py-2 text-sm hover:border-accent">
                  <span className="flex-1 font-semibold">{s.name}</span>
                  {m !== null && (
                    <span className="tabular-nums text-xs" style={{ color: m >= 0.85 ? 'var(--ok)' : m >= 0.6 ? 'var(--miss)' : 'var(--bad)' }}>
                      {Math.round(m * 100)} %
                    </span>
                  )}
                </a>
              )
            })}
            <p className="text-xs text-muted">Elige una sección en el reproductor y activa "Bucle" para repetirla hasta dominarla.</p>
          </div>
          <div className="card space-y-2 p-4">
            <Sources sources={full.sources} />
            {full.limitations.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
                {full.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
