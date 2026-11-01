import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Arrangement } from '../songs/schema'
import type { Skill } from '../practice/exercises'

/**
 * Persistencia local con IndexedDB. Todo queda en el navegador del usuario:
 * no hay servidor de datos. Se puede exportar/importar como JSON.
 */

export type AttemptKind = 'lesson' | 'exercise' | 'song' | 'challenge' | 'improv'

export interface AttemptRecord {
  id: string
  at: number
  kind: AttemptKind
  refId: string
  title: string
  mode: 'wait' | 'timed' | 'improv'
  score: number
  noteAccuracy: number
  timingScore: number | null
  durationScore: number | null
  meanOffsetMs: number | null
  stdDevMs: number | null
  counts: { expected: number; hits: number; wrong: number; octave: number; missed: number; extra: number; early: number; late: number }
  chords: { total: number; complete: number; simultaneous: number }
  bestStreak: number
  /** tiempo real de práctica (s) */
  practiceSec: number
  skills: Skill[]
  tolerance: string
  tempoFactor: number
  hands: 'both' | 'R' | 'L'
  sections?: { id: string; name: string; accuracy: number }[]
  /** acordes tocados en el ejercicio (cifrados) con resultado */
  chordResults?: { symbol: string; complete: boolean }[]
  /** retraso medio en los cambios de acorde (ms) */
  chordChangeLagMs?: number | null
  input: 'midi' | 'mouse' | 'computer-keyboard' | 'simulated' | 'mixed'
}

export interface LessonProgress {
  id: string
  completedAt: number | null
  bestScore: number
  attempts: number
}

interface CoachDB extends DBSchema {
  attempts: { key: string; value: AttemptRecord; indexes: { 'by-at': number; 'by-ref': string } }
  lessons: { key: string; value: LessonProgress }
  songs: { key: string; value: Arrangement & { savedAt: number } }
  kv: { key: string; value: unknown }
}

const DB_NAME = 'piano-coach'
const DB_VERSION = 1
let dbp: Promise<IDBPDatabase<CoachDB>> | null = null

export function db() {
  if (!dbp) {
    dbp = openDB<CoachDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        const a = d.createObjectStore('attempts', { keyPath: 'id' })
        a.createIndex('by-at', 'at')
        a.createIndex('by-ref', 'refId')
        d.createObjectStore('lessons', { keyPath: 'id' })
        d.createObjectStore('songs', { keyPath: 'id' })
        d.createObjectStore('kv')
      },
    })
  }
  return dbp
}

/** Solo para pruebas */
export async function _resetDbForTests() {
  if (dbp) (await dbp).close()
  dbp = null
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(DB_NAME)
    r.onsuccess = r.onerror = r.onblocked = () => res()
  })
}

export const store = {
  async addAttempt(a: AttemptRecord) {
    await (await db()).put('attempts', a)
  },
  async attempts(): Promise<AttemptRecord[]> {
    return (await db()).getAllFromIndex('attempts', 'by-at')
  },
  async attemptsFor(refId: string): Promise<AttemptRecord[]> {
    return (await db()).getAllFromIndex('attempts', 'by-ref', refId)
  },
  async lessonProgress(): Promise<LessonProgress[]> {
    return (await db()).getAll('lessons')
  },
  async recordLesson(id: string, score: number, passed: boolean) {
    const d = await db()
    const prev = (await d.get('lessons', id)) ?? { id, completedAt: null, bestScore: 0, attempts: 0 }
    const next: LessonProgress = {
      id,
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, score),
      completedAt: prev.completedAt ?? (passed ? Date.now() : null),
    }
    await d.put('lessons', next)
    return next
  },
  async songs() {
    return (await db()).getAll('songs')
  },
  async saveSong(a: Arrangement) {
    await (await db()).put('songs', { ...a, savedAt: Date.now() })
  },
  async deleteSong(id: string) {
    await (await db()).delete('songs', id)
  },
  async getKV<T>(key: string): Promise<T | undefined> {
    return (await (await db()).get('kv', key)) as T | undefined
  },
  async setKV(key: string, value: unknown) {
    await (await db()).put('kv', value, key)
  },
}

export interface ExportFile {
  app: 'piano-coach'
  version: 1
  exportedAt: string
  attempts: AttemptRecord[]
  lessons: LessonProgress[]
  songs: Arrangement[]
  kv: Record<string, unknown>
}

export async function exportAll(): Promise<ExportFile> {
  const d = await db()
  const keys = await d.getAllKeys('kv')
  const kv: Record<string, unknown> = {}
  for (const k of keys) kv[String(k)] = await d.get('kv', k)
  return {
    app: 'piano-coach',
    version: 1,
    exportedAt: new Date().toISOString(),
    attempts: await d.getAll('attempts'),
    lessons: await d.getAll('lessons'),
    songs: (await d.getAll('songs')).map(({ savedAt: _s, ...a }) => a),
    kv,
  }
}

/** Importa datos. `merge` conserva lo existente y añade/actualiza lo importado. */
export async function importAll(data: unknown, merge = true): Promise<{ attempts: number; lessons: number; songs: number }> {
  const f = data as ExportFile
  if (!f || f.app !== 'piano-coach' || !Array.isArray(f.attempts) || !Array.isArray(f.lessons)) throw new Error('El archivo no es una exportación válida de Piano Coach.')
  const d = await db()
  const tx = d.transaction(['attempts', 'lessons', 'songs', 'kv'], 'readwrite')
  if (!merge) await Promise.all([tx.objectStore('attempts').clear(), tx.objectStore('lessons').clear(), tx.objectStore('songs').clear()])
  for (const a of f.attempts) if (a && typeof a.id === 'string' && typeof a.score === 'number') await tx.objectStore('attempts').put(a)
  for (const l of f.lessons) {
    if (!l || typeof l.id !== 'string') continue
    const prev = merge ? await tx.objectStore('lessons').get(l.id) : undefined
    await tx.objectStore('lessons').put(prev ? { id: l.id, attempts: prev.attempts + l.attempts, bestScore: Math.max(prev.bestScore, l.bestScore), completedAt: prev.completedAt ?? l.completedAt } : l)
  }
  for (const s of f.songs ?? []) if (s && typeof s.id === 'string') await tx.objectStore('songs').put({ ...s, savedAt: Date.now() })
  for (const [k, v] of Object.entries(f.kv ?? {})) await tx.objectStore('kv').put(v, k)
  await tx.done
  return { attempts: f.attempts.length, lessons: f.lessons.length, songs: (f.songs ?? []).length }
}
