import { ChevronsLeft, Eye, EyeOff, Hand, Headphones, Pause, Play, Repeat, RotateCcw, SkipBack, Timer, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { audioEngine } from '../../core/audio/AudioEngine'
import { midiToName } from '../../core/music/notes'
import type { Skill } from '../../core/practice/exercises'
import { PracticeSession, type AssistLevel, type SessionMode, type SessionResult } from '../../core/practice/PracticeSession'
import { PRESET_LABEL, resolveTolerance, TOLERANCE_PRESETS } from '../../core/scoring/tolerance'
import { beatsPerBar, type Arrangement } from '../../core/songs/schema'
import { store, type AttemptKind } from '../../core/storage/db'
import { buildAttempt, saveAttempt } from '../../lib/attempts'
import { useElementWidth, useFrame, useHeldNotes } from '../../lib/hooks'
import { noteNameOpts, useSettings } from '../../state/settings'
import { ChordView } from './ChordView'
import { FallingNotes } from './FallingNotes'
import { PianoKeyboard } from './PianoKeyboard'
import { PianoRoll } from './PianoRoll'
import { ResultsView } from './ResultsView'

export type ViewKind = 'falling' | 'roll' | 'keys' | 'chords'

export interface PracticePlayerProps {
  arrangement: Arrangement
  refId: string
  kind: AttemptKind
  title: string
  skills: Skill[]
  defaultMode?: SessionMode
  modes?: SessionMode[]
  defaultHands?: 'both' | 'R' | 'L'
  improv?: { rootPc: number; scaleId: string; bars: number }
  evaluateDuration?: boolean
  countInBars?: number
  passScore?: number
  challenge?: boolean
  initialSectionId?: string | null
  onResult?: (r: SessionResult, saved: boolean) => void
  onNext?: () => void
  nextLabel?: string
  extraHeader?: ReactNode
}

const MODE_LABEL: Record<SessionMode, string> = { wait: 'Guiado (espera)', timed: 'Con tempo', listen: 'Escuchar', improv: 'Improvisar' }

export function PracticePlayer(p: PracticePlayerProps) {
  const settings = useSettings()
  const [mode, setMode] = useState<SessionMode>(p.defaultMode ?? 'timed')
  const [hands, setHands] = useState<'both' | 'R' | 'L'>(p.defaultHands ?? 'both')
  const [tempo, setTempo] = useState(p.arrangement.difficulty === 'beginner' || p.challenge ? 1 : 1)
  const [view, setView] = useState<ViewKind>('falling')
  const [assist, setAssist] = useState<AssistLevel>(p.challenge ? 'none' : 'full')
  const [sectionId, setSectionId] = useState<string | null>(p.initialSectionId ?? null)
  const [loop, setLoop] = useState(false)
  const [metronome, setMetronome] = useState(mode === 'timed')
  const [result, setResult] = useState<SessionResult | null>(null)
  const [saved, setSaved] = useState(false)
  const [assistHint, setAssistHint] = useState<string | null>(null)
  const held = useHeldNotes()
  const [areaRef, areaW] = useElementWidth<HTMLDivElement>()
  const presetKey = p.challenge ? 'advanced' : settings.difficulty
  const tolerance = p.challenge ? TOLERANCE_PRESETS.advanced : resolveTolerance(settings.difficulty, settings.customTolerance)
  const hasLH = p.arrangement.notes.some((n) => n.hand === 'L')
  const hasRH = p.arrangement.notes.some((n) => n.hand === 'R')

  const section = p.arrangement.sections.find((s) => s.id === sectionId)
  const session = useMemo(
    () =>
      new PracticeSession({
        arrangement: p.arrangement,
        mode,
        hands,
        tempoFactor: tempo,
        fromBeat: section?.start,
        toBeat: section?.end,
        loop,
        metronome,
        countInBars: mode === 'wait' ? 0 : p.countInBars ?? 1,
        playAccompaniment: true,
        latencyMs: settings.latencyMs,
        improv: p.improv,
        evaluation: {
          tolerance,
          evaluateTiming: true,
          evaluateDuration: !!p.evaluateDuration,
          evaluateDynamics: false,
          weights: settings.weights,
          extraPenalty: settings.extraPenalty,
        },
      }),
    // La sesión se recrea solo al cambiar de pieza; el resto se aplica con update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.arrangement],
  )

  // aplicar cambios de configuración a la sesión existente
  useEffect(() => {
    session.update({
      mode,
      hands,
      tempoFactor: tempo,
      fromBeat: section?.start,
      toBeat: section?.end,
      loop,
      metronome,
      countInBars: mode === 'wait' ? 0 : p.countInBars ?? 1,
      latencyMs: settings.latencyMs,
      evaluation: { ...session.cfg.evaluation, tolerance, weights: settings.weights, extraPenalty: settings.extraPenalty },
    })
    setResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode, hands, tempo, sectionId, loop, metronome, settings.latencyMs, presetKey, settings.weights, settings.extraPenalty])

  const [, force] = useState(0)
  useEffect(() => session.subscribe(() => force((x) => x + 1)), [session])
  useEffect(() => () => session.dispose(), [session])

  const handleFinish = useCallback(
    async (r: SessionResult) => {
      setResult(r)
      const attempt = buildAttempt(r, session.cfg, { kind: p.kind, refId: p.refId, title: p.title, skills: p.skills, tolerance: p.challenge ? 'challenge' : presetKey })
      await saveAttempt(attempt)
      setSaved(!!attempt)
      p.onResult?.(r, !!attempt)
      // Reducción progresiva de ayudas: si dominas la pieza con ayudas, sugerir menos.
      if (attempt && r.score >= 90 && assist !== 'none') {
        const prev = (await store.attemptsFor(p.refId)).filter((a) => a.mode === 'timed').slice(-2)
        if (prev.length >= 2 && prev.every((a) => a.score >= 88)) setAssistHint(assist === 'full' ? 'reduced' : 'none')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, p.refId, p.kind, p.title, presetKey, assist],
  )
  useEffect(() => {
    session.onFinish = (r) => void handleFinish(r)
  }, [session, handleFinish])

  const running = session.status === 'playing' || session.status === 'countin' || session.status === 'waiting'
  useFrame(running, 30)

  // atajos: espacio = reproducir/pausa
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))) return
      e.preventDefault()
      if (running) session.pause()
      else void start()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const start = async () => {
    setResult(null)
    setAssistHint(null)
    await audioEngine.start()
    await session.start()
  }

  const barSec = beatsPerBar(p.arrangement.timeSignature) * session.beatSec
  const t = session.songTime()
  const progress = Math.max(0, Math.min(1, t / Math.max(0.001, session.timeline.lengthSec)))
  const upcoming = assist === 'none' ? [] : session.upcomingNotes(assist === 'full' ? 0.35 : 0.12)
  const expectedMap = new Map(upcoming.map((n) => [n.midi, n.hand] as const))
  const fingerMap = new Map<number, number>()
  if (assist === 'full') {
    for (const n of upcoming) {
      // tiempo de la nota (s) → pulso en la partitura
      const beat = (n.start * session.timeline.bpm) / 60 + (section?.start ?? 0)
      const src = p.arrangement.notes.find((x) => x.midi === n.midi && x.finger && Math.abs(x.start - beat) < 0.02)
      if (src?.finger) fingerMap.set(n.midi, src.finger)
    }
  }
  const sounding = new Set(session.soundingAccompaniment().map((n) => n.midi))
  const opts = noteNameOpts(settings)
  const low = settings.rangeLow
  const high = settings.rangeHigh
  const modes = p.modes ?? (['wait', 'timed', 'listen'] as SessionMode[])
  const vizH = view === 'keys' ? 120 : view === 'chords' ? 260 : 300

  return (
    <div className="card overflow-hidden">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold">{p.title}</div>
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs text-muted">
            <span className="chip">{Math.round(session.timeline.bpm)} BPM</span>
            <span className="chip">
              {p.arrangement.timeSignature[0]}/{p.arrangement.timeSignature[1]}
            </span>
            {p.arrangement.key && <span className="chip">{p.arrangement.key}</span>}
            <span className="chip">Tolerancia: {p.challenge ? 'Desafío' : PRESET_LABEL[settings.difficulty]}</span>
            {p.challenge && <span className="chip" style={{ color: 'var(--bad)' }}>Modo desafío</span>}
          </div>
        </div>
        {p.extraHeader}
        <div className="seg" role="group" aria-label="Vista">
          {(
            [
              ['falling', 'Notas'],
              ['roll', 'Piano roll'],
              ['keys', 'Teclado'],
              ['chords', 'Acordes'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Visualización */}
      <div ref={areaRef} className="relative bg-bg-2">
        {areaW > 0 && view === 'falling' && <FallingNotes session={session} width={areaW} height={vizH} low={low} high={high} assist={assist} />}
        {areaW > 0 && view === 'roll' && <PianoRoll session={session} width={areaW} height={vizH} assist={assist} />}
        {view === 'chords' && <ChordView session={session} />}
        {view === 'keys' && (
          <div className="flex h-[120px] flex-col items-center justify-center gap-2 px-4 text-center">
            <div className="label">Siguiente</div>
            <div className="text-3xl font-extrabold tracking-tight">
              {assist === 'none' ? '—' : session.upcomingNotes(1.2).slice(0, 6).map((n) => midiToName(n.midi, opts)).join('  ·  ') || '…'}
            </div>
          </div>
        )}
        {session.status === 'waiting' && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold shadow">Esperando a que toques las notas resaltadas…</div>
        )}
        {result && (
          <div className="absolute inset-0 overflow-y-auto bg-bg/95 p-5 backdrop-blur-sm">
            <ResultsView
              result={result}
              passScore={p.passScore}
              saved={saved}
              onRetry={() => void start()}
              onNext={p.onNext}
              nextLabel={p.nextLabel}
              onPracticeSection={
                p.arrangement.sections.length > 1
                  ? (id) => {
                      setSectionId(id)
                      setLoop(true)
                      setResult(null)
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Teclado */}
      <div className="border-t border-border bg-surface-2 px-2 pb-2 pt-1.5">
        <PianoKeyboard low={low} high={high} height={view === 'keys' ? 190 : 130} held={held} expected={expectedMap} sounding={sounding} flashes={session.flashes} fingers={fingerMap} />
      </div>

      {/* Progreso */}
      <div
        className="group relative h-2 cursor-pointer bg-surface-3"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          session.seek(((e.clientX - r.left) / r.width) * session.timeline.lengthSec)
          setResult(null)
        }}
        title="Haz clic para saltar"
      >
        {session.timeline.sections.map((s) => (
          <div key={s.id} className="absolute top-0 h-full border-l border-bg" style={{ left: `${(s.start / session.timeline.lengthSec) * 100}%` }} />
        ))}
        <div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Transporte */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button className="btn btn-sm" title="Al inicio" onClick={() => (session.seek(0), setResult(null))}>
            <SkipBack size={16} />
          </button>
          <button className="btn btn-sm" title="Retroceder un compás" onClick={() => (session.seek(Math.max(0, t - barSec)), setResult(null))}>
            <ChevronsLeft size={16} />
          </button>
          {running ? (
            <button className="btn btn-primary min-w-28" onClick={() => session.pause()}>
              <Pause size={18} /> Pausa
            </button>
          ) : (
            <button className="btn btn-primary min-w-28" onClick={() => void start()}>
              <Play size={18} /> {session.status === 'paused' ? 'Continuar' : 'Empezar'}
            </button>
          )}
          <button className="btn btn-sm" title="Reiniciar" onClick={() => (setResult(null), session.restart())}>
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="seg" role="group" aria-label="Modo">
          {modes.map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} title={m === 'wait' ? 'La música espera a que toques la nota correcta' : m === 'listen' ? 'Escucha la referencia sin evaluar' : undefined}>
              {m === 'listen' ? <Headphones size={13} className="mr-1 inline" /> : null}
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {hasLH && hasRH && mode !== 'improv' && (
          <div className="seg" role="group" aria-label="Manos">
            {(
              [
                ['R', 'Derecha'],
                ['L', 'Izquierda'],
                ['both', 'Ambas'],
              ] as const
            ).map(([h, l]) => (
              <button key={h} aria-pressed={hands === h} onClick={() => setHands(h)}>
                <Hand size={12} className="mr-1 inline" style={{ color: h === 'R' ? 'var(--rh)' : h === 'L' ? 'var(--lh)' : undefined, transform: h === 'L' ? 'scaleX(-1)' : undefined }} />
                {l}
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <Timer size={15} className="text-muted" />
          <input type="range" min={0.25} max={1.5} step={0.05} value={tempo} onChange={(e) => setTempo(Number(e.target.value))} className="w-28" aria-label="Tempo" />
          <span className="w-20 tabular-nums text-muted">
            {Math.round(tempo * 100)} % · {Math.round(session.timeline.bpm)}
          </span>
        </label>

        {p.arrangement.sections.length > 1 && (
          <select className="select py-1.5" value={sectionId ?? ''} onChange={(e) => setSectionId(e.target.value || null)} aria-label="Sección">
            <option value="">Toda la pieza</option>
            {p.arrangement.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-sm" aria-pressed={loop} style={loop ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined} onClick={() => setLoop(!loop)} title="Repetir en bucle">
          <Repeat size={15} /> Bucle
        </button>
        <button className="btn btn-sm" style={metronome ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined} onClick={() => setMetronome(!metronome)} title="Metrónomo">
          <Volume2 size={15} /> Metrónomo
        </button>
        <div className="seg ml-auto" role="group" aria-label="Ayudas visuales">
          {(
            [
              ['full', 'Ayudas'],
              ['reduced', 'Menos'],
              ['none', 'Sin ayudas'],
            ] as const
          ).map(([a, l]) => (
            <button key={a} aria-pressed={assist === a} onClick={() => setAssist(a)}>
              {a === 'none' ? <EyeOff size={12} className="mr-1 inline" /> : <Eye size={12} className="mr-1 inline" />}
              {l}
            </button>
          ))}
        </div>
      </div>
      {assistHint && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 px-3 py-2 text-sm">
          Llevas varios intentos por encima de 88. ¿Reducimos las ayudas visuales?
          <button
            className="btn btn-sm"
            onClick={() => {
              setAssist(assistHint as AssistLevel)
              setAssistHint(null)
            }}
          >
            Sí, {assistHint === 'none' ? 'quitar ayudas' : 'reducir'}
          </button>
        </div>
      )}
      {running && mode === 'timed' && (
        <div className="px-4 pb-3 text-xs text-muted">
          Racha: <b className="text-text tabular-nums">{session.combo}</b> · Mejor: <span className="tabular-nums">{session.bestCombo}</span> · Espacio = pausa
        </div>
      )}
    </div>
  )
}
