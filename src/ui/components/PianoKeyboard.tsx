import { memo, useEffect, useMemo, useRef } from 'react'
import { emitNote } from '../../core/midi/inputBus'
import type { NoteOnEvent } from '../../core/midi/types'
import { midiToName, octaveOf, pitchClass } from '../../core/music/notes'
import type { LiveFlash } from '../../core/practice/PracticeSession'
import { noteNameOpts, useSettings } from '../../state/settings'
import { useElementWidth } from '../../lib/hooks'
import { computeLayout } from './keyLayout'

export type KeyMark = 'ok' | 'bad' | 'miss' | 'extra' | 'scale' | 'root' | 'chord' | 'target'

export interface PianoKeyboardProps {
  low?: number
  high?: number
  height?: number
  held?: Map<number, NoteOnEvent>
  /** notas que deben tocarse ahora, coloreadas por mano */
  expected?: Map<number, 'L' | 'R'>
  /** marcas estáticas (escalas, acordes, resultados) */
  marks?: Map<number, KeyMark>
  /** notas que suenan desde la app (demo / acompañamiento) */
  sounding?: Set<number>
  flashes?: LiveFlash[]
  fingers?: Map<number, number>
  labels?: 'all' | 'c-only' | 'none'
  interactive?: boolean
  onWidth?: (w: number) => void
}

const MARK_COLOR: Record<KeyMark, string> = {
  ok: 'var(--ok)',
  bad: 'var(--bad)',
  miss: 'var(--miss)',
  extra: 'var(--extra)',
  scale: 'var(--accent)',
  root: 'var(--accent-2)',
  chord: 'var(--accent)',
  target: 'var(--expect)',
}

const FLASH_COLOR = { hit: 'var(--ok)', wrong: 'var(--bad)', extra: 'var(--extra)', missed: 'var(--miss)' }

