import { Music, Volume2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { audioEngine } from '../../../core/audio/AudioEngine'
import { inversionLabel, LAYOUT_INFO, PROGRESSIONS, progressionArrangement, voiceProgression, type HandLayout, type VoicedChord } from '../../../core/chords/progressions'
import { midiToName } from '../../../core/music/notes'
import { chordSymbol } from '../../../core/music/theory'
import { noteNameOpts, useSettings } from '../../../state/settings'
import { PracticePlayer } from '../../components/PracticePlayer'

const TONICS = [0, 7, 2, 9, 4, 5, 10, 3]
const HANDS_FOR: Record<HandLayout, 'both' | 'L' | 'R'> = { 'bass-rh': 'both', 'lh-chords': 'L', 'rh-chords': 'R' }
const allNotes = (v: VoicedChord) => (v.bass !== undefined ? [v.bass, ...v.notes] : v.notes)

export function ProgressionsTab() {
  const settings = useSettings()
  const [id, setId] = useState(PROGRESSIONS[0].id)
  const prog = PROGRESSIONS.find((p) => p.id === id)!
  const [tonic, setTonic] = useState(prog.defaultTonic)
  const [layout, setLayout] = useState<HandLayout>('bass-rh')
  const voiced = useMemo(() => voiceProgression(prog, tonic, layout), [prog, tonic, layout])
  const arrangement = useMemo(() => progressionArrangement(prog, tonic, layout), [prog, tonic, layout])
  const name = (m: number) => midiToName(m, { ...noteNameOpts(settings), withOctave: false })

  const listen = async () => {
    for (const v of voiced) {
      void audioEngine.demo(allNotes(v), { durationMs: 900 })
      await new Promise((r) => setTimeout(r, (60000 / prog.bpm) * Math.min(prog.beatsEach, 2)))
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PROGRESSIONS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setId(p.id)
              setTonic(p.defaultTonic)
            }}
            aria-pressed={p.id === id}
            className="card p-3 text-left transition-transform hover:-translate-y-0.5"
            style={p.id === id ? { borderColor: 'var(--accent)' } : undefined}
          >
            <div className="text-xs font-semibold" style={{ color: 'var(--accent-2)' }}>
              {p.style}
            </div>
            <div className="font-bold leading-snug">{p.name}</div>
          </button>
        ))}
      </div>

      <div className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-extrabold">{prog.name}</h2>
          <span className="chip">{prog.style}</span>
          <label className="ml-auto flex items-center gap-2 text-sm">
            Tonalidad
            <select className="select" value={tonic} onChange={(e) => setTonic(Number(e.target.value))}>
              {[...new Set([prog.defaultTonic, ...TONICS])].map((t) => (
                <option key={t} value={t}>
                  {chordSymbol(t, prog.mode === 'minor' ? 'min' : 'maj')}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-sm" onClick={() => void listen()}>
            <Volume2 size={14} /> Escuchar
          </button>
        </div>
        <p className="text-sm text-muted">{prog.description}</p>
        {prog.examples && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Music size={12} /> Patrón presente, por ejemplo, en: {prog.examples.join(' · ')}. La tonalidad original puede ser otra.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
          <span className="label">Reparto de manos</span>
          <div className="seg" role="group" aria-label="Reparto de manos">
            {(Object.keys(LAYOUT_INFO) as HandLayout[]).map((l) => (
              <button key={l} aria-pressed={layout === l} onClick={() => setLayout(l)}>
                {LAYOUT_INFO[l].label}
              </button>
            ))}
          </div>
          <span className="min-w-0 flex-1 text-xs text-muted">{LAYOUT_INFO[layout].description}</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(voiced.length, 4)}, minmax(0, 1fr))` }}>
          {voiced.map((v, i) => (
            <button key={i} className="card-flat p-3 text-left hover:border-accent" onClick={() => void audioEngine.demo(allNotes(v), { durationMs: 1200 })} title="Escuchar este acorde">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-faint">{v.roman}</span>
                <span className="text-xl font-black">{v.symbol}</span>
              </div>
              <div className="mt-1 text-xs font-semibold" style={{ color: v.chordHand === 'L' ? 'var(--lh)' : 'var(--rh)' }}>
                {v.chordHand === 'L' ? 'Izquierda' : 'Derecha'}: {inversionLabel(v).toLowerCase()}
              </div>
              <div className="text-xs text-muted">
                {v.notes.map(name).join(' – ')}
                {v.bass !== undefined && ` · bajo ${name(v.bass)}`}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-faint">
          La mano de los acordes usa en cada cambio la inversión que menos movimiento exige. «/» indica una nota distinta en el bajo (G/B = Sol mayor con Si en el bajo; V/7 = grado V con el 7.º grado en el bajo); si no hay mano de bajo, esa nota va abajo en el propio acorde.
        </p>
      </div>

      <PracticePlayer
        key={`${prog.id}-${tonic}-${layout}`}
        arrangement={arrangement}
        refId={arrangement.id}
        kind="exercise"
        title={arrangement.title}
        skills={['progressions', 'inversions', 'voice-leading', 'chord-changes', ...(layout === 'bass-rh' ? (['two-hands'] as const) : layout === 'lh-chords' ? (['left-hand'] as const) : [])]}
        defaultMode="wait"
        modes={['wait', 'timed', 'listen']}
        defaultHands={HANDS_FOR[layout]}
      />
    </div>
  )
}
