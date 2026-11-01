import { create } from 'zustand'
import { earKey, updateEarStat, type EarDrill, type EarStat } from '../core/ear/ear'
import { store } from '../core/storage/db'

/**
 * Progreso del entrenamiento auditivo, por ejercicio y nivel. Se guarda en IndexedDB
 * (clave "earTrainer"), así que entra en la exportación de datos.
 * En «tocar de oído», las respuestas dadas con eventos SIMULADOS no se registran.
 */
interface EarTrainerState {
  stats: Record<string, EarStat>
  loaded: boolean
  load: () => Promise<void>
  record: (drill: EarDrill, level: number, correct: boolean) => void
  reset: () => Promise<void>
}

const KEY = 'earTrainer'
interface Stored {
  version: 1
  stats: Record<string, EarStat>
}
let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useEarTrainer = create<EarTrainerState>((set, get) => ({
  stats: {},
  loaded: false,
  load: async () => {
    const data = await store.getKV<Stored>(KEY)
    set({ stats: data?.stats ?? {}, loaded: true })
  },
  record: (drill, level, correct) => {
    const k = earKey(drill, level)
    set({ stats: { ...get().stats, [k]: updateEarStat(get().stats[k], correct) } })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void store.setKV(KEY, { version: 1, stats: get().stats } satisfies Stored), 300)
  },
  reset: async () => {
    set({ stats: {} })
    await store.setKV(KEY, { version: 1, stats: {} } satisfies Stored)
  },
}))
