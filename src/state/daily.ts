import { create } from 'zustand'
import { buildDailyPlan, localDate, type DailyPlan, type StepResult } from '../core/daily/plan'
import { canAccompany } from '../core/songs/accompaniment'
import { BUILTIN_SONGS } from '../core/songs/library'
import { store } from '../core/storage/db'
import { useChordTrainer } from './chordTrainer'
import { useEarTrainer } from './earTrainer'
import { useProgress } from './library'

/**
 * «Práctica de hoy»: el plan se genera una vez al día a partir de los datos registrados
 * y se guarda (clave "dailyPlan") junto con lo que ya hiciste, para poder retomarlo.
 */
interface Stored {
  version: 1
  plan: DailyPlan
  results: Record<string, StepResult>
}

interface DailyState {
  plan: DailyPlan | null
  results: Record<string, StepResult>
  ensure: () => Promise<DailyPlan>
  setResult: (stepId: string, r: StepResult) => void
  regenerate: () => Promise<void>
}

const KEY = 'dailyPlan'

function generate(): DailyPlan {
  return buildDailyPlan({
    attempts: useProgress.getState().attempts,
    chordStats: useChordTrainer.getState().stats,
    earStats: useEarTrainer.getState().stats,
    compSongIds: BUILTIN_SONGS.filter(canAccompany).map((s) => s.id),
  })
}

export const useDaily = create<DailyState>((set, get) => {
  const save = () => void store.setKV(KEY, { version: 1, plan: get().plan!, results: get().results } satisfies Stored)
  return {
    plan: null,
    results: {},
    ensure: async () => {
      const today = localDate()
      const cur = get().plan
      if (cur?.date === today) return cur
      const data = await store.getKV<Stored>(KEY)
      if (data?.plan.date === today) {
        set({ plan: data.plan, results: data.results })
        return data.plan
      }
      const plan = generate()
      set({ plan, results: {} })
      save()
      return plan
    },
    setResult: (stepId, r) => {
      set({ results: { ...get().results, [stepId]: r } })
      save()
    },
    regenerate: async () => {
      set({ plan: generate(), results: {} })
      save()
    },
  }
})
