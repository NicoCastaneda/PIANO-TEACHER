import { create } from 'zustand'
import { BUILTIN_SONGS } from '../core/songs/library'
import type { Arrangement } from '../core/songs/schema'
import { store, type AttemptRecord, type LessonProgress } from '../core/storage/db'
import { FILE_SONGS } from './fileSongs'

interface LibraryState {
  userSongs: Arrangement[]
  loaded: boolean
  load: () => Promise<void>
  save: (a: Arrangement) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useLibrary = create<LibraryState>((set, get) => ({
  userSongs: [],
  loaded: false,
  load: async () => {
    const songs = await store.songs()
    set({ userSongs: songs.sort((a, b) => b.savedAt - a.savedAt), loaded: true })
  },
  save: async (a) => {
    await store.saveSong(a)
    await get().load()
  },
  remove: async (id) => {
    await store.deleteSong(id)
    await get().load()
  },
}))

export function findSong(id: string, userSongs: Arrangement[]): Arrangement | undefined {
  return (
    BUILTIN_SONGS.find((s) => s.id === id) ??
    FILE_SONGS.find((s) => s.ok && s.arrangement?.id === id)?.arrangement ??
    userSongs.find((s) => s.id === id)
  )
}

interface ProgressState {
  attempts: AttemptRecord[]
  lessons: LessonProgress[]
  loaded: boolean
  load: () => Promise<void>
}

export const useProgress = create<ProgressState>((set) => ({
  attempts: [],
  lessons: [],
  loaded: false,
  load: async () => {
    const [attempts, lessons] = await Promise.all([store.attempts(), store.lessonProgress()])
    set({ attempts, lessons, loaded: true })
  },
}))
