import { Eye, Lightbulb, SkipForward, Sparkles, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { audioEngine } from '../../../core/audio/AudioEngine'
import {
  CATEGORY_INFO,
  cardPrompt,
  cardsForGroups,
  cardSymbol,
  cardTips,
  chordLongName,
  HAND_PROMPT,
  handVoicing,
  chordPcs,
  GROUP_BY_ID,
  INVERSION_MODE_LABEL,
  judgeChord,
  mastery,
  minNotesFor,
  noteName,
  pickNextCard,
  type ChordCard,
  type InversionMode,
  type Judgement,
} from '../../../core/chords/trainer'
import { inversionName } from '../../../core/music/theory'
import { useHeldNotes } from '../../../lib/hooks'
import { useChordTrainer } from '../../../state/chordTrainer'
import { useSettings } from '../../../state/settings'
import { PianoKeyboard, type KeyMark } from '../../components/PianoKeyboard'
import { baseSymbol, feedbackText, judgeMarks, MasteryBar, STATUS_COLOR } from './common'
import { useChordGesture } from './useChordGesture'

export function StudyTab({ groupId, initialCards, onClearReview }: { groupId: string; initialCards?: ChordCard[]; onClearReview?: () => void }) {
  const style = useSettings((s) => s.namingStyle)
  const { stats, record, hand } = useChordTrainer()
  const group = GROUP_BY_ID[groupId]
  const [invMode, setInvMode] = useState<InversionMode>('root')
  const cards = useMemo(() => initialCards ?? cardsForGroups([groupId], invMode), [groupId, invMode, initialCards])
  const [card, setCard] = useState<ChordCard>(() => pickNextCard(cards, stats))
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState(false)
  const [failed, setFailed] = useState(false)
  const [last, setLast] = useState<{ j: Judgement; notes: number[]; ms: number; simulated: boolean } | null>(null)
  const [session, setSession] = useState({ ok: 0, bad: 0, streak: 0 })
  const [preview, setPreview] = useState<number[] | null>(null)
  const shownAt = useRef(performance.now())
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useHeldNotes()

  const next = (avoid = card.id) => {
    clearTimeout(advanceTimer.current)
    setCard(pickNextCard(cards, useChordTrainer.getState().stats, Math.random, avoid))
    setRevealed(false)
    setHint(false)
    setFailed(false)
    setLast(null)
    setPreview(null)
    shownAt.current = performance.now()
  }
  // nueva baraja al cambiar de grupo o de modo
  useEffect(() => {
    next('')
    setSession({ ok: 0, bad: 0, streak: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])
  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const need = minNotesFor(card, hand)
  useChordGesture({
    active: last?.j.status !== 'correct',
    minNotes: need,
    onChord: (g) => {
      const j = judgeChord(g.notes, card, hand)
      const ms = Math.round(g.at - shownAt.current)
      const simulated = g.sources.has('simulated')
      setLast({ j, notes: g.notes, ms, simulated })
      if (j.status === 'correct') {
        // primer intento sin ayuda = acierto; si antes falló o vio la respuesta, cuenta como repaso
        if (!simulated) record(card.id, { correct: !failed, revealed: revealed || hint, ms })
        setSession((s) => ({ ok: s.ok + (failed ? 0 : 1), bad: s.bad, streak: failed ? 0 : s.streak + 1 }))
        advanceTimer.current = setTimeout(() => next(), 1100)
      } else if (!failed) {
        setFailed(true)
        if (!simulated) record(card.id, { correct: false, revealed: false, ms })
        setSession((s) => ({ ok: s.ok, bad: s.bad + 1, streak: 0 }))
      }
    },
  })

  const hv = handVoicing(card, hand)
  const voicing = [...hv.lh, ...hv.rh]
  const marks = new Map<number, KeyMark>()
  if (preview) preview.forEach((m, i) => marks.set(m, i === 0 ? 'root' : 'chord'))
  else if (revealed) voicing.forEach((m, i) => marks.set(m, i === 0 ? 'root' : 'chord'))
  if (last) for (const [n, mk] of judgeMarks(last.notes, card, last.j)) marks.set(n, mk)
  const groupMastery = initialCards ? mastery(cards, stats) : mastery(cardsForGroups([groupId], 'all'), stats)
  const bassName = noteName(chordPcs(card)[card.inversion], card, style)
  const tips = cardTips(card, style, hand)
  const st = stats[card.id]

  return (
    <div className="space-y-4">
      {initialCards ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-miss/40 bg-miss/10 px-4 py-2 text-sm">
          Repasando las {initialCards.length} tarjetas que fallaste en el examen.
          <button className="btn btn-sm btn-ghost ml-auto" onClick={onClearReview}>
            Volver al grupo
          </button>
        </div>
      ) : (
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{CATEGORY_INFO[group.category].title}</span>
            <h2 className="text-lg font-extrabold">{group.title}</h2>
            <div className="seg ml-auto" role="group" aria-label="Inversiones">
              {(['root', 'inversions', 'all'] as const).map((m) => (
                <button key={m} aria-pressed={invMode === m} onClick={() => setInvMode(m)}>
                  {INVERSION_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
            <Lightbulb size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /> {group.tip}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Escuchar y ver:</span>
            {group.chords.map((ch) => {
              const hv0 = handVoicing({ ...ch, inversion: 0 }, hand)
              const v = [...hv0.lh, ...hv0.rh]
              return (
                <button
                  key={`${ch.rootPc}${ch.typeId}`}
                  className="btn btn-sm"
                  onMouseEnter={() => setPreview(v)}
                  onMouseLeave={() => setPreview(null)}
                  onClick={() => {
                    setPreview(v)
                    void audioEngine.demo(v, { durationMs: 1300 })
                  }}
                  title={chordLongName(ch, style)}
                >
                  <Volume2 size={13} /> {baseSymbol(ch)}
                </button>
              )
            })}
            <span className="ml-auto flex items-center gap-2 text-xs text-muted">
              Dominio del grupo <MasteryBar value={groupMastery} small /> <b className="tabular-nums">{Math.round(groupMastery * 100)} %</b>
            </span>
          </div>
          {invMode === 'root' && groupMastery >= 0.3 && <p className="text-xs text-faint">Cuando el estado fundamental te salga sin pensar, cambia a «Solo inversiones».</p>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="card relative overflow-hidden p-6 text-center">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-72 rounded-full opacity-20 blur-3xl" style={{ background: last ? STATUS_COLOR[last.j.status] : 'var(--accent)' }} />
          <div className="relative">
            <div className="label">Toca en tu teclado (cualquier octava)</div>
            <div key={card.id} className="animate-pop mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              {chordLongName(card, style)}
            </div>
            <div className="mt-1 text-xl font-bold" style={{ color: card.inversion ? 'var(--accent-2)' : 'var(--accent)' }}>
              {inversionName(card.inversion)}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: hand === 'L' ? 'var(--lh)' : hand === 'R' ? 'var(--rh)' : 'var(--muted)' }}>
              {HAND_PROMPT[hand]}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <span className="chip">{revealed || hint ? cardSymbol(card) : baseSymbol(card)}</span>
              {hint && <span className="chip">Bajo: {bassName}</span>}
              {st && <span className="chip">Caja {st.box}/5</span>}
            </div>
            <div className="mt-4 min-h-12 text-[15px] font-semibold" aria-live="polite">
              {last ? (
                <span style={{ color: STATUS_COLOR[last.j.status] }}>
                  {feedbackText(card, last.j, style)}
                  {last.j.status === 'correct' && <span className="ml-1 tabular-nums text-muted">{(last.ms / 1000).toFixed(1)} s</span>}
                  {last.simulated && <span className="ml-2 chip" style={{ color: 'var(--miss)' }}>SIMULADO · no se guarda</span>}
                </span>
              ) : (
                <span className="text-muted">Pulsa todas las notas a la vez y mantenlas un instante.</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button className="btn btn-sm" onClick={() => setHint(true)} disabled={hint}>
                <Sparkles size={14} /> Pista (bajo)
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setRevealed(true)
                  void audioEngine.demo(voicing, { durationMs: 1300 })
                }}
              >
                <Eye size={14} /> Mostrar respuesta
              </button>
              <button className="btn btn-sm" onClick={() => void audioEngine.demo(voicing, { durationMs: 1300 })}>
                <Volume2 size={14} /> Escuchar
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => next()}>
                <SkipForward size={14} /> {last?.j.status === 'correct' ? 'Siguiente' : 'Saltar'}
              </button>
            </div>
          </div>
        </div>

        <aside className="card space-y-3 p-4">
          <div className="label">Esta sesión</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Aciertos" value={session.ok} color="var(--ok)" />
            <Stat label="Fallos" value={session.bad} color="var(--bad)" />
            <Stat label="Racha" value={session.streak} />
          </div>
          <div className="label pt-1">Consejos para este acorde</div>
          {revealed || hint || failed ? (
            <ul className="space-y-1.5 text-sm text-muted">
              {tips.map((t, i) => (
                <li key={i} className="flex gap-1.5">
                  <Lightbulb size={13} className="mt-1 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">Intenta primero sin ayuda. Los consejos (notas, forma y digitación) aparecen al pedir una pista, al mostrar la respuesta o tras un fallo.</p>
          )}
        </aside>
      </div>

      <div className="card p-3">
        <PianoKeyboard height={130} held={held} marks={marks} />
        <p className="mt-2 text-center text-xs text-faint">
          {cardPrompt(card, style)} · Verde: nota del acorde · Rojo: sobra · Ámbar: bajo equivocado
          {revealed ? ` · Referencia: ${voicing.map((m) => noteName(m % 12, card, style)).join(' – ')}` : ''}
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <div className="text-xl font-black tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}
