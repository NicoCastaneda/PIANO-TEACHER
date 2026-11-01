import { useEffect, useRef } from 'react'
import { isBlackKey, midiToName, pitchClass } from '../../core/music/notes'
import type { AssistLevel, PracticeSession } from '../../core/practice/PracticeSession'
import { clickInterval } from '../../core/songs/schema'
import { noteNameOpts, useSettings } from '../../state/settings'
import { alpha, fitCanvas, roundRect, themeColors, type ThemeColors } from './canvasUtil'
import { computeLayout } from './keyLayout'

interface Props {
  session: PracticeSession
  width: number
  height: number
  low: number
  high: number
  assist: AssistLevel
}

/**
 * Notas descendentes: el tiempo avanza hacia abajo; la línea inferior es "ahora".
 * Cada nota se alinea exactamente sobre su tecla (misma geometría que el teclado).
 */
export function FallingNotes({ session, width, height, low, high, assist }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const settings = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    let raf = 0
    let colors: ThemeColors = themeColors()
    let colorsAt = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const canvas = ref.current
      if (!canvas || width < 10) return
      if (now - colorsAt > 1000) {
        colors = themeColors()
        colorsAt = now
      }
      const ctx = fitCanvas(canvas, width, height)
      const layout = computeLayout(low, high, width)
      const t = session.songTime()
      const lookahead = assist === 'full' ? 3 : 2.2
      const hitY = height - 6
      const pps = (hitY - 10) / lookahead
      const yOf = (sec: number) => hitY - (sec - t) * pps
      const s = settingsRef.current
      const opts = noteNameOpts(s)

      // fondo + carriles
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, width, height)
      for (const k of layout.keys) {
        if (k.black) {
          ctx.fillStyle = alpha(colors.border, 0.25)
          ctx.fillRect(k.x, 0, k.w, height)
        } else if (pitchClass(k.midi) === 0) {
          ctx.fillStyle = alpha(colors.border, 0.9)
          ctx.fillRect(k.x, 0, 1, height)
        }
      }
      // líneas de pulso y compás
      const ts = session.cfg.arrangement.timeSignature
      const ci = clickInterval(ts) * session.beatSec
      const bar = ts[0] * ci
      const firstBeat = Math.floor((t - 0.5) / ci) * ci
      ctx.font = '600 10px Inter, sans-serif'
      for (let b = firstBeat; b < t + lookahead; b += ci) {
        const y = yOf(b)
        const isBar = Math.abs(((b % bar) + bar) % bar) < 1e-3 || Math.abs((((b % bar) + bar) % bar) - bar) < 1e-3
        ctx.fillStyle = isBar ? alpha(colors.muted, 0.35) : alpha(colors.border, 0.6)
        ctx.fillRect(0, y, width, isBar ? 1.2 : 0.6)
        if (isBar && b >= 0) {
          ctx.fillStyle = alpha(colors.muted, 0.7)
          ctx.fillText(String(Math.round(b / bar) + 1), 4, y - 3)
        }
      }

      // acordes (cifrado a la izquierda)
      if (assist !== 'none') {
        ctx.font = '700 13px Inter, sans-serif'
        for (const c of session.timeline.chords) {
          if (c.start > t + lookahead || c.start + c.duration < t) continue
          const y = Math.min(hitY - 4, yOf(c.start))
          ctx.fillStyle = alpha(colors.accent, 0.9)
          ctx.fillText(c.symbol, 22, y - 4)
        }
      }

      if (assist !== 'none') {
        // acompañamiento (lo toca la app): contorno tenue
        for (const n of session.timeline.accompaniment) {
          if (n.start > t + lookahead || n.start + n.duration < t - 0.2) continue
          const k = layout.byMidi.get(n.midi)
          if (!k) continue
          const y1 = yOf(n.start)
          const y0 = yOf(n.start + n.duration)
          ctx.strokeStyle = alpha(n.hand === 'R' ? colors.rh : colors.lh, 0.35)
          ctx.lineWidth = 1
          roundRect(ctx, k.x + 2, y0, k.w - 4, Math.max(4, y1 - y0), 4)
          ctx.stroke()
        }
        // notas a tocar
        const waitingStep = session.cfg.mode === 'wait' ? session.steps[session.stepIdx] : undefined
        for (const n of session.timeline.expected) {
          if (n.start > t + lookahead || n.start + n.duration < t - 0.3) continue
          const k = layout.byMidi.get(n.midi)
          if (!k) continue
          const y1 = yOf(n.start)
          const y0 = yOf(n.start + n.duration)
          const st = session.live.get(n.id)
          const base = n.hand === 'R' ? colors.rh : colors.lh
          const color = st === 'hit' ? colors.ok : st === 'missed' ? colors.miss : base
          const pad = k.black ? 1 : 2.5
          const h = Math.max(6, y1 - y0)
          const near = Math.abs(n.start - t) < 0.25 && !st
          const inStep = waitingStep?.includes(n) && session.status === 'waiting'
          ctx.save()
          if (near || inStep) {
            ctx.shadowColor = base
            ctx.shadowBlur = inStep ? 12 + 8 * Math.sin(performance.now() / 160) : 16
          }
          const grad = ctx.createLinearGradient(0, y0, 0, y0 + h)
          grad.addColorStop(0, alpha(color, st === 'missed' ? 0.35 : 0.75))
          grad.addColorStop(1, alpha(color, st === 'missed' ? 0.45 : 1))
          ctx.fillStyle = grad
          roundRect(ctx, k.x + pad, y0, k.w - pad * 2, h, Math.min(7, k.w / 3))
          ctx.fill()
          ctx.restore()
          if (isBlackKey(n.midi)) {
            ctx.strokeStyle = alpha('#000', 0.35)
            ctx.lineWidth = 1
            roundRect(ctx, k.x + pad, y0, k.w - pad * 2, h, Math.min(7, k.w / 3))
            ctx.stroke()
          }
          if (assist === 'full' && h > 14 && k.w > 11) {
            ctx.fillStyle = '#0b0d18'
            ctx.font = `700 ${Math.min(11, k.w * 0.45)}px Inter, sans-serif`
            ctx.textAlign = 'center'
            ctx.fillText(midiToName(n.midi, { ...opts, withOctave: false }), k.x + k.w / 2, y1 - 5)
            ctx.textAlign = 'start'
          }
        }
      }

      // línea de ejecución
      const g = ctx.createLinearGradient(0, hitY - 18, 0, hitY)
      g.addColorStop(0, 'transparent')
      g.addColorStop(1, alpha(colors.accent, 0.35))
      ctx.fillStyle = g
      ctx.fillRect(0, hitY - 18, width, 18)
      ctx.fillStyle = colors.accent
      ctx.fillRect(0, hitY, width, 2)

      // cuenta previa
      if (session.status === 'countin' && t < 0) {
        const beatsLeft = Math.ceil(-t / ci)
        ctx.fillStyle = alpha(colors.text, 0.9)
        ctx.font = '800 64px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(beatsLeft), width / 2, height / 2)
        ctx.textAlign = 'start'
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [session, width, height, low, high, assist])

  return <canvas ref={ref} className="block" style={{ width, height }} />
}
