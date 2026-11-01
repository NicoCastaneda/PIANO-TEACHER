import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { inputBus } from '../core/midi/inputBus'
import { midiService, type MidiState } from '../core/midi/MidiService'
import type { InputSource, MusicEvent, NoteOnEvent } from '../core/midi/types'

export function useMidiState(): MidiState {
  return useSyncExternalStore(
    (cb) => midiService.subscribe(cb),
    () => midiService.state,
  )
}

/** Notas mantenidas ahora (de cualquier fuente), con su evento de origen. */
export function useHeldNotes(): Map<number, NoteOnEvent> {
  const [held, setHeld] = useState<Map<number, NoteOnEvent>>(() => new Map(inputBus.heldEvents().map((e) => [e.note, e])))
  useEffect(
    () =>
      inputBus.subscribe((e) => {
        if (e.type === 'noteon' || e.type === 'noteoff') setHeld(new Map(inputBus.heldEvents().map((x) => [x.note, x])))
      }),
    [],
  )
  return held
}

export function useInputEvents(fn: (e: MusicEvent) => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => inputBus.subscribe((e) => ref.current(e)), [])
}

/** Fuerza un re-render en cada frame (o a la frecuencia indicada) mientras `active`. */
export function useFrame(active: boolean, fps = 30) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last >= 1000 / fps) {
        last = t
        setTick((x) => (x + 1) % 1e9)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, fps])
}

export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [n, setN] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fn().then(
      (d) => alive && (setData(d), setLoading(false)),
      () => alive && setLoading(false),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  return { data, loading, reload: () => setN((x) => x + 1) }
}

export const SOURCE_COLOR: Record<InputSource, string> = {
  midi: 'var(--accent-2)',
  mouse: 'var(--accent)',
  'computer-keyboard': 'var(--accent)',
  simulated: 'var(--miss)',
}
