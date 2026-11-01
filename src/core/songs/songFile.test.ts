import { describe, expect, it } from 'vitest'
import { loadSongFile, SONG_FILE_FORMAT, songFileToArrangement, type SongFile } from './songFile'

const sample = (patch: Partial<SongFile> = {}): SongFile => ({
  format: SONG_FILE_FORMAT,
  id: 'prueba',
  title: 'Prueba',
  artist: 'Artista',
  key: 'C major',
  bpm: 90,
  timeSignature: [4, 4],
  arrangementType: 'ai-generated',
  isPublicDomain: false,
  confidenceHarmony: 0.8,
  confidenceMelody: 0,
  melodyIncluded: false,
  sources: [{ title: 'Ficha de la canción', url: 'https://example.com/song', kind: 'reference-info', usedFor: 'Acordes y tonalidad' }],
  limitations: [],
  adaptations: [],
  recommendedStartLevel: 'beginner',
  teachingNotes: 'Practica despacio.',
  sections: [
    { name: 'Estrofa', bars: 2, chords: 'C:4 G:4', rightHand: 'E4 D4 C4:2 | D4:4', leftHand: 'C3+E3+G3:4 | B2+D3+G3:4' },
    { name: 'Estribillo', bars: 1, chords: 'Am:2 F:2', rightHand: 'A4:2 F4:2', leftHand: 'A2:2 F2:2' },
  ],
  ...patch,
})

describe('archivo de canción (canciones/*.json)', () => {
  it('convierte secciones con notación válida en un arreglo validado', () => {
    const r = songFileToArrangement(sample())
    expect(r.ok).toBe(true)
    const a = r.arrangement!
    expect(a.id).toBe('cancion-prueba')
    expect(a.sections.map((s) => [s.start, s.end])).toEqual([[0, 8], [8, 12]])
    expect(a.chords.map((c) => c.symbol)).toEqual(['C', 'G', 'Am', 'F'])
    expect(a.notes.filter((n) => n.hand === 'R').length).toBe(6)
  })
  it('un arreglo generado nunca se presenta como transcripción oficial', () => {
    const a = songFileToArrangement(sample()).arrangement!
    expect(a.arrangementType).toBe('ai-generated')
    expect(a.limitations.some((l) => /no es una transcripción oficial/i.test(l))).toBe(true)
  })
  it('"adaptación didáctica" sin fuente musical citada se degrada a arreglo de IA', () => {
    const r = songFileToArrangement(sample({ arrangementType: 'didactic-adaptation' }))
    expect(r.arrangement!.arrangementType).toBe('ai-generated')
    const pd = songFileToArrangement(
      sample({ arrangementType: 'didactic-adaptation', isPublicDomain: true, sources: [{ title: 'IMSLP', url: 'https://imslp.org/x', kind: 'public-domain', usedFor: 'Melodía' }] }),
    )
    expect(pd.arrangement!.arrangementType).toBe('didactic-adaptation')
  })
  it('limita la confianza si no hay fuentes verificables', () => {
    const r = songFileToArrangement(sample({ confidenceHarmony: 0.95, sources: [{ title: 'Conocimiento del modelo', url: '', kind: 'model-knowledge', usedFor: 'Todo' }] }))
    expect(r.arrangement!.confidence).toBeLessThanOrEqual(0.35)
  })
  it('rechaza notación inválida y acordes inexistentes', () => {
    const bad = songFileToArrangement(sample({ sections: [{ name: 'X', bars: 1, chords: 'Hm:4', rightHand: 'Q9 E4', leftHand: 'C3:4' }] }))
    expect(bad.ok).toBe(false)
    expect(bad.issues.some((i) => i.code === 'schema')).toBe(true)
    expect(bad.issues.some((i) => i.code === 'invalid-chord')).toBe(true)
  })
  it('avisa cuando una mano no suma la longitud de la sección', () => {
    const r = songFileToArrangement(sample({ sections: [{ name: 'X', bars: 1, chords: 'C:4', rightHand: 'C4 D4', leftHand: 'C3:4' }] }))
    expect(r.issues.some((i) => i.code === 'timing')).toBe(true)
  })
  it('reubica notas fuera del rango del CT-S300 y lo explica', () => {
    const r = songFileToArrangement(sample({ sections: [{ name: 'X', bars: 1, chords: 'C:4', rightHand: 'C8:4', leftHand: 'C1:4' }] }))
    expect(r.arrangement!.notes.every((n) => n.midi >= 36 && n.midi <= 96)).toBe(true)
    expect(r.arrangement!.adaptations.length).toBeGreaterThan(0)
  })
  it('loadSongFile: JSON roto, esquema incorrecto y nombre de archivo', () => {
    expect(loadSongFile('{ no es json', 'x.json').ok).toBe(false)
    const wrong = loadSongFile(JSON.stringify({ ...sample(), format: 'otro' }), 'prueba.json')
    expect(wrong.ok).toBe(false)
    expect(wrong.issues[0].message).toMatch(/format/)
    const good = loadSongFile(JSON.stringify(sample()), 'otro-nombre.json')
    expect(good.ok).toBe(true)
    expect(good.recommendedStartLevel).toBe('beginner')
    expect(good.issues.some((i) => /se esperaba "prueba.json"/.test(i.message))).toBe(true)
  })
})
