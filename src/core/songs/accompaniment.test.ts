import { describe, expect, it } from 'vitest'
import { pitchClass } from '../music/notes'
import { chordPitchClasses } from '../music/theory'
import { canAccompany, chordChart, COMPING_PATTERNS, compingArrangement } from './accompaniment'
import { BUILTIN_SONGS } from './library'
import { validateArrangement } from './validate'

describe('acompañar con cifrados', () => {
  const songs = BUILTIN_SONGS.filter(canAccompany)
  it('hay canciones de la biblioteca con acordes', () => expect(songs.length).toBeGreaterThan(0))

  it('cada patrón genera una izquierda válida, con notas del acorde, y conserva la melodía', () => {
    for (const song of songs)
      for (const p of COMPING_PATTERNS) {
        const a = compingArrangement(song, p.id)
        expect(validateArrangement(a).ok).toBe(true)
        expect(a.notes.filter((n) => n.hand === 'R')).toHaveLength(song.notes.filter((n) => n.hand === 'R').length)
        const lh = a.notes.filter((n) => n.hand === 'L')
        expect(lh.length).toBeGreaterThan(0)
        for (const n of lh) {
          expect(n.midi).toBeLessThanOrEqual(64)
          const c = song.chords.find((x) => x.start <= n.start + 1e-6 && x.start + x.duration > n.start + 1e-6)!
          expect(chordPitchClasses(c.symbol)).toContain(pitchClass(n.midi))
        }
      }
  })

  it('la hoja de cifrados agrupa los acordes por compás', () => {
    const chart = chordChart(songs[0])
    expect(chart[0].bar).toBe(0)
    // los acordes repetidos seguidos se muestran una vez
    for (const b of chart) for (let i = 1; i < b.chords.length; i++) expect(b.chords[i].symbol).not.toBe(b.chords[i - 1].symbol)
    expect(chart.flatMap((b) => b.chords).length).toBeLessThanOrEqual(songs[0].chords.length)
  })
})
