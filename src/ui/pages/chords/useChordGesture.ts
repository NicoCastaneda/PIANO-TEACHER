import { useEffect, useRef } from 'react'
import { inputBus } from '../../../core/midi/inputBus'
import type { InputSource } from '../../../core/midi/types'

export interface ChordGesture {
  notes: number[]
  sources: Set<InputSource>
  /** ms desde `startedAt` (el momento en que se mostró la pregunta) hasta que se completó el gesto */
  at: number
}

/** Tiempo de espera para que todos los dedos lleguen a las teclas antes de evaluar. */
export const SETTLE_MS = 160

/**
 * Detecta "un acorde tocado" a partir de las notas mantenidas:
 * - si se mantienen al menos `minNotes` teclas y no cambia nada durante 160 ms → se evalúa;
 * - si se sueltan todas sin llegar a evaluar → se evalúa lo máximo que se llegó a pulsar.
 * Después de evaluar no vuelve a hacerlo hasta que se sueltan todas las teclas.
 */
export function useChordGesture(opts: { active: boolean; minNotes: number; onChord: (g: ChordGesture) => void }) {
  const ref = useRef(opts)
  ref.current = opts
  useEffect(() => {
    let peak: number[] = []
    let sources = new Set<InputSource>()
    let consumed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const commit = (notes: number[]) => {
      clearTimeout(timer)
      if (consumed || !ref.current.active || !notes.length) return
      consumed = true
      ref.current.onChord({ notes, sources: new Set(sources), at: performance.now() })
    }
    const unsub = inputBus.subscribe((e) => {
      if (e.type !== 'noteon' && e.type !== 'noteoff') return
      const held = inputBus.heldNotes()
      if (e.type === 'noteon') {
        sources.add(e.source)
        if (held.length > peak.length) peak = held
      }
      if (!held.length) {
        if (!consumed) commit(peak)
        peak = []
        sources = new Set()
        consumed = false
        return
      }
      clearTimeout(timer)
      if (!consumed && held.length >= ref.current.minNotes) timer = setTimeout(() => commit(inputBus.heldNotes()), SETTLE_MS)
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [])
}
