import type { InputSource, MusicEvent, NoteOffEvent, NoteOnEvent } from './types'

type Listener = (e: MusicEvent) => void

/**
 * Bus central de eventos de interpretación.
 * Todas las fuentes (Casio por MIDI, ratón, teclado del ordenador, simulador)
 * publican aquí; el teclado virtual, el motor de evaluación y el diagnóstico
 * se suscriben. Los listeners se invocan de forma síncrona para minimizar latencia.
 */
class InputBus {
  private listeners = new Set<Listener>()
  /** nota → evento noteon activo */
  private held = new Map<number, NoteOnEvent>()
  sustain = false

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit(e: MusicEvent): void {
    if (e.type === 'noteon') {
      // Si llega un noteon repetido sin noteoff (algunos dispositivos), cerramos el anterior.
      if (this.held.has(e.note)) this.dispatch({ type: 'noteoff', note: e.note, velocity: 0, channel: e.channel, time: e.time, source: e.source, device: e.device })
      this.held.set(e.note, e)
    } else if (e.type === 'noteoff') {
      if (!this.held.has(e.note)) return // noteoff huérfano: se ignora
      this.held.delete(e.note)
    } else if (e.type === 'cc' && e.controller === 64) {
      this.sustain = e.value >= 64
    }
    this.dispatch(e)
  }

  private dispatch(e: MusicEvent) {
    for (const l of this.listeners) {
      try {
        l(e)
      } catch (err) {
        console.error('[InputBus] listener error', err)
      }
    }
  }

  heldNotes(): number[] {
    return [...this.held.keys()].sort((a, b) => a - b)
  }

  heldEvents(): NoteOnEvent[] {
    return [...this.held.values()]
  }

  /** Libera todas las notas (por ejemplo al desconectar el dispositivo). */
  releaseAll(source?: InputSource, time = performance.now()) {
    for (const [note, on] of [...this.held]) {
      if (source && on.source !== source) continue
      const off: NoteOffEvent = { type: 'noteoff', note, velocity: 0, channel: on.channel, time, source: on.source, device: on.device }
      this.emit(off)
    }
  }
}

export const inputBus = new InputBus()

/** Ayudante para fuentes no-MIDI (ratón, teclado del ordenador, simulador). */
export function emitNote(source: InputSource, type: 'noteon' | 'noteoff', note: number, velocity = 90, time = performance.now()) {
  if (type === 'noteon') inputBus.emit({ type, note, velocity, channel: 1, time, source })
  else inputBus.emit({ type, note, velocity: 0, channel: 1, time, source })
}
