import { ArrowLeft, BookOpen, GraduationCap, Layers, ListMusic } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HAND_LABEL, recommendedGroup, type ChordCard, type HandMode } from '../../../core/chords/trainer'
import { href, navigate } from '../../../lib/router'
import { useChordTrainer } from '../../../state/chordTrainer'
import { PageHeader } from '../../layout/Shell'
import { GroupList } from './common'
import { ExamTab } from './ExamTab'
import { ProgressionsTab } from './ProgressionsTab'
import { StudyTab } from './StudyTab'
import { TipsTab } from './TipsTab'

const TABS = [
  { id: 'tarjetas', label: 'Tarjetas', icon: Layers },
  { id: 'examen', label: 'Examen', icon: GraduationCap },
  { id: 'progresiones', label: 'Progresiones', icon: ListMusic },
  { id: 'consejos', label: 'Consejos', icon: BookOpen },
] as const

type TabId = (typeof TABS)[number]['id']

const HAND_HELP: Record<HandMode, string> = {
  L: 'Acorde completo con la izquierda, por debajo del Do central: lo típico mientras la derecha toca la melodía.',
  R: 'Acorde completo con la derecha, alrededor del Do central: lo típico cuando la izquierda toca el bajo.',
  both: 'La izquierda toca solo el bajo (la nota que pide la inversión) y la derecha el acorde completo: así se acompaña en pop y baladas.',
}

export function ChordTrainerPage({ tab }: { tab: string | null }) {
  const { stats, loaded, load, hand, setHand } = useChordTrainer()
  const current: TabId = TABS.find((t) => t.id === tab)?.id ?? 'tarjetas'
  const [groupId, setGroupId] = useState<string | null>(null)
  const [review, setReview] = useState<ChordCard[] | null>(null)
  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])
  const rec = recommendedGroup(stats)
  // el grupo recomendado se fija al entrar, para no cambiar de grupo en mitad de una sesión
  useEffect(() => {
    if (loaded && groupId === null) setGroupId(recommendedGroup(useChordTrainer.getState().stats).id)
  }, [loaded, groupId])
  const selected = groupId ?? rec.id

  return (
    <div className="space-y-5">
      <a href={href('/learn')} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} /> Aprender
      </a>
      <PageHeader
        title="Entrenador de acordes"
        subtitle="Tarjetas de memoria por grupos pequeños, inversiones, examen y progresiones reales. Toca en tu Casio: vale cualquier octava, pero las notas y el bajo deben ser los correctos."
        actions={
          <div className="seg" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} aria-pressed={current === id} onClick={() => navigate(`/learn/acordes?tab=${id}`)}>
                <Icon size={14} className="mr-1 inline" /> {label}
              </button>
            ))}
          </div>
        }
      />
      {loaded && (current === 'tarjetas' || current === 'examen') && (
        <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="label">Mano</span>
          <div className="seg" role="group" aria-label="Mano">
            {(['L', 'R', 'both'] as HandMode[]).map((h) => (
              <button key={h} aria-pressed={hand === h} onClick={() => setHand(h)}>
                {HAND_LABEL[h]}
              </button>
            ))}
          </div>
          <span className="min-w-0 flex-1 text-xs text-muted">{HAND_HELP[hand]}</span>
        </div>
      )}
      {!loaded ? (
        <div className="text-muted">Cargando…</div>
      ) : current === 'tarjetas' ? (
        <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
          <aside className="card h-fit p-3 lg:sticky lg:top-4">
            <GroupList
              selected={selected}
              stats={stats}
              recommendedId={rec.id}
              onSelect={(id) => {
                setReview(null)
                setGroupId(id)
              }}
            />
          </aside>
          <StudyTab key={review ? 'review' : selected} groupId={selected} initialCards={review ?? undefined} onClearReview={() => setReview(null)} />
        </div>
      ) : current === 'examen' ? (
        <ExamTab
          defaultGroupId={selected}
          onReview={(cards) => {
            setReview(cards)
            navigate('/learn/acordes?tab=tarjetas')
          }}
        />
      ) : current === 'progresiones' ? (
        <ProgressionsTab />
      ) : (
        <TipsTab />
      )}
    </div>
  )
}
