import { Lightbulb, Volume2 } from 'lucide-react'
import { audioEngine } from '../../../core/audio/AudioEngine'
import { CATEGORY_INFO, cardVoicing, GENERAL_TIPS } from '../../../core/chords/trainer'
import { midiToName } from '../../../core/music/notes'
import { inversionName } from '../../../core/music/theory'
import { noteNameOpts, useSettings } from '../../../state/settings'
import { PianoKeyboard, type KeyMark } from '../../components/PianoKeyboard'
import { CATEGORIES } from './common'

export function TipsTab() {
  const settings = useSettings()
  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Las tres posiciones de un acorde (Do mayor)</h2>
        <p className="text-sm text-muted">Las mismas tres notas (Do, Mi, Sol), con distinta nota en el bajo. La tecla turquesa es la fundamental, la que da nombre al acorde.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((inv) => {
            const v = cardVoicing({ rootPc: 0, typeId: 'maj', inversion: inv })
            const marks = new Map<number, KeyMark>(v.map((m) => [m, m % 12 === 0 ? 'root' : 'chord']))
            return (
              <div key={inv} className="card-flat space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <b>{inversionName(inv)}</b>
                  <span className="chip">{['C', 'C/E', 'C/G'][inv]}</span>
                  <button className="btn btn-sm btn-ghost ml-auto" onClick={() => void audioEngine.demo(v, { durationMs: 1200 })} aria-label="Escuchar">
                    <Volume2 size={14} />
                  </button>
                </div>
                <PianoKeyboard low={55} high={79} height={80} marks={marks} labels="none" interactive={false} />
                <div className="text-xs text-muted">{v.map((m) => midiToName(m, noteNameOpts(settings))).join(' – ')}</div>
                <div className="text-xs text-faint">
                  {
                    [
                      'Dos terceras apiladas: tecla sí, tecla no. La fundamental está abajo.',
                      'La fundamental sube arriba. El hueco más ancho (4.ª) queda arriba.',
                      'La 5.ª va al bajo. El hueco más ancho queda abajo y la fundamental en medio.',
                    ][inv]
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {GENERAL_TIPS.map((t) => (
          <div key={t.title} className="card space-y-1 p-4">
            <div className="flex items-center gap-1.5 font-bold">
              <Lightbulb size={15} style={{ color: 'var(--accent)' }} /> {t.title}
            </div>
            <p className="text-sm text-muted">{t.text}</p>
          </div>
        ))}
      </div>

      <div className="card space-y-2 p-5">
        <h2 className="text-lg font-extrabold">Cómo están organizados los grupos</h2>
        {CATEGORIES.map((c) => (
          <p key={c} className="text-sm">
            <b>{CATEGORY_INFO[c].title}:</b> <span className="text-muted">{CATEGORY_INFO[c].description}</span>
          </p>
        ))}
        <p className="text-sm text-muted">
          Cada tarjeta tiene una «caja» de 0 a 5. Un acierto sin ayuda en menos de 5 s la sube una caja; un fallo o mirar la respuesta la devuelve a la 1. Las tarjetas de cajas bajas salen más a menudo. Una tarjeta está dominada en la caja 4, y un grupo cuando su media llega al 80 %.
        </p>
      </div>
    </div>
  )
}