function PianoKeyboardImpl({
  low = 36,
  high = 96,
  height = 150,
  held,
  expected,
  marks,
  sounding,
  flashes,
  fingers,
  labels,
  interactive = true,
  onWidth,
}: PianoKeyboardProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const settings = useSettings()
  const labelMode = labels ?? settings.showNoteNames
  const layout = useMemo(() => computeLayout(low, high, width || 1), [low, high, width])
  const pointerDown = useRef<number | null>(null)
  const opts = noteNameOpts(settings)

  useEffect(() => {
    if (width) onWidth?.(width)
  }, [width, onWidth])

  useEffect(() => {
    const up = () => {
      if (pointerDown.current !== null) {
        emitNote('mouse', 'noteoff', pointerDown.current)
        pointerDown.current = null
      }
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const press = (midi: number) => {
    if (!interactive) return
    if (pointerDown.current !== null && pointerDown.current !== midi) emitNote('mouse', 'noteoff', pointerDown.current)
    if (pointerDown.current === midi) return
    pointerDown.current = midi
    emitNote('mouse', 'noteon', midi, 90)
  }

  const now = performance.now()
  const flashBy = new Map<number, LiveFlash>()
  for (const f of flashes ?? []) if (now - f.at < 450) flashBy.set(f.midi, f)

  const blackH = height * 0.62
  const render = (black: boolean) =>
    layout.keys
      .filter((k) => k.black === black)
      .map((k) => {
        const h = held?.get(k.midi)
        const exp = expected?.get(k.midi)
        const mark = marks?.get(k.midi)
        const fl = flashBy.get(k.midi)
        const isSounding = sounding?.has(k.midi)
        const pc = pitchClass(k.midi)
        const showLabel = labelMode === 'all' ? !black || width > 900 : labelMode === 'c-only' ? pc === 0 : false
        let fill = black ? 'linear-gradient(180deg, var(--key-black-2), var(--key-black))' : 'linear-gradient(180deg, var(--key-white), var(--key-white-2))'
        let glow = ''
        let ring = ''
        if (mark) {
          const c = MARK_COLOR[mark]
          fill = black ? `linear-gradient(180deg, color-mix(in oklab, ${c} 75%, black), color-mix(in oklab, ${c} 45%, black))` : `linear-gradient(180deg, color-mix(in oklab, ${c} 35%, white), color-mix(in oklab, ${c} 60%, white))`
        }
        if (exp) {
          const c = exp === 'R' ? 'var(--rh)' : 'var(--lh)'
          ring = `inset 0 0 0 3px ${c}`
          glow = `0 0 18px 2px color-mix(in oklab, ${c} 70%, transparent)`
          fill = black ? `linear-gradient(180deg, color-mix(in oklab, ${c} 55%, black), var(--key-black))` : `linear-gradient(180deg, color-mix(in oklab, ${c} 22%, white), color-mix(in oklab, ${c} 45%, white))`
        }
        if (isSounding && !h) fill = black ? 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 70%, black), var(--key-black))' : 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 25%, white), color-mix(in oklab, var(--accent) 45%, white))'
        if (h) {
          const c = fl ? FLASH_COLOR[fl.kind] : h.source === 'simulated' ? 'var(--miss)' : 'var(--accent-2)'
          fill = `linear-gradient(180deg, color-mix(in oklab, ${c} 80%, white), ${c})`
          glow = `0 0 22px 3px color-mix(in oklab, ${c} 75%, transparent)`
        } else if (fl) {
          glow = `0 0 16px 2px color-mix(in oklab, ${FLASH_COLOR[fl.kind]} 70%, transparent)`
        }
        const finger = fingers?.get(k.midi)
        return (
          <div
            key={k.midi}
            role={interactive ? 'button' : undefined}
            aria-label={midiToName(k.midi, opts)}
            onPointerDown={(e) => {
              e.preventDefault()
              // Liberar la captura permite el glissando (pointerenter en otras teclas).
              try {
                const el = e.target as HTMLElement
                if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
              } catch {
                /* sin captura activa */
              }
              press(k.midi)
            }}
            onPointerEnter={(e) => {
              if (e.buttons & 1 && pointerDown.current !== null) press(k.midi)
            }}
            className="absolute top-0 select-none transition-[transform,box-shadow] duration-75"
            style={{
              left: k.x,
              width: black ? k.w : k.w - 1.5,
              height: black ? blackH : height,
              background: fill,
              borderRadius: black ? '0 0 5px 5px' : '0 0 8px 8px',
              boxShadow: [ring, glow, black ? '0 3px 6px rgb(0 0 0 / 0.5)' : 'inset 0 -4px 0 rgb(0 0 0 / 0.08), 0 1px 0 rgb(0 0 0 / 0.25)'].filter(Boolean).join(', '),
              transform: h ? 'translateY(2px)' : undefined,
              zIndex: black ? 2 : 1,
              cursor: interactive ? 'pointer' : 'default',
            }}
          >
            {finger && (
              <span className="absolute left-1/2 -translate-x-1/2 rounded-full text-[11px] font-bold text-white" style={{ bottom: black ? 8 : 30, background: exp === 'L' ? 'var(--lh)' : 'var(--rh)', width: 18, height: 18, lineHeight: '18px', textAlign: 'center' }}>
                {finger}
              </span>
            )}
            {showLabel && (
              <span
                className="pointer-events-none absolute inset-x-0 text-center font-semibold leading-none"
                style={{ bottom: black ? 6 : 8, fontSize: black ? 8 : Math.min(11, layout.whiteWidth * 0.42), color: black ? '#cfd3ea' : pc === 0 ? '#3b2fa0' : '#5a5f7a' }}
              >
                {midiToName(k.midi, { ...opts, withOctave: false })}
                {pc === 0 && !black && <span className="block pt-0.5 text-[9px] opacity-70">{octaveOf(k.midi, settings.octaveConvention)}</span>}
              </span>
            )}
          </div>
        )
      })

  return (
    <div ref={ref} className="relative w-full touch-none" style={{ height }}>
      {width > 0 && (
        <>
          {render(false)}
          {render(true)}
        </>
      )}
    </div>
  )
}

export const PianoKeyboard = memo(PianoKeyboardImpl)
