import { nameToMidi } from '../music/notes'
import { CHORD_TYPE_BY_ID, nearestVoicing, parseChordSymbol } from '../music/theory'
import type { ChordEvent, SongNote } from './schema'

/**
 * Notación compacta de texto para escribir melodías en el código:
 *   "E4 E4 F4:0.5 G4:2 r:1 | C4"   → nota[:duración en negras]; r = silencio; | = barra (ignorada)
 *   Acordes simultáneos: "C4+E4+G4:2"
 */
export function seq(text: string, hand: 'L' | 'R', opts: { start?: number; defaultDur?: number; velocity?: number } = {}): SongNote[] {
  const { start = 0, defaultDur = 1, velocity = 80 } = opts
  let t = start
  const out: SongNote[] = []
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    if (tok === '|') continue
    const [pitchPart, durPart] = tok.split(':')
    const dur = durPart ? Number(durPart) : defaultDur
    if (!Number.isFinite(dur) || dur <= 0) throw new Error(`Duración inválida en "${tok}"`)
    if (pitchPart.toLowerCase() !== 'r') {
      for (const p of pitchPart.split('+')) out.push({ midi: nameToMidi(p), start: round(t), duration: dur, velocity, hand })
    }
    t += dur
  }
  return out
}

/** "C:4 G:2 Am:2" → eventos de acorde consecutivos. */
export function chordSeq(text: string, start = 0): ChordEvent[] {
  let t = start
  const out: ChordEvent[] = []
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    if (tok === '|') continue
    const [sym, d] = tok.split(':')
    const dur = d ? Number(d) : 4
    if (sym.toLowerCase() !== 'r') {
      if (!parseChordSymbol(sym)) throw new Error(`Acorde inválido "${sym}"`)
      out.push({ symbol: sym, start: round(t), duration: dur })
    }
    t += dur
  }
  return out
}

export type LeftHandStyle = 'block' | 'root' | 'root-fifth' | 'broken' | 'alberti' | 'bass-chord'

/**
 * Genera la mano izquierda a partir de los acordes, con conducción de voces cercana
 * (cada acorde usa la inversión más próxima a la anterior) alrededor de C3.
 */
export function leftHandFromChords(chords: ChordEvent[], style: LeftHandStyle = 'block', velocity = 66): SongNote[] {
  const out: SongNote[] = []
  let prev: number[] = []
  for (const c of chords) {
    const p = parseChordSymbol(c.symbol)!
    const triadType = CHORD_TYPE_BY_ID[p.typeId].intervals.length > 4 ? '7' : p.typeId
    const voicing = nearestVoicing(prev, p.rootPc, triadType, 52).filter((n) => n >= 43 && n <= 64)
    const v = voicing.length ? voicing : nearestVoicing([], p.rootPc, triadType, 52)
    prev = v
    const bassPc = p.bassPc ?? p.rootPc
    const bass = 36 + bassPc + (bassPc < 4 ? 12 : 0) // E2…D#3
    const add = (midi: number, start: number, duration: number) => out.push({ midi, start: round(start), duration, velocity, hand: 'L' })
    switch (style) {
      case 'block':
        v.forEach((n) => add(n, c.start, c.duration))
        break
      case 'root':
        add(bass, c.start, c.duration)
        break
      case 'root-fifth':
        add(bass, c.start, c.duration)
        add(bass + 7, c.start, c.duration)
        break
      case 'broken': {
        const step = c.duration / Math.max(1, Math.round(c.duration))
        for (let i = 0; i < Math.round(c.duration); i++) add(v[i % v.length], c.start + i * step, step)
        break
      }
      case 'alberti': {
        const pattern = [v[0], v[2] ?? v[1], v[1], v[2] ?? v[1]]
        const n = Math.round(c.duration * 2)
        for (let i = 0; i < n; i++) add(pattern[i % 4], c.start + i * 0.5, 0.5)
        break
      }
      case 'bass-chord': {
        add(bass, c.start, Math.min(1, c.duration))
        for (let b = 1; b < c.duration; b++) v.forEach((x) => add(x, c.start + b, 1))
        break
      }
    }
  }
  return out
}

function round(x: number) {
  return Math.round(x * 1000) / 1000
}
