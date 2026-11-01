import { create } from 'zustand'
import { updateStat, type CardStat, type HandMode } from '../core/chords/trainer'
import { store } from '../core/storage/db'

/**
 * Progreso del entrenador de acordes (cajas de repaso por tarjeta) y la mano elegida.
 * Se guarda en IndexedDB (clave "chordTrainer"), así que entra en la exportación de datos.
 * Las respuestas dadas con eventos SIMULADOS no se registran.
 */
interface ChordTrainerState {
  stats: Record<string, CardStat>
  hand: HandMode
  loaded: boolean
  load: () => Promise<void>
  record: (cardId: string, o: { correct: boolean; revealed: boolean; ms: number }) => void
  setHand: (hand: HandMode) => void
  reset: () => Promise<void>
}

const KEY = 'chordTrainer'
interface Stored {
  version: 1
  stats: Record<string, CardStat>
  hand?: HandMode
}
let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useChordTrainer = create<ChordTrainerState>((set, get) => {
  const save = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void store.setKV(KEY, { version: 1, stats: get().stats, hand: get().hand } satisfies Stored), 300)
  }
  return {
    stats: {},
    hand: 'R',
    loaded: false,
    load: async () => {
      const data = await store.getKV<Stored>(KEY)
      set({ stats: data?.stats ?? {}, hand: data?.hand ?? 'R', loaded: true })
    },
    record: (cardId, o) => {
      set({ stats: { ...get().stats, [cardId]: updateStat(get().stats[cardId], o) } })
      save()
    },
    setHand: (hand) => {
      set({ hand })
      save()
    },
    reset: async () => {
      set({ stats: {} })
      await store.setKV(KEY, { version: 1, stats: {}, hand: get().hand } satisfies Stored)
    },
  }
})
