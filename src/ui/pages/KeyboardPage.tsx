import { CheckCircle2, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { audioEngine, TIMBRES } from '../../core/audio/AudioEngine'
import { midiToName, pitchClass } from '../../core/music/notes'
import { buildChord, buildScale, CHORD_TYPES, chordSymbol, detectChord, INTERVALS, intervalName, inversionName, SCALE_TYPES, CHORD_TYPE_BY_ID, SCALE_BY_ID } from '../../core/music/theory'
import { useHeldNotes } from '../../lib/hooks'
import { noteNameOpts, useSettings } from '../../state/settings'
import { PageHeader } from '../layout/Shell'
import { PianoKeyboard, type KeyMark } from '../components/PianoKeyboard'

type Tab = 'free' | 'chords' | 'scales' | 'intervals'
const PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export function KeyboardPage() {
  const settings = useSettings()
  const opts = noteNameOpts(settings)
  const held = useHeldNotes()
  const [tab, setTab] = useState<Tab>('free')
  const [root, setRoot] = useState(0)
  const [chordType, setChordType] = useState('maj')
  const [inversion, setInversion] = useState(0)
  const [scaleId, setScaleId] = useState('major')
  const [interval, setIntervalSemis] = useState(7)

  const heldNotes = [...held.keys()].sort((a, b) => a - b)
  const detected = detectChord(heldNotes)
  const marks = new Map<number, KeyMark>()
  let target: number[] = []
  let targetPcs: number[] = []
  if (tab === 'chords') {
    const t = CHORD_TYPE_BY_ID[chordType]
    target = buildChord(60 + root, chordType, Math.min(inversion, t.intervals.length - 1))
    targetPcs = [...new Set(target.map(pitchClass))]
    target.forEach((m) => marks.set(m, pitchClass(m) === root ? 'root' : 'chord'))
  } else if (tab === 'scales') {
    target = buildScale(60 + root, scaleId, 1)
    targetPcs = [...new Set(target.map(pitchClass))]
    target.forEach((m) => marks.set(m, pitchClass(m) === root ? 'root' : 'scale'))
  } else if (tab === 'intervals') {
    target = [60 + root, 60 + root + interval]
    marks.set(target[0], 'root')
    marks.set(target[1], 'chord')
  }
  const heldPcs = new Set(heldNotes.map(pitchClass))
  const missing = targetPcs.filter((pc) => !heldPcs.has(pc))
  const extra = [...heldPcs].filter((pc) => targetPcs.length && !targetPcs.includes(pc))
  const chordOk = tab === 'chords' && heldNotes.length >= targetPcs.length && missing.length === 0 && extra.length === 0

  const rootSel = (
    <div className="flex flex-wrap gap-1">
      {PCS.map((pc) => (
        <button key={pc} className="btn btn-sm min-w-11" style={root === pc ? { borderColor: 'var(--accent-2)', color: 'var(--accent-2)' } : undefined} onClick={() => setRoot(pc)}>
          {midiToName(60 + pc, { ...opts, withOctave: false })}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Teclado"
        subtitle="Explora libremente: toca en tu Casio o con el ratón (también con el teclado del ordenador: A W S E D F T G Y H U J K; Z/X cambian de octava). Sin puntuación."
        actions={
          <select className="select" value={settings.timbre} onChange={(e) => settings.set({ timbre: e.target.value as typeof settings.timbre })} aria-label="Timbre">
            {TIMBRES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.kind})
              </option>
            ))}
          </select>
        }
      />
      <div className="card overflow-hidden">
        <div className="grid min-h-[132px] gap-4 border-b border-border p-5 md:grid-cols-3">
          <div>
            <div className="label">Notas tocadas</div>
            <div className="mt-1 text-2xl font-extrabold">{heldNotes.length ? heldNotes.map((n) => midiToName(n, opts)).join(' · ') : '—'}</div>
            <div className="mt-1 text-xs text-muted">{heldNotes.length ? `MIDI ${heldNotes.join(', ')}` : 'Toca una tecla'}</div>
          </div>
          <div>
            <div className="label">Acorde detectado</div>
            <div className="mt-1 text-4xl font-black" style={{ color: 'var(--accent)' }}>
              {detected?.symbol ?? '—'}
            </div>
            {detected && (
              <div className="text-xs text-muted">
                {CHORD_TYPE_BY_ID[detected.typeId].name} · {inversionName(detected.inversion)}
                {!detected.exact && ' (sin quinta)'}
              </div>
            )}
          </div>
          <div>
            <div className="label">Intervalo</div>
            <div className="mt-1 text-xl font-bold">{heldNotes.length === 2 ? intervalName(heldNotes[1] - heldNotes[0]) : '—'}</div>
            {heldNotes.length === 2 && <div className="text-xs text-muted">{heldNotes[1] - heldNotes[0]} semitonos</div>}
          </div>
        </div>
        <div className="bg-surface-2 p-2">
          <PianoKeyboard height={190} held={held} marks={marks} />
        </div>
      </div>

      <div className="seg">
        {(
          [
            ['free', 'Libre'],
            ['chords', 'Acordes'],
            ['scales', 'Escalas'],
            ['intervals', 'Intervalos'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'chords' && (
        <div className="card space-y-4 p-5">
          {rootSel}
          <div className="flex flex-wrap gap-1.5">
            {CHORD_TYPES.map((c) => (
              <button key={c.id} className="btn btn-sm" style={chordType === c.id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined} onClick={() => (setChordType(c.id), setInversion(0))} title={c.name}>
                {chordSymbol(root, c.id)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="seg">
              {CHORD_TYPE_BY_ID[chordType].intervals.map((_, i) => (
                <button key={i} aria-pressed={inversion === i} onClick={() => setInversion(i)}>
                  {i === 0 ? 'Fundamental' : `${i}.ª inv.`}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => void audioEngine.demo(target, { durationMs: 1500 })}>
              <Volume2 size={14} /> Acorde
            </button>
            <button className="btn btn-sm" onClick={() => void audioEngine.demo(target, { arpeggio: true, gapMs: 220 })}>
              <Volume2 size={14} /> Arpegio
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-3xl font-black">{chordSymbol(root, chordType)}</div>
              <div className="text-sm text-muted">
                {CHORD_TYPE_BY_ID[chordType].name} · {target.map((m) => midiToName(m, opts)).join(' – ')}
              </div>
              <div className="text-xs text-faint">Intervalos: {CHORD_TYPE_BY_ID[chordType].intervals.map((i) => INTERVALS[i % 12]?.short + (i >= 12 ? '+8' : '')).join(' · ')}</div>
            </div>
            <div className="card-flat ml-auto min-w-64 px-4 py-3 text-sm">
              <div className="label mb-1">Compruébalo en tu Casio</div>
              {chordOk ? (
                <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--ok)' }}>
                  <CheckCircle2 size={18} /> ¡Correcto! {detected && detected.inversion !== Math.min(inversion, 99) && `(en ${inversionName(detected.inversion).toLowerCase()})`}
                </div>
              ) : heldNotes.length ? (
                <div className="space-y-0.5">
                  {missing.length > 0 && <div style={{ color: 'var(--miss)' }}>Faltan: {missing.map((pc) => midiToName(60 + pc, { ...opts, withOctave: false })).join(', ')}</div>}
                  {extra.length > 0 && <div style={{ color: 'var(--bad)' }}>Sobran: {extra.map((pc) => midiToName(60 + pc, { ...opts, withOctave: false })).join(', ')}</div>}
                </div>
              ) : (
                <div className="text-muted">Toca el acorde con todas sus notas a la vez.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'scales' && (
        <div className="card space-y-4 p-5">
          {rootSel}
          <div className="flex flex-wrap gap-1.5">
            {SCALE_TYPES.map((s) => (
              <button key={s.id} className="btn btn-sm" style={scaleId === s.id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined} onClick={() => setScaleId(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary btn-sm" onClick={() => void audioEngine.demo(target, { arpeggio: true, gapMs: 260 })}>
              <Volume2 size={14} /> Subir
            </button>
            <button className="btn btn-sm" onClick={() => void audioEngine.demo([...target].reverse(), { arpeggio: true, gapMs: 260 })}>
              <Volume2 size={14} /> Bajar
            </button>
          </div>
          <div>
            <div className="text-2xl font-black">
              {midiToName(60 + root, { ...opts, withOctave: false })} {SCALE_BY_ID[scaleId].name}
            </div>
            <div className="text-sm text-muted">{target.map((m) => midiToName(m, { ...opts, withOctave: false })).join(' – ')}</div>
            <div className="mt-1 font-mono text-xs text-faint">
              Pasos: {target.slice(1).map((m, i) => (m - target[i] === 1 ? 'S' : m - target[i] === 2 ? 'T' : `${m - target[i]}s`)).join(' – ')}
            </div>
            <p className="mt-2 max-w-2xl text-sm">{SCALE_BY_ID[scaleId].description}</p>
            {heldNotes.length > 0 && (
              <p className="mt-2 text-sm">
                {heldNotes.every((m) => targetPcs.includes(pitchClass(m))) ? <span style={{ color: 'var(--ok)' }}>Tus notas pertenecen a la escala.</span> : <span style={{ color: 'var(--bad)' }}>Hay notas fuera de la escala.</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'intervals' && (
        <div className="card space-y-4 p-5">
          {rootSel}
          <div className="flex flex-wrap gap-1.5">
            {INTERVALS.slice(1).map((i) => (
              <button key={i.semitones} className="btn btn-sm" style={interval === i.semitones ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined} onClick={() => setIntervalSemis(i.semitones)}>
                {i.short}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-2xl font-black">{intervalName(interval)}</div>
            <span className="text-muted">
              {midiToName(target[0], opts)} → {midiToName(target[1], opts)} · {interval} semitonos
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => void audioEngine.demo(target, { arpeggio: true, gapMs: 500 })}>
              <Volume2 size={14} /> Melódico
            </button>
            <button className="btn btn-sm" onClick={() => void audioEngine.demo(target, { durationMs: 1400 })}>
              <Volume2 size={14} /> Armónico
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
