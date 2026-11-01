import { describe, expect, it } from 'vitest'
import { isBlocking, type SongFileResult } from '../core/songs/songFile'
import { FILE_SONGS } from './fileSongs'

// Comprueba los archivos reales de canciones/: `npm test` falla si alguno está roto.
const cases: [string, SongFileResult | null][] = FILE_SONGS.length ? FILE_SONGS.map((s) => [s.file, s]) : [['(sin archivos)', null]]

describe('canciones/*.json del proyecto', () => {
  it.each(cases)('%s es válido', (_name, s) => {
    if (!s) return
    expect(s.issues.filter(isBlocking).map((i) => i.message)).toEqual([])
    expect(s.ok).toBe(true)
  })
})
