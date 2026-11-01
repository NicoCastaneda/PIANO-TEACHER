import { CheckCircle2 } from 'lucide-react'
import { pitchClass, type NamingStyle } from '../../../core/music/notes'
import { inversionName } from '../../../core/music/theory'
import {
  CATEGORY_INFO,
  cardsForGroups,
  cardSymbol,
  chordPcs,
  CHORD_GROUPS,
  mastery,
  noteName,
  type CardStat,
  type ChordCard,
  type ChordCategory,
  type ChordGroup,
  type ChordRef,
  type Judgement,
} from '../../../core/chords/trainer'
import type { KeyMark } from '../../components/PianoKeyboard'

export const CATEGORIES: ChordCategory[] = ['fundamental', 'useful', 'occasional']

export function groupSymbols(g: ChordGroup) {
  return g.chords.map(baseSymbol)
}

/** Cifrado sin barra (para no revelar el bajo en una pregunta). */
export function baseSymbol(ch: ChordRef) {
  return cardSymbol({ ...ch, inversion: 0 })
}

export function MasteryBar({ value, small }: { value: number; small?: boolean }) {
  const color = value >= 0.8 ? 'var(--ok)' : value >= 0.4 ? 'var(--accent)' : 'var(--miss)'
  return (
    <span className={`inline-block overflow-hidden rounded-full bg-surface-3 ${small ? 'h-1.5 w-16' : 'h-2 w-full'}`}>
      <span className="block h-full rounded-full transition-all" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </span>
  )
}

export function GroupList({ selected, onSelect, stats, recommendedId }: { selected: string; onSelect: (id: string) => void; stats: Record<string, CardStat>; recommendedId: string }) {
  return (
    <nav className="space-y-4">
      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <div className="label mb-1.5">{CATEGORY_INFO[cat].title}</div>
          <div className="space-y-1">
            {CHORD_GROUPS.filter((g) => g.category === cat).map((g) => {
              const m = mastery(cardsForGroups([g.id], 'all'), stats)
              const on = g.id === selected
              return (
                <button
                  key={g.id}
                  onClick={() => onSelect(g.id)}
                  className="w-full rounded-xl px-3 py-2 text-left transition-colors"
                  style={on ? { background: 'color-mix(in oklab, var(--accent) 16%, transparent)' } : undefined}
                  aria-pressed={on}
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {m >= 0.8 && <CheckCircle2 size={13} style={{ color: 'var(--ok)' }} />}
                    <span className="min-w-0 flex-1 truncate">{groupSymbols(g).join(' · ')}</span>
                    {g.id === recommendedId && <span className="chip text-[10px]">Siguiente</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <MasteryBar value={m} small />
                    <span className="text-[11px] tabular-nums text-muted">{Math.round(m * 100)} %</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

/** Marcas del teclado tras evaluar: verde = nota del acorde, rojo = sobra, ámbar = bajo equivocado. */
export function judgeMarks(played: number[], card: ChordRef & { inversion: number }, j: Judgement): Map<number, KeyMark> {
  const pcs = chordPcs(card)
  const m = new Map<number, KeyMark>()
  const sorted = [...played].sort((a, b) => a - b)
  for (const n of sorted) m.set(n, pcs.includes(pitchClass(n)) ? 'ok' : 'bad')
  if (j.status === 'wrong-inversion' && sorted.length) m.set(sorted[0], 'miss')
  return m
}

/** Texto de la respuesta, en lenguaje sencillo. */
export function feedbackText(card: ChordCard, j: Judgement, style: NamingStyle): string {
  const zone = j.zoneHint ? ` ${j.zoneHint}` : ''
  return baseFeedback(card, j, style) + zone
}

function baseFeedback(card: ChordCard, j: Judgement, style: NamingStyle): string {
  const n = (pc: number) => noteName(pc, card, style)
  const bassWanted = n(chordPcs(card)[card.inversion])
  switch (j.status) {
    case 'correct':
      return j.wide ? '¡Correcto! (Notas repartidas en más de una octava: vale, pero intenta también la posición cerrada.)' : '¡Correcto!'
    case 'wrong-inversion':
      return `Notas correctas, pero tocaste la ${inversionName(j.playedInversion ?? 0).toLowerCase()}. Para la ${inversionName(card.inversion).toLowerCase()}, pon ${bassWanted} en el bajo (la nota más grave).`
    case 'wrong-notes':
      return `Sobra: ${j.extraPcs.map(n).join(', ')}.${j.missingPcs.length ? ` Falta: ${j.missingPcs.map(n).join(', ')}.` : ''}`
    case 'incomplete':
      return j.rhIncomplete
        ? `El bajo está bien, pero la derecha debe tocar el acorde completo. Falta arriba: ${j.missingPcs.map(n).join(', ')}.`
        : `Incompleto. Falta: ${j.missingPcs.map(n).join(', ')}.`
  }
}

export const STATUS_COLOR: Record<Judgement['status'] | 'skipped', string> = {
  correct: 'var(--ok)',
  'wrong-inversion': 'var(--miss)',
  'wrong-notes': 'var(--bad)',
  incomplete: 'var(--bad)',
  skipped: 'var(--faint)',
}

export const STATUS_LABEL: Record<Judgement['status'] | 'skipped', string> = {
  correct: 'Correcto',
  'wrong-inversion': 'Inversión equivocada',
  'wrong-notes': 'Notas incorrectas',
  incomplete: 'Incompleto',
  skipped: 'Saltada',
}
