import { Dices, Ear, Flame } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { midiToName } from '../../core/music/notes'
import { CHORD_TYPES, COMMON_PROGRESSIONS, SCALE_TYPES } from '../../core/music/theory'
import { arpeggioExercise, chordsExercise, findNotesExercise, progressionExercise, rhythmExercise, scaleExercise, type Skill } from '../../core/practice/exercises'
import type { SessionMode } from '../../core/practice/PracticeSession'
import type { LeftHandStyle } from '../../core/songs/notation'
import { href } from '../../lib/router'
import { noteNameOpts, useSettings } from '../../state/settings'
import { PageHeader } from '../layout/Shell'
import { PracticePlayer } from '../components/PracticePlayer'

type Cat = 'scales' | 'chords' | 'arpeggios' | 'progressions' | 'rhythm' | 'notes'

const CATS: { id: Cat; label: string; desc: string }[] = [
  { id: 'scales', label: 'Escalas', desc: 'Técnica y digitación' },
  { id: 'chords', label: 'Acordes', desc: 'Bloque, arpegio, inversiones' },
  { id: 'arpeggios', label: 'Arpegios', desc: 'Una o dos octavas' },
  { id: 'progressions', label: 'Progresiones', desc: 'Cambios de acorde y acompañamiento' },
  { id: 'rhythm', label: 'Ritmo', desc: 'Pulso, subdivisión, síncopa' },
  { id: 'notes', label: 'Notas', desc: 'Encontrar notas sin tempo' },
]

const RHYTHMS: { id: string; name: string; pattern: number[] }[] = [
  { id: 'quarters', name: 'Negras', pattern: [1, 1, 1, 1, 1, 1, 1, 1] },
  { id: 'halves', name: 'Blancas y negras', pattern: [2, 1, 1, 2, 2, 1, 1, 1, 1] },
  { id: 'eighths', name: 'Corcheas', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5, 2] },
  { id: 'dotted', name: 'Puntillo', pattern: [1.5, 0.5, 1.5, 0.5, 1, 1, 2] },
  { id: 'sync', name: 'Síncopa', pattern: [0.5, 1, 0.5, 1, 1, 0.5, 1, 0.5, 2] },
  { id: 'rests', name: 'Con silencios', pattern: [1, -1, 1, -1, 0.5, 0.5, -1, 1, 1, -1, 2] },
  { id: 'triplets', name: 'Tresillos', pattern: [1 / 3, 1 / 3, 1 / 3, 1, 1 / 3, 1 / 3, 1 / 3, 1, 2] },
  { id: 'sixteenths', name: 'Semicorcheas', pattern: [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 0.25, 0.25, 0.5, 1, 1] },
]

const LH_STYLES: { id: LeftHandStyle | 'none'; name: string }[] = [
  { id: 'root', name: 'Solo bajo' },
  { id: 'root-fifth', name: 'Bajo + quinta' },
  { id: 'block', name: 'Acorde en bloque' },
  { id: 'bass-chord', name: 'Bajo y acorde' },
  { id: 'broken', name: 'Arpegio' },
  { id: 'alberti', name: 'Alberti' },
  { id: 'none', name: 'Sin izquierda' },
]

const PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

function presetCat(preset?: string): Cat {
  if (preset === 'rhythm') return 'rhythm'
  if (preset === 'chord-changes') return 'progressions'
  if (preset === 'wait-mode') return 'notes'
  if (preset && CATS.some((c) => c.id === preset)) return preset as Cat
  return 'scales'
}

