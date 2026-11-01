/** Lee una variable CSS del tema actual (para dibujar en canvas con los mismos colores). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

export function themeColors() {
  return {
    bg: cssVar('--bg-2'),
    surface: cssVar('--surface'),
    border: cssVar('--border'),
    text: cssVar('--text'),
    muted: cssVar('--muted'),
    faint: cssVar('--faint'),
    accent: cssVar('--accent'),
    accent2: cssVar('--accent-2'),
    rh: cssVar('--rh'),
    lh: cssVar('--lh'),
    ok: cssVar('--ok'),
    bad: cssVar('--bad'),
    miss: cssVar('--miss'),
    extra: cssVar('--extra'),
    expect: cssVar('--expect'),
  }
}

export type ThemeColors = ReturnType<typeof themeColors>

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Ajusta el canvas al tamaño CSS × devicePixelRatio. Devuelve el contexto escalado. */
export function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

/** Color con transparencia, a partir de un color hexadecimal (#rgb o #rrggbb). */
export function alpha(color: string, a: number) {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return color
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
