import { isBlackKey, pitchClass } from '../../core/music/notes'

export interface KeyRect {
  midi: number
  x: number
  w: number
  black: boolean
}

// Desplazamiento de cada tecla negra respecto al borde entre blancas (fracción del ancho negro)
const BLACK_OFFSET: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 }

/** Geometría compartida por el teclado virtual, notas descendentes y piano roll. */
export function computeLayout(low: number, high: number, width: number) {
  let whites = 0
  for (let n = low; n <= high; n++) if (!isBlackKey(n)) whites++
  const ww = width / Math.max(1, whites)
  const bw = ww * 0.62
  const keys: KeyRect[] = []
  const byMidi = new Map<number, KeyRect>()
  let wi = 0
  for (let n = low; n <= high; n++) {
    let k: KeyRect
    if (!isBlackKey(n)) {
      k = { midi: n, x: wi * ww, w: ww, black: false }
      wi++
    } else {
      const center = wi * ww + (BLACK_OFFSET[pitchClass(n)] ?? 0) * bw
      k = { midi: n, x: center - bw / 2, w: bw, black: true }
    }
    keys.push(k)
    byMidi.set(n, k)
  }
  return { keys, byMidi, whiteWidth: ww, blackWidth: bw, whites }
}

export type KeyLayout = ReturnType<typeof computeLayout>