export function PracticePage({ preset }: { preset?: string }) {
  const settings = useSettings()
  const opts = noteNameOpts(settings)
  const [cat, setCat] = useState<Cat>(presetCat(preset))
  const [challenge, setChallenge] = useState(false)
  const [root, setRoot] = useState(0)
  const [scaleId, setScaleId] = useState('major')
  const [hand, setHand] = useState<'R' | 'L'>('R')
  const [octaves, setOctaves] = useState(1)
  const [noteBeats, setNoteBeats] = useState(1)
  const [bpm, setBpm] = useState(72)
  const [chordType, setChordType] = useState('maj')
  const [inversions, setInversions] = useState(false)
  const [chordStyle, setChordStyle] = useState<'block' | 'arpeggio' | 'block-then-arpeggio'>('block')
  const [progId, setProgId] = useState(preset === 'chord-changes' ? 'I-V-vi-IV' : 'I-IV-V-I')
  const [lhStyle, setLhStyle] = useState<LeftHandStyle | 'none'>('root')
  const [rhChords, setRhChords] = useState(true)
  const [minor, setMinor] = useState(false)
  const [rhythmId, setRhythmId] = useState('quarters')
  const [noteCount, setNoteCount] = useState(10)
  const [blackKeys, setBlackKeys] = useState(false)
  const [seed, setSeed] = useState(1)

  const { arrangement, skills, mode, title } = useMemo(() => {
    const rootMidi = (hand === 'L' ? 48 : 60) + root
    switch (cat) {
      case 'scales': {
        const a = scaleExercise({ rootMidi: hand === 'L' && octaves === 2 ? rootMidi - 12 : rootMidi, scaleId, hand, octaves, noteBeats, bpm })
        return { arrangement: a, skills: ['scales', 'fingering'] as Skill[], mode: 'timed' as SessionMode, title: a.title }
      }
      case 'chords': {
        const type = CHORD_TYPES.find((c) => c.id === chordType)!
        const n = type.intervals.length
        const specs = inversions ? Array.from({ length: n + 1 }, (_, i) => ({ rootMidi, typeId: chordType, inversion: i % n })) : [{ rootMidi, typeId: chordType }, { rootMidi: rootMidi + 5, typeId: chordType }, { rootMidi: rootMidi + 7, typeId: chordType }, { rootMidi, typeId: chordType }]
        const a = chordsExercise(specs, { hand, style: chordStyle, bpm, beatsEach: 2, title: `Acordes ${type.name}${inversions ? ' con inversiones' : ''}` })
        return { arrangement: a, skills: (inversions ? ['chords', 'inversions'] : ['chords']) as Skill[], mode: 'timed' as SessionMode, title: a.title }
      }
      case 'arpeggios': {
        const a = arpeggioExercise(rootMidi, chordType, hand, octaves, bpm, noteBeats)
        return { arrangement: a, skills: ['arpeggios'] as Skill[], mode: 'timed' as SessionMode, title: a.title }
      }
      case 'progressions': {
        const prog = COMMON_PROGRESSIONS.find((p) => p.id === progId)!
        const a = progressionExercise({ tonicMidi: 60 + root, degrees: prog.degrees, mode: minor ? 'natural-minor' : 'major', lhStyle, rhChords, bpm, repeat: 2, title: `${prog.name} en ${midiToName(60 + root, { ...opts, withOctave: false })}${minor ? ' menor' : ''}` })
        return { arrangement: a, skills: ['progressions', 'chord-changes', ...(lhStyle !== 'none' && rhChords ? (['two-hands'] as Skill[]) : [])] as Skill[], mode: 'timed' as SessionMode, title: a.title }
      }
      case 'rhythm': {
        const r = RHYTHMS.find((x) => x.id === rhythmId)!
        const a = rhythmExercise(r.pattern, { bpm, repeat: 2, title: `Ritmo: ${r.name}` })
        return { arrangement: a, skills: ['rhythm', ...(rhythmId === 'sync' ? (['syncopation'] as Skill[]) : [])] as Skill[], mode: 'timed' as SessionMode, title: a.title }
      }
      case 'notes': {
        // generador pseudoaleatorio determinista por semilla
        let s = seed * 9301 + 49297
        const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
        const pool: number[] = []
        for (let m = 48; m <= 84; m++) if (blackKeys || ![1, 3, 6, 8, 10].includes(m % 12)) pool.push(m)
        const notes = Array.from({ length: noteCount }, () => pool[Math.floor(rnd() * pool.length)])
        const a = findNotesExercise(notes, 'Encuentra las notas')
        return { arrangement: { ...a, id: `${a.id}-${seed}` }, skills: ['note-names', ...(blackKeys ? (['black-keys'] as Skill[]) : [])] as Skill[], mode: 'wait' as SessionMode, title: `Encuentra ${noteCount} notas${blackKeys ? ' (con negras)' : ''}` }
      }
    }
  }, [cat, root, scaleId, hand, octaves, noteBeats, bpm, chordType, inversions, chordStyle, progId, lhStyle, rhChords, minor, rhythmId, noteCount, blackKeys, seed, opts])

  const rootSelect = (
    <Field label="Tónica">
      <select className="select" value={root} onChange={(e) => setRoot(Number(e.target.value))}>
        {PCS.map((pc) => (
          <option key={pc} value={pc}>
            {midiToName(60 + pc, { ...opts, withOctave: false })}
          </option>
        ))}
      </select>
    </Field>
  )
  const handSeg = (
    <Field label="Mano">
      <div className="seg">
        <button aria-pressed={hand === 'R'} onClick={() => setHand('R')}>
          Derecha
        </button>
        <button aria-pressed={hand === 'L'} onClick={() => setHand('L')}>
          Izquierda
        </button>
      </div>
    </Field>
  )
  const bpmField = (
    <Field label={`Tempo: ${bpm} BPM`}>
      <input type="range" min={40} max={160} step={2} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
    </Field>
  )

  return (
    <div>
      <PageHeader
        title="Practicar"
        subtitle="Ejercicios configurables de técnica, ritmo, notas, acordes y patrones. Ajusta el tempo y practica progresivamente."
        actions={
          <>
            <a className="btn" href={href('/practice/oido')}>
              <Ear size={16} /> Oído
            </a>
            <button className="btn" onClick={() => setChallenge(!challenge)} style={challenge ? { borderColor: 'var(--bad)', color: 'var(--bad)' } : undefined} title="Tolerancia avanzada y sin ayudas visuales">
              <Flame size={16} /> Modo desafío {challenge ? 'activado' : ''}
            </button>
          </>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className="card-flat min-w-[150px] px-4 py-3 text-left transition-colors" style={cat === c.id ? { borderColor: 'var(--accent)', background: 'color-mix(in oklab, var(--accent) 12%, var(--surface-2))' } : undefined}>
            <div className="font-bold">{c.label}</div>
            <div className="text-xs text-muted">{c.desc}</div>
          </button>
        ))}
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
        {cat === 'scales' && (
          <>
            {rootSelect}
            <Field label="Escala">
              <select className="select" value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
                {SCALE_TYPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            {handSeg}
            <Field label="Octavas">
              <div className="seg">
                {[1, 2].map((o) => (
                  <button key={o} aria-pressed={octaves === o} onClick={() => setOctaves(o)}>
                    {o}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Figura">
              <div className="seg">
                <button aria-pressed={noteBeats === 1} onClick={() => setNoteBeats(1)}>
                  Negras
                </button>
                <button aria-pressed={noteBeats === 0.5} onClick={() => setNoteBeats(0.5)}>
                  Corcheas
                </button>
              </div>
            </Field>
            {bpmField}
          </>
        )}
        {(cat === 'chords' || cat === 'arpeggios') && (
          <>
            {rootSelect}
            <Field label="Tipo de acorde">
              <select className="select" value={chordType} onChange={(e) => setChordType(e.target.value)}>
                {CHORD_TYPES.filter((c) => (cat === 'arpeggios' ? c.intervals.every((i) => i < 12) : true)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({midiToName(60 + root, { ...opts, withOctave: false })}
                    {c.suffix})
                  </option>
                ))}
              </select>
            </Field>
            {handSeg}
            {cat === 'chords' ? (
              <>
                <Field label="Ejercicio">
                  <div className="seg">
                    <button aria-pressed={!inversions} onClick={() => setInversions(false)}>
                      I–IV–V–I
                    </button>
                    <button aria-pressed={inversions} onClick={() => setInversions(true)}>
                      Inversiones
                    </button>
                  </div>
                </Field>
                <Field label="Estilo">
                  <div className="seg">
                    {(
                      [
                        ['block', 'Bloque'],
                        ['arpeggio', 'Arpegio'],
                        ['block-then-arpeggio', 'Ambos'],
                      ] as const
                    ).map(([k, l]) => (
                      <button key={k} aria-pressed={chordStyle === k} onClick={() => setChordStyle(k)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field label="Octavas">
                  <div className="seg">
                    {[1, 2].map((o) => (
                      <button key={o} aria-pressed={octaves === o} onClick={() => setOctaves(o)}>
                        {o}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Figura">
                  <div className="seg">
                    <button aria-pressed={noteBeats === 1} onClick={() => setNoteBeats(1)}>
                      Negras
                    </button>
                    <button aria-pressed={noteBeats === 0.5} onClick={() => setNoteBeats(0.5)}>
                      Corcheas
                    </button>
                  </div>
                </Field>
              </>
            )}
            {bpmField}
          </>
        )}
        {cat === 'progressions' && (
          <>
            {rootSelect}
            <Field label="Modo">
              <div className="seg">
                <button aria-pressed={!minor} onClick={() => setMinor(false)}>
                  Mayor
                </button>
                <button aria-pressed={minor} onClick={() => setMinor(true)}>
                  Menor
                </button>
              </div>
            </Field>
            <Field label="Progresión">
              <select className="select" value={progId} onChange={(e) => setProgId(e.target.value)}>
                {COMMON_PROGRESSIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mano izquierda">
              <select className="select" value={lhStyle} onChange={(e) => setLhStyle(e.target.value as LeftHandStyle | 'none')}>
                {LH_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Derecha">
              <div className="seg">
                <button aria-pressed={rhChords} onClick={() => setRhChords(true)}>
                  Acordes
                </button>
                <button aria-pressed={!rhChords} onClick={() => setRhChords(false)}>
                  Nada
                </button>
              </div>
            </Field>
            {bpmField}
          </>
        )}
        {cat === 'rhythm' && (
          <>
            <Field label="Patrón">
              <div className="flex flex-wrap gap-1.5">
                {RHYTHMS.map((r) => (
                  <button key={r.id} className="btn btn-sm" style={rhythmId === r.id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined} onClick={() => setRhythmId(r.id)}>
                    {r.name}
                  </button>
                ))}
              </div>
            </Field>
            {bpmField}
          </>
        )}
        {cat === 'notes' && (
          <>
            <Field label={`Cantidad: ${noteCount}`}>
              <input type="range" min={5} max={30} value={noteCount} onChange={(e) => setNoteCount(Number(e.target.value))} />
            </Field>
            <Field label="Teclas">
              <div className="seg">
                <button aria-pressed={!blackKeys} onClick={() => setBlackKeys(false)}>
                  Solo blancas
                </button>
                <button aria-pressed={blackKeys} onClick={() => setBlackKeys(true)}>
                  Blancas y negras
                </button>
              </div>
            </Field>
            <button className="btn" onClick={() => setSeed((s) => s + 1)}>
              <Dices size={16} /> Nuevas notas
            </button>
          </>
        )}
      </div>

      <PracticePlayer
        key={`${arrangement.id}-${challenge}`}
        arrangement={arrangement}
        refId={`practice:${cat}:${arrangement.id}`}
        kind={challenge ? 'challenge' : 'exercise'}
        title={title}
        skills={skills}
        defaultMode={challenge ? 'timed' : mode}
        challenge={challenge}
      />
    </div>
  )
}
