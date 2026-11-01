import { Midi } from '@tonejs/midi'
import { detectChord } from '../music/theory'
import type { Arrangement, ChordEvent, Section, SongNote } from './schema'
import { fitToRange } from './adapt'

/**
 * Importa un archivo MIDI estándar (SMF) a un arreglo.
 * - Asignación de manos: si hay ≥2 pistas con notas, la de tesitura media más grave es
 *   la izquierda; con una sola pista se divide en Do central (MIDI 60).
 * - Tempo: se usa el primer cambio de tempo. Si el archivo tiene cambios de tempo se
 *   avisa en "limitaciones" (los pulsos se conservan, el tempo será constante).
 * - Canal 10 (percusión GM) se descarta.
 */
export function importMidiFile(buffer: ArrayBuffer, fileName: string): Arrangement {
  const midi = new Midi(buffer)
  const ppq = midi.header.ppq || 480
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120)
  const tsRaw = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4]
  const timeSignature: [number, number] = [tsRaw[0] ?? 4, [2, 4, 8, 16].includes(tsRaw[1]) ? tsRaw[1] : 4]
  const limitations: string[] = []
  if (midi.header.tempos.length > 1) limitations.push(`El archivo tiene ${midi.header.tempos.length} cambios de tempo; se usa un tempo constante de ${bpm} BPM.`)

  const tracks = midi.tracks.filter((t) => t.notes.length && t.channel !== 9)
  if (!tracks.length) throw new Error('El archivo MIDI no contiene notas melódicas.')
  const avg = (t: (typeof tracks)[number]) => t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length
  const ordered = [...tracks].sort((a, b) => avg(b) - avg(a))
  const notes: SongNote[] = []
  const pushNote = (n: { ticks: number; durationTicks: number; midi: number; velocity: number }, hand: 'L' | 'R') =>
    notes.push({
      midi: n.midi,
      start: Math.round((n.ticks / ppq) * 1000) / 1000,
      duration: Math.max(0.05, Math.round((n.durationTicks / ppq) * 1000) / 1000),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity * 127))),
      hand,
    })
  if (ordered.length >= 2) {
    ordered[0].notes.forEach((n) => pushNote(n, 'R'))
    ordered.slice(1).forEach((t) => t.notes.forEach((n) => pushNote(n, 'L')))
    if (ordered.length > 2) limitations.push(`${ordered.length - 1} pistas se han combinado en la mano izquierda; revisa si es tocable.`)
  } else {
    ordered[0].notes.forEach((n) => pushNote(n, n.midi >= 60 ? 'R' : 'L'))
    limitations.push('Una sola pista: las manos se han separado en Do central (C4). Puede no coincidir con la digitación original.')
  }
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi)

  const bar = timeSignature[0] * (4 / timeSignature[1])
  const end = Math.max(...notes.map((n) => n.start + n.duration))
  const bars = Math.ceil(end / bar)
  const sections: Section[] = []
  const per = 8
  for (let b = 0; b < bars; b += per) sections.push({ id: `s${b / per + 1}`, name: `Compases ${b + 1}–${Math.min(bars, b + per)}`, start: b * bar, end: Math.min(bars, b + per) * bar })

  // Detección de acordes por compás (informativa) a partir de todas las notas del compás
  const chords: ChordEvent[] = []
  for (let b = 0; b < bars; b++) {
    const inBar = notes.filter((n) => n.start >= b * bar && n.start < (b + 1) * bar)
    const det = detectChord(inBar.map((n) => n.midi))
    if (det && det.exact) chords.push({ start: b * bar, duration: bar, symbol: det.symbol })
  }

  const title = midi.name?.trim() || fileName.replace(/\.(mid|midi)$/i, '')
  const base: Arrangement = {
    id: `import-${Date.now()}`,
    title,
    bpm: Math.min(300, Math.max(20, bpm)),
    timeSignature,
    difficulty: 'advanced',
    arrangementType: 'user-import',
    confidence: 1,
    sources: [{ title: `Archivo MIDI aportado por el usuario: ${fileName}`, kind: 'user-file', usedFor: 'Todas las notas, tempo y compás' }],
    limitations: [...limitations, chords.length ? 'Los acordes se detectaron automáticamente por compás y son orientativos.' : 'No se detectaron acordes.'],
    adaptations: [],
    sections,
    chords,
    notes,
    createdAt: Date.now(),
  }
  return fitToRange(base).arrangement
}
