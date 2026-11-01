import { create } from 'zustand'
import type { OutputDestination, Timbre } from '../core/audio/AudioEngine'
import type { Accidental, NamingStyle, OctaveConvention } from '../core/music/notes'
import type { DifficultyPreset, ScoreWeights, Tolerance } from '../core/scoring/types'
import { DEFAULT_WEIGHTS, TOLERANCE_PRESETS } from '../core/scoring/tolerance'
import { store } from '../core/storage/db'

export interface Settings {
  theme: 'dark' | 'light'
  octaveConvention: OctaveConvention
  namingStyle: NamingStyle
  accidental: Accidental
  showNoteNames: 'all' | 'c-only' | 'none'
  /** compensación de latencia de entrada (ms) medida en la calibración */
  latencyMs: number
  /** desplazamiento de notas entrantes (compensa "MIDI Out Octave Shift" del Casio) */
  inputTranspose: number
  difficulty: DifficultyPreset
  customTolerance: Tolerance
  weights: ScoreWeights
  extraPenalty: number
  timbre: Timbre
  /** destino de reproducción de demos y acompañamientos */
  playbackDestination: OutputDestination
  /** ¿la app debe sonar cuando se toca el Casio? (normalmente no: el Casio ya suena) */
  monitorMidiInput: boolean
  volumeDb: number
  metronomeDb: number
  midiOutputChannel: number
  preferredInput: string | null
  preferredOutput: string | null
  rangeLow: number
  rangeHigh: number
  computerKeyboard: boolean
  onboarded: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  octaveConvention: 'C4',
  namingStyle: 'latin',
  accidental: 'sharp',
  showNoteNames: 'all',
  latencyMs: 0,
  inputTranspose: 0,
  difficulty: 'beginner',
  customTolerance: TOLERANCE_PRESETS.intermediate,
  weights: DEFAULT_WEIGHTS,
  extraPenalty: 0.5,
  timbre: 'piano',
  playbackDestination: 'app',
  monitorMidiInput: false,
  volumeDb: -6,
  metronomeDb: -8,
  midiOutputChannel: 1,
  preferredInput: null,
  preferredOutput: null,
  rangeLow: 36,
  rangeHigh: 96,
  computerKeyboard: true,
  onboarded: false,
}

interface SettingsState extends Settings {
  loaded: boolean
  set: (patch: Partial<Settings>) => void
  load: () => Promise<void>
  reset: () => void
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  set: (patch) => {
    set(patch)
    const { loaded: _l, set: _s, load: _ld, reset: _r, ...data } = { ...get(), ...patch }
    void store.setKV('settings', data)
  },
  load: async () => {
    try {
      const saved = await store.getKV<Partial<Settings>>('settings')
      set({ ...DEFAULT_SETTINGS, ...(saved ?? {}), loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  reset: () => get().set(DEFAULT_SETTINGS),
}))

export function noteNameOpts(s: Pick<Settings, 'octaveConvention' | 'namingStyle' | 'accidental'>) {
  return { convention: s.octaveConvention, style: s.namingStyle, accidental: s.accidental }
}
