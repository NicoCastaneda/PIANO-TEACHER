import { useEffect, useRef } from 'react'
import { isBlackKey, midiToName, pitchClass } from '../../core/music/notes'
import type { AssistLevel, PracticeSession } from '../../core/practice/PracticeSession'
import type { ExpectedOutcome, PlayedNote } from '../../core/scoring/types'
import { clickInterval } from '../../core/songs/schema'
import { noteNameOpts, useSettings } from '../../state/settings'
import { alpha, fitCanvas, roundRect, themeColors } from './canvasUtil'

interface Props {
  session: PracticeSession
  width: number
  height: number
  assist: AssistLevel
}

function pitchRange(midis: number[]): [number, number] {
  if (!midis.length) return [55, 79]
  let lo = Math.min(...midis) - 2
  let hi = Math.max(...midis) + 2
  if (hi - lo < 14) {
    const mid = (hi + lo) / 2
    lo = Math.round(mid - 7)
    hi = Math.round(mid + 7)
  }
  return [lo, hi]
}

/** Piano roll horizontal en vivo: el cabezal está fijo y la música se desplaza a la izquierda. */
export function PianoRoll({ session, width, height, assist }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const settings = useSettings()
  const sref = useRef(settings)
  sref.current = settings

  useEffect(() => {
    let raf = 0
    const colors = themeColors()
    const all = [...session.timeline.expected, ...session.timeline.accompaniment]
    const [lo, hi] = pitchRange(all.map((n) => n.midi))
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const canvas = ref.current
      if (!canvas || width < 10) return
      const ctx = fitCanvas(canvas, width, height)
      const t = session.songTime()
      const gutter = 44
      const headX = gutter + (width - gutter) * 0.22
      const pps = Math.max(80, (width - gutter) / 7)
      const rowH = height / (hi - lo + 1)
      const xOf = (s: number) => headX + (s - t) * pps
      const yOf = (m: number) => (hi - m) * rowH
      const opts = noteNameOpts(sref.current)
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, width, height)
      for (let m = lo; m <= hi; m++) {
        ctx.fillStyle = isBlackKey(m) ? alpha(colors.border, 0.35) : 'transparent'
        ctx.fillRect(gutter, yOf(m), width, rowH)
        if (pitchClass(m) === 0 || rowH > 12) {
          ctx.fillStyle = pitchClass(m) === 0 ? colors.text : colors.faint
          ctx.font = `${pitchClass(m) === 0 ? 700 : 500} ${Math.min(10, rowH * 0.8)}px Inter, sans-serif`
          ctx.fillText(midiToName(m, opts), 4, yOf(m) + rowH * 0.75)
        }
      }
      const ts = session.cfg.arrangement.timeSignature
      const ci = clickInterval(ts) * session.beatSec
      const bar = ts[0] * ci
      const left = t - (headX - gutter) / pps
      const right = t + (width - headX) / pps
      for (let b = Math.floor(left / ci) * ci; b < right; b += ci) {
        const isBar = Math.abs(((b % bar) + bar) % bar) < 1e-3
        ctx.fillStyle = isBar ? alpha(colors.muted, 0.35) : alpha(colors.border, 0.7)
        ctx.fillRect(xOf(b), 0, isBar ? 1.2 : 0.6, height)
      }
      if (assist !== 'none') {
        ctx.font = '700 12px Inter, sans-serif'
        for (const c of session.timeline.chords) {
          if (c.start > right || c.start + c.duration < left) continue
          ctx.fillStyle = alpha(colors.accent, 0.95)
          ctx.fillText(c.symbol, Math.max(gutter + 2, xOf(c.start) + 3), 13)
        }
        for (const n of session.timeline.accompaniment) {
          if (n.start > right || n.start + n.duration < left) continue
          ctx.strokeStyle = alpha(n.hand === 'R' ? colors.rh : colors.lh, 0.4)
          roundRect(ctx, xOf(n.start), yOf(n.midi) + 1, Math.max(3, n.duration * pps - 2), rowH - 2, 3)
          ctx.stroke()
        }
        for (const n of session.timeline.expected) {
          if (n.start > right || n.start + n.duration < left) continue
          const st = session.live.get(n.id)
          const c = st === 'hit' ? colors.ok : st === 'missed' ? colors.miss : n.hand === 'R' ? colors.rh : colors.lh
          ctx.fillStyle = alpha(c, st === 'missed' ? 0.5 : 0.92)
          roundRect(ctx, xOf(n.start), yOf(n.midi) + 1, Math.max(3, n.duration * pps - 2), rowH - 2, 3)
          ctx.fill()
        }
      }
      // interpretación real (superpuesta, fina)
      for (const p of session.played) {
        const end = p.end ?? t
        if (p.start > right || end < left) continue
        ctx.fillStyle = alpha(colors.text, 0.85)
        ctx.fillRect(xOf(p.start), yOf(p.midi) + rowH * 0.38, Math.max(2, (end - p.start) * pps), Math.max(2, rowH * 0.24))
      }
      ctx.fillStyle = colors.accent
      ctx.fillRect(headX, 0, 2, height)
      ctx.fillStyle = colors.surface
      ctx.fillRect(0, 0, gutter - 2, 0)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [session, width, height, assist])

  return <canvas ref={ref} className="block" style={{ width, height }} />
}

