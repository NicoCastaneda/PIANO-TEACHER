import { Eye, Lightbulb, SkipForward, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { audioEngine } from '../../../core/audio/AudioEngine'
import { chordLongName } from '../../../core/chords/trainer'
import {
  inversionVoicing,
  judgePlayedChord,
  melodyQuestion,
  melodyStep,
  playChordQuestion,
  recognizeQuestion,
  startMelody,
  type MelodyProgress,
  type MelodyQuestion,
  type PlayChordQuestion,
  type RecognizeQuestion,
} from '../../../core/ear/ear'
import { inputBus } from '../../../core/midi/inputBus'
import { midiToName } from '../../../core/music/notes'
import { buildChord, inversionName } from '../../../core/music/theory'
import { useHeldNotes } from '../../../lib/hooks'
import { useEarTrainer } from '../../../state/earTrainer'
import { noteNameOpts, useSettings } from '../../../state/settings'
import { PianoKeyboard, type KeyMark } from '../../components/PianoKeyboard'
import { judgeMarks } from '../chords/common'
import { useChordGesture } from '../chords/useChordGesture'

/** Lo que devuelve cada pregunta al terminar (para la sesión y para «Práctica de hoy»). */
export type EarAnswer = { correct: boolean; recorded: boolean }

interface DrillProps {
  level: number
  onAnswer?: (a: EarAnswer) => void
}

function playRecognize(q: RecognizeQuestion, arpeggio = false) {
  if (q.playback === 'melodic') return audioEngine.demo(q.notes, { arpeggio: true, gapMs: 750, durationMs: 700 })
  return audioEngine.demo(q.notes, { arpeggio, gapMs: 260, durationMs: arpeggio ? 1400 : 1300 })
}

function SessionStats({ ok, bad, streak }: { ok: number; bad: number; streak: number }) {
  return (
    <div className="flex justify-center gap-4 text-sm text-muted">
      <span>
        Aciertos{' '}
        <b className="tabular-nums" style={{ color: 'var(--ok)' }}>
          {ok}
        </b>
      </span>
      <span>
        Fallos{' '}
        <b className="tabular-nums" style={{ color: 'var(--bad)' }}>
          {bad}
        </b>
      </span>
      <span>
        Racha <b className="tabular-nums text-text">{streak}</b>
      </span>
    </div>
  )
}

function useSession() {
  const [s, set] = useState({ ok: 0, bad: 0, streak: 0 })
  return [s, (correct: boolean) => set((x) => ({ ok: x.ok + (correct ? 1 : 0), bad: x.bad + (correct ? 0 : 1), streak: correct ? x.streak + 1 : 0 }))] as const
}

// ─────────────────────────── Reconocer ───────────────────────────

export function RecognizeDrill({ drill, level, onAnswer }: DrillProps & { drill: 'quality' | 'inversion' | 'interval' }) {
  const opts = noteNameOpts(useSettings())
  const record = useEarTrainer((s) => s.record)
  const [q, setQ] = useState<RecognizeQuestion>(() => recognizeQuestion(drill, level))
  const [chosen, setChosen] = useState<string | null>(null)
  const [session, add] = useSession()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const next = useCallback(() => {
    clearTimeout(timer.current)
    const nq = recognizeQuestion(drill, level)
    setQ(nq)
    setChosen(null)
    void playRecognize(nq)
  }, [drill, level])
  useEffect(() => {
    next()
    return () => clearTimeout(timer.current)
  }, [next])

  const answer = (id: string) => {
    if (chosen) return
    setChosen(id)
    const correct = id === q.answer
    record(drill, level, correct)
    add(correct)
    onAnswer?.({ correct, recorded: true })
    if (correct) timer.current = setTimeout(next, 1300)
  }
  // atajos 1…9 para responder (las letras se usan como teclado musical)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= q.options.length) answer(q.options[n - 1].id)
      if (e.key === 'Enter' && chosen) next()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  /** Para comparar: la misma raíz con la otra opción */
  const variant = (id: string): number[] => {
    if (drill === 'quality') return buildChord(q.notes[0], id, 0)
    if (drill === 'interval') return [q.notes[0], q.notes[0] + Number(id)]
    return inversionVoicing(q.chord!.rootPc, q.chord!.typeId, Number(id))
  }
  const playVariant = (id: string) => void audioEngine.demo(variant(id), drill === 'interval' ? { arpeggio: true, gapMs: 750, durationMs: 700 } : { durationMs: 1200 })

  const correct = chosen !== null && chosen === q.answer
  const marks = new Map<number, KeyMark>()
  if (chosen) q.notes.forEach((m, i) => marks.set(m, i === 0 ? 'root' : 'chord'))

  return (
    <div className="space-y-4">
      <div className="card relative overflow-hidden p-6 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: chosen ? (correct ? 'var(--ok)' : 'var(--bad)') : 'var(--accent)' }}
        />
        <div className="relative space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary" onClick={() => void playRecognize(q)}>
              <Volume2 size={16} /> Escuchar otra vez
            </button>
            {q.playback === 'block' && (
              <button className="btn" onClick={() => void playRecognize(q, true)}>
                Nota a nota
              </button>
            )}
          </div>
          <div className="mx-auto grid max-w-2xl gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(q.options.length, drill === 'interval' ? 4 : 3)}, minmax(0, 1fr))` }}>
            {q.options.map((o, i) => {
              const isAnswer = chosen && o.id === q.answer
              const isWrong = chosen === o.id && !isAnswer
              return (
                <button
                  key={o.id}
                  className="card-flat px-3 py-3 text-left transition-colors hover:border-accent disabled:cursor-default"
                  disabled={!!chosen}
                  onClick={() => answer(o.id)}
                  style={
                    isAnswer
                      ? { borderColor: 'var(--ok)', background: 'color-mix(in oklab, var(--ok) 14%, var(--surface-2))' }
                      : isWrong
                        ? { borderColor: 'var(--bad)', background: 'color-mix(in oklab, var(--bad) 14%, var(--surface-2))' }
                        : undefined
                  }
                >
                  <div className="flex items-baseline gap-2">
                    <span className="kbd">{i + 1}</span>
                    <span className="font-bold">{o.label}</span>
                  </div>
                  {o.hint && <div className="mt-0.5 text-xs text-muted">{o.hint}</div>}
                </button>
              )
            })}
          </div>
          <div className="min-h-12 text-[15px] font-semibold" aria-live="polite">
            {!chosen && <span className="text-muted">Escucha y elige. Puedes repetir el sonido las veces que quieras.</span>}
            {chosen && correct && <span style={{ color: 'var(--ok)' }}>¡Correcto!</span>}
            {chosen && !correct && (
              <div className="space-y-2">
                <div style={{ color: 'var(--bad)' }}>Era «{q.options.find((o) => o.id === q.answer)!.label}». Compara los dos:</div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button className="btn btn-sm" onClick={() => playVariant(q.answer)} style={{ borderColor: 'var(--ok)' }}>
                    <Volume2 size={13} /> {q.options.find((o) => o.id === q.answer)!.label}
                  </button>
                  <button className="btn btn-sm" onClick={() => playVariant(chosen)} style={{ borderColor: 'var(--bad)' }}>
                    <Volume2 size={13} /> {q.options.find((o) => o.id === chosen)!.label}
                  </button>
                </div>
              </div>
            )}
          </div>
          {chosen && (
            <button className="btn btn-sm" onClick={next}>
              <SkipForward size={14} /> Siguiente <span className="kbd">Enter</span>
            </button>
          )}
          <SessionStats {...session} />
        </div>
      </div>
      <div className="card p-3">
        <PianoKeyboard height={110} marks={marks} interactive />
        <p className="mt-2 text-center text-xs text-faint">{chosen ? `Sonó: ${q.notes.map((m) => midiToName(m, opts)).join(' – ')}` : 'Las teclas se muestran después de responder.'}</p>
      </div>
    </div>
  )
}

// ─────────────────────────── Tocar el acorde ───────────────────────────

export function PlayChordDrill({ level, onAnswer }: DrillProps) {
  const settings = useSettings()
  const opts = noteNameOpts(settings)
  const record = useEarTrainer((s) => s.record)
  const held = useHeldNotes()
  const [q, setQ] = useState<PlayChordQuestion>(() => playChordQuestion(level))
  const [state, setState] = useState<{
    failed: boolean
    revealed: boolean
    hint: boolean
    done: boolean
    last: { notes: number[]; j: ReturnType<typeof judgePlayedChord>; simulated: boolean } | null
  }>({ failed: false, revealed: false, hint: false, done: false, last: null })
  const [session, add] = useSession()
  const answered = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const next = useCallback(() => {
    clearTimeout(timer.current)
    const nq = playChordQuestion(level)
    setQ(nq)
    setState({ failed: false, revealed: false, hint: false, done: false, last: null })
    answered.current = false
    void audioEngine.demo(nq.notes, { durationMs: 1500 })
  }, [level])
  useEffect(() => {
    next()
    return () => clearTimeout(timer.current)
  }, [next])

  const settle = (correct: boolean, simulated: boolean) => {
    if (answered.current) return
    answered.current = true
    if (!simulated) record('play-chord', level, correct)
    add(correct)
    onAnswer?.({ correct, recorded: !simulated })
  }

  useChordGesture({
    active: !state.done,
    minNotes: q.notes.length,
    onChord: (g) => {
      const j = judgePlayedChord(g.notes, q)
      const simulated = g.sources.has('simulated')
      if (j.status === 'correct') {
        settle(!state.failed && !state.revealed, simulated)
        setState((s) => ({ ...s, done: true, last: { notes: g.notes, j, simulated } }))
        timer.current = setTimeout(next, 1800)
      } else {
        if (!state.failed) settle(false, simulated)
        setState((s) => ({ ...s, failed: true, last: { notes: g.notes, j, simulated } }))
      }
    },
  })

  const card = { rootPc: q.rootPc, typeId: q.typeId, inversion: q.inversion }
  const marks = new Map<number, KeyMark>()
  if (state.revealed) q.notes.forEach((m, i) => marks.set(m, i === 0 ? 'root' : 'chord'))
  if (state.last) for (const [n, mk] of judgeMarks(state.last.notes, card, state.last.j)) marks.set(n, mk)
  const bass = midiToName(q.notes[0], { ...opts, withOctave: false })
  const msg = (() => {
    const l = state.last
    if (!l) return null
    if (l.j.status === 'correct')
      return { color: 'var(--ok)', text: `¡Correcto! Era ${chordLongName(card, settings.namingStyle)}${q.inversion ? ` (${inversionName(q.inversion).toLowerCase()})` : ''}.` }
    if (l.j.status === 'wrong-inversion') return { color: 'var(--miss)', text: 'Las notas son las del acorde, pero la más grave no coincide. Escucha qué nota suena abajo.' }
    if (l.j.status === 'incomplete') return { color: 'var(--miss)', text: `Vas bien, pero falta ${l.j.missingPcs.length === 1 ? 'una nota' : `${l.j.missingPcs.length} notas`}.` }
    return { color: 'var(--bad)', text: 'Hay notas que no pertenecen al acorde (en rojo). Vuelve a escuchar.' }
  })()

  return (
    <div className="space-y-4">
      <div className="card relative overflow-hidden p-6 text-center">
        <div className="relative space-y-3">
          <div className="label">Escucha y tócalo en tu teclado (cualquier octava)</div>
          <div className="text-sm text-muted">
            {q.notes.length} notas
            {(q.bassShown || state.hint) && (
              <>
                {' '}
                · nota más grave: <b className="text-text">{bass}</b>
              </>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary" onClick={() => void audioEngine.demo(q.notes, { durationMs: 1500 })}>
              <Volume2 size={16} /> Escuchar otra vez
            </button>
            <button className="btn" onClick={() => void audioEngine.demo(q.notes, { arpeggio: true, gapMs: 420, durationMs: 1600 })}>
              Nota a nota
            </button>
            {!q.bassShown && (
              <button className="btn btn-sm" disabled={state.hint} onClick={() => setState((s) => ({ ...s, hint: true }))}>
                <Lightbulb size={14} /> Pista: nota grave
              </button>
            )}
            <button
              className="btn btn-sm"
              onClick={() => {
                if (!state.done) settle(false, false)
                setState((s) => ({ ...s, revealed: true }))
                void audioEngine.demo(q.notes, { durationMs: 1500 })
              }}
            >
              <Eye size={14} /> Mostrar respuesta
            </button>
            <button className="btn btn-sm btn-ghost" onClick={next}>
              <SkipForward size={14} /> {state.done ? 'Siguiente' : 'Saltar'}
            </button>
          </div>
          <div className="min-h-12 text-[15px] font-semibold" aria-live="polite">
            {msg ? (
              <span style={{ color: msg.color }}>
                {msg.text}
                {state.last?.simulated && (
                  <span className="chip ml-2" style={{ color: 'var(--miss)' }}>
                    SIMULADO · no se guarda
                  </span>
                )}
              </span>
            ) : state.revealed ? (
              <span>
                Es {chordLongName(card, settings.namingStyle)}
                {q.inversion ? ` (${inversionName(q.inversion).toLowerCase()})` : ''}: {q.notes.map((m) => midiToName(m, { ...opts, withOctave: false })).join(' – ')}. Tócalo para continuar.
              </span>
            ) : (
              <span className="text-muted">Prueba notas sueltas hasta encontrarlas y luego pulsa todas a la vez.</span>
            )}
          </div>
          <SessionStats {...session} />
        </div>
      </div>
      <div className="card p-3">
        <PianoKeyboard height={130} held={held} marks={marks} />
      </div>
    </div>
  )
}

// ─────────────────────────── Repetir la melodía ───────────────────────────

export function PlayMelodyDrill({ level, onAnswer }: DrillProps) {
  const settings = useSettings()
  const opts = noteNameOpts(settings)
  const record = useEarTrainer((s) => s.record)
  const held = useHeldNotes()
  const [q, setQ] = useState<MelodyQuestion>(() => melodyQuestion(level))
  const [prog, setProg] = useState<MelodyProgress>(() => startMelody(q))
  const progRef = useRef(prog)
  const [flash, setFlash] = useState<{ midi: number; ok: boolean; octave: boolean } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [session, add] = useSession()
  const simulated = useRef(false)
  const answered = useRef(false)
  const qRef = useRef(q)
  qRef.current = q
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const play = (m: MelodyQuestion) => audioEngine.demo(m.notes, { arpeggio: true, gapMs: 60000 / m.bpm, durationMs: 60000 / m.bpm - 60 })
  const next = useCallback(() => {
    clearTimeout(timer.current)
    const nq = melodyQuestion(level)
    setQ(nq)
    progRef.current = startMelody(nq)
    setProg(progRef.current)
    setFlash(null)
    setRevealed(false)
    simulated.current = false
    answered.current = false
    void play(nq)
  }, [level])
  useEffect(() => {
    next()
    return () => clearTimeout(timer.current)
  }, [next])

  const settle = (correct: boolean) => {
    if (answered.current) return
    answered.current = true
    if (!simulated.current) record('play-melody', level, correct)
    add(correct)
    onAnswer?.({ correct, recorded: !simulated.current })
  }
  const settleRef = useRef(settle)
  settleRef.current = settle

  useEffect(
    () =>
      inputBus.subscribe((e) => {
        if (e.type !== 'noteon') return
        if (e.source === 'simulated') simulated.current = true
        const p = progRef.current
        if (p.done) return
        const r = melodyStep(p, qRef.current, e.note)
        progRef.current = r.progress
        setProg(r.progress)
        setFlash({ midi: e.note, ok: r.correct, octave: r.octave })
        if (r.progress.done) {
          settleRef.current(r.progress.errors === 0)
          timer.current = setTimeout(next, 2200)
        }
      }),
    [next],
  )

  const marks = new Map<number, KeyMark>()
  marks.set(q.notes[0], 'target')
  if (revealed) q.notes.forEach((m) => marks.set(m, 'chord'))
  if (flash) marks.set(flash.midi, flash.ok ? 'ok' : 'bad')
  const first = midiToName(q.notes[0], opts)

  return (
    <div className="space-y-4">
      <div className="card relative overflow-hidden p-6 text-center">
        <div className="relative space-y-3">
          <div className="label">Escucha la frase y repítela en tu teclado</div>
          <div className="text-sm text-muted">
            {q.notes.length} notas · empieza en <b className="text-text">{first}</b> (marcada en el teclado)
          </div>
          <div className="flex justify-center gap-2" aria-label="Progreso de la melodía">
            {q.notes.map((m, i) => {
              const st = prog.firstTry[i]
              const doneHere = i < prog.index
              const color = doneHere ? (st ? 'var(--ok)' : 'var(--miss)') : i === prog.index ? 'var(--accent)' : 'var(--surface-3)'
              return (
                <div
                  key={i}
                  className="grid h-10 w-10 place-items-center rounded-xl border-2 text-xs font-bold tabular-nums"
                  style={{ borderColor: color, background: doneHere ? `color-mix(in oklab, ${color} 18%, transparent)` : undefined }}
                >
                  {doneHere || revealed ? midiToName(m, { ...opts, withOctave: false }) : i + 1}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary" onClick={() => void play(q)}>
              <Volume2 size={16} /> Escuchar otra vez
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                settle(false)
                setRevealed(true)
                void play(q)
              }}
            >
              <Eye size={14} /> Mostrar notas
            </button>
            <button className="btn btn-sm btn-ghost" onClick={next}>
              <SkipForward size={14} /> {prog.done ? 'Siguiente' : 'Saltar'}
            </button>
          </div>
          <div className="min-h-12 text-[15px] font-semibold" aria-live="polite">
            {prog.done ? (
              revealed ? (
                <span className="text-muted">Completada con las notas a la vista: cuenta como repaso.</span>
              ) : prog.errors === 0 ? (
                <span style={{ color: 'var(--ok)' }}>¡Perfecta a la primera!{prog.octaveShifts ? ' (alguna nota en otra octava)' : ''}</span>
              ) : (
                <span style={{ color: 'var(--miss)' }}>
                  Completada con {prog.errors} {prog.errors === 1 ? 'tropiezo' : 'tropiezos'}. Cuenta como repaso.
                </span>
              )
            ) : flash && !flash.ok ? (
              <span style={{ color: 'var(--bad)' }}>Esa no. ¿Sube o baja respecto a la anterior? Prueba otra.</span>
            ) : flash?.octave ? (
              <span className="text-muted">Bien (en otra octava).</span>
            ) : (
              <span className="text-muted">Toca nota a nota. Si fallas, prueba otra: solo avanza con la correcta.</span>
            )}
            {simulated.current && (
              <span className="chip ml-2" style={{ color: 'var(--miss)' }}>
                SIMULADO · no se guarda
              </span>
            )}
          </div>
          <SessionStats {...session} />
        </div>
      </div>
      <div className="card p-3">
        <PianoKeyboard height={130} held={held} marks={marks} />
      </div>
    </div>
  )
}
