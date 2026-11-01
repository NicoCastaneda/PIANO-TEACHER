import { Ear, Piano, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { DRILL_INFO, DRILLS, earKey, readyForNext, recentAccuracy, suggestedLevel, type EarDrill } from '../../../core/ear/ear'
import { navigate } from '../../../lib/router'
import { useEarTrainer } from '../../../state/earTrainer'
import { PageHeader } from '../../layout/Shell'
import { PlayChordDrill, PlayMelodyDrill, RecognizeDrill, type EarAnswer } from './EarDrills'

export function EarDrillView({ drill, level, onAnswer }: { drill: EarDrill; level: number; onAnswer?: (a: EarAnswer) => void }) {
  const k = `${drill}-${level}`
  if (drill === 'play-chord') return <PlayChordDrill key={k} level={level} onAnswer={onAnswer} />
  if (drill === 'play-melody') return <PlayMelodyDrill key={k} level={level} onAnswer={onAnswer} />
  return <RecognizeDrill key={k} drill={drill} level={level} onAnswer={onAnswer} />
}

export function EarTrainingPage({ drill: initial }: { drill?: string | null }) {
  const stats = useEarTrainer((s) => s.stats)
  // la URL (?ej=) manda: al cambiar de ejercicio la página se vuelve a montar
  const drill: EarDrill = DRILLS.includes(initial as EarDrill) ? (initial as EarDrill) : 'play-melody'
  // el nivel se fija al elegir el ejercicio (no cambia solo a mitad de sesión)
  const [levels, setLevels] = useState<Record<string, number>>(() => ({ [drill]: suggestedLevel(stats, drill) }))
  const level = levels[drill] ?? 1
  const info = DRILL_INFO[drill]
  const st = stats[earKey(drill, level)]
  const acc = recentAccuracy(st)
  const canUp = readyForNext(st) && level < info.levels.length

  const select = (d: EarDrill) => {
    navigate(`/practice/oido?ej=${d}`)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Oído" subtitle="Aprende a reconocer lo que suena y a sacarlo de oído en tu teclado. Las respuestas tocadas se evalúan con MIDI; con eventos simulados no se guardan." />
      <div className="grid gap-4 lg:grid-cols-2">
        {(['recognize', 'play'] as const).map((fam) => (
          <section key={fam} className="space-y-2">
            <div className="label flex items-center gap-1.5">
              {fam === 'recognize' ? <Ear size={13} /> : <Piano size={13} />} {fam === 'recognize' ? 'Reconocer (responde con botones)' : 'Tocar de oído (responde en el teclado)'}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {DRILLS.filter((d) => DRILL_INFO[d].family === fam).map((d) => {
                const a = recentAccuracy(stats[earKey(d, suggestedLevel(stats, d))])
                return (
                  <button
                    key={d}
                    aria-pressed={drill === d}
                    onClick={() => select(d)}
                    className="card p-3 text-left transition-transform hover:-translate-y-0.5"
                    style={drill === d ? { borderColor: 'var(--accent)' } : undefined}
                  >
                    <div className="font-bold leading-snug">{DRILL_INFO[d].title}</div>
                    <div className="text-xs text-muted">{DRILL_INFO[d].description}</div>
                    <div className="mt-1 text-[11px] text-faint">
                      Nivel {suggestedLevel(stats, d)}
                      {a !== null && ` · ${Math.round(a * 100)} % reciente`}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <h2 className="text-lg font-extrabold">{info.title}</h2>
        <div className="seg" role="group" aria-label="Nivel">
          {info.levels.map((l) => (
            <button key={l.level} aria-pressed={level === l.level} onClick={() => setLevels((x) => ({ ...x, [drill]: l.level }))} title={l.description}>
              {l.level}. {l.name}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">{info.levels[level - 1].description}</span>
        <span className="ml-auto text-xs text-muted">
          {st ? (
            <>
              {st.correct}/{st.seen} a la primera · mejor racha {st.best}
              {acc !== null && ` · últimas ${st.recent.length}: ${Math.round(acc * 100)} %`}
            </>
          ) : (
            'Sin respuestas todavía en este nivel'
          )}
        </span>
        {canUp && (
          <button className="btn btn-sm" style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }} onClick={() => setLevels((x) => ({ ...x, [drill]: level + 1 }))}>
            <TrendingUp size={14} /> 8 de tus últimas 10 bien: sube al nivel {level + 1}
          </button>
        )}
      </div>

      <EarDrillView drill={drill} level={level} />
    </div>
  )
}