/** Comparación estática esperado vs. real (pantalla de resultados). */
export function ResultTimeline({ outcomes, extras, played, height = 220, lengthSec }: { outcomes: ExpectedOutcome[]; extras: PlayedNote[]; played: PlayedNote[]; height?: number; lengthSec: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const settings = useSettings()
  useEffect(() => {
    const draw = () => {
      const canvas = ref.current
      const w = wrap.current?.clientWidth ?? 0
      if (!canvas || !w) return
      const colors = themeColors()
      const ctx = fitCanvas(canvas, w, height)
      const all = [...outcomes.map((o) => o.expected.midi), ...played.map((p) => p.midi)]
      const [lo, hi] = pitchRange(all)
      const gutter = 40
      const len = Math.max(lengthSec, ...played.map((p) => p.end ?? p.start), 0.5)
      const xOf = (s: number) => gutter + (s / len) * (w - gutter - 6)
      const rowH = height / (hi - lo + 1)
      const yOf = (m: number) => (hi - m) * rowH
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, w, height)
      for (let m = lo; m <= hi; m++) {
        if (isBlackKey(m)) {
          ctx.fillStyle = alpha(colors.border, 0.35)
          ctx.fillRect(gutter, yOf(m), w, rowH)
        }
        if (pitchClass(m) === 0) {
          ctx.fillStyle = colors.muted
          ctx.font = `600 ${Math.min(10, rowH)}px Inter, sans-serif`
          ctx.fillText(midiToName(m, noteNameOpts(settings)), 3, yOf(m) + rowH * 0.8)
        }
      }
      const colorOf: Record<string, string> = { hit: colors.ok, wrong: colors.bad, octave: colors.bad, missed: colors.miss }
      for (const o of outcomes) {
        const e = o.expected
        ctx.fillStyle = alpha(colorOf[o.status], o.status === 'missed' ? 0.55 : 0.85)
        roundRect(ctx, xOf(e.start), yOf(e.midi) + 1, Math.max(3, xOf(e.start + e.duration) - xOf(e.start) - 1), rowH - 2, 2)
        ctx.fill()
        if (o.status === 'missed') {
          ctx.strokeStyle = colors.miss
          ctx.setLineDash([3, 2])
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
      for (const p of played) {
        const isExtra = extras.some((x) => x.id === p.id)
        const isWrong = outcomes.some((o) => (o.status === 'wrong' || o.status === 'octave') && o.played?.id === p.id)
        ctx.fillStyle = isExtra ? colors.extra : isWrong ? colors.bad : alpha(colors.text, 0.9)
        ctx.fillRect(xOf(p.start), yOf(p.midi) + rowH * 0.35, Math.max(2, xOf(p.end ?? p.start + 0.1) - xOf(p.start)), Math.max(2, rowH * 0.3))
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [outcomes, extras, played, height, lengthSec, settings])
  return (
    <div ref={wrap} className="w-full overflow-hidden rounded-xl border border-border">
      <canvas ref={ref} className="block" />
    </div>
  )
}
