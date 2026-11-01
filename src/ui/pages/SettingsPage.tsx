import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, FlaskConical, Gauge, Music2, Plug, RefreshCw, SlidersHorizontal, Terminal, Timer, Usb } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { audioEngine, TIMBRES, type OutputDestination, type Timbre } from '../../core/audio/AudioEngine'
import { inputBus } from '../../core/midi/inputBus'
import { midiService } from '../../core/midi/MidiService'
import { CC_NAMES } from '../../core/midi/parse'
import { SOURCE_LABEL, type MusicEvent } from '../../core/midi/types'
import { midiToName } from '../../core/music/notes'
import { detectChord } from '../../core/music/theory'
import { PRESET_LABEL, TOLERANCE_PRESETS, DEFAULT_WEIGHTS } from '../../core/scoring/tolerance'
import type { DifficultyPreset, Tolerance } from '../../core/scoring/types'
import { FILE_SONGS } from '../../state/fileSongs'
import { navigate } from '../../lib/router'
import { useHeldNotes, useInputEvents, useMidiState } from '../../lib/hooks'
import { noteNameOpts, useSettings } from '../../state/settings'
import { PageHeader } from '../layout/Shell'
import { PianoKeyboard } from '../components/PianoKeyboard'
import { DataTransfer } from './ProgressPage'
import { Simulator } from './Simulator'

const TABS = [
  { id: 'midi', label: 'Conexión MIDI', icon: Usb },
  { id: 'diagnostics', label: 'Diagnóstico', icon: Activity },
  { id: 'calibration', label: 'Calibración', icon: Timer },
  { id: 'sound', label: 'Sonido', icon: Music2 },
  { id: 'evaluation', label: 'Evaluación', icon: Gauge },
  { id: 'preferences', label: 'Preferencias', icon: SlidersHorizontal },
  { id: 'simulator', label: 'Simulador', icon: FlaskConical },
  { id: 'data', label: 'Datos', icon: Database },
  { id: 'ai', label: 'Claude Code', icon: Terminal },
] as const

export function SettingsPage({ tab }: { tab?: string }) {
  const current = TABS.find((t) => t.id === tab)?.id ?? 'midi'
  return (
    <div>
      <PageHeader title="Configuración" subtitle="Conexión con el Casio CT-S300, diagnóstico, calibración, sonido y preferencias." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => navigate(`/settings/${id}`)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold whitespace-nowrap" style={current === id ? { background: 'color-mix(in oklab, var(--accent) 16%, transparent)', color: 'var(--text)' } : { color: 'var(--muted)' }}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          {current === 'midi' && <MidiTab />}
          {current === 'diagnostics' && <DiagnosticsTab />}
          {current === 'calibration' && <CalibrationTab />}
          {current === 'sound' && <SoundTab />}
          {current === 'evaluation' && <EvaluationTab />}
          {current === 'preferences' && <PreferencesTab />}
          {current === 'simulator' && <Simulator />}
          {current === 'data' && <DataTab />}
          {current === 'ai' && <AiTab />}
        </div>
      </div>
    </div>
  )
}

function Card({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        {icon} {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 first:border-0 first:pt-0">
      <div className="min-w-[220px] flex-1">
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ─────────────────────────── MIDI ───────────────────────────
function MidiTab() {
  const s = useMidiState()
  const settings = useSettings()
  return (
    <>
      <Card title="Estado de la conexión" icon={<Plug size={18} />}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill />
          {(s.status === 'idle' || s.status === 'denied' || s.status === 'error') && (
            <button className="btn btn-primary" onClick={() => void midiService.connect()}>
              <Usb size={16} /> Conectar teclado MIDI
            </button>
          )}
          {s.status === 'ready' && (
            <button className="btn btn-sm" onClick={() => void midiService.connect()}>
              <RefreshCw size={14} /> Buscar de nuevo
            </button>
          )}
        </div>
        {s.status === 'unsupported' && (
          <Warn>
            Este navegador no soporta Web MIDI. Usa <b>Google Chrome</b> o <b>Microsoft Edge</b> (versiones actuales) en Windows. Firefox lo soporta solo con complementos y Safari no lo soporta.
          </Warn>
        )}
        {s.status === 'insecure' && <Warn>Web MIDI solo funciona en un contexto seguro: abre la app desde http://localhost (desarrollo) o desde una dirección HTTPS.</Warn>}
        {s.status === 'denied' && (
          <Warn>
            Denegaste el permiso MIDI. Haz clic en el icono del candado (o de ajustes del sitio) junto a la barra de direcciones → "Dispositivos MIDI" → Permitir, y recarga la página.
          </Warn>
        )}
        {s.error && s.status === 'error' && <Warn>{s.error}</Warn>}
        {s.status === 'ready' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="label">Entrada (lo que tocas)</div>
              <select
                className="select w-full"
                value={s.selectedInputId ?? ''}
                onChange={(e) => {
                  midiService.selectInput(e.target.value || null)
                  settings.set({ preferredInput: s.inputs.find((i) => i.id === e.target.value)?.name ?? null })
                }}
              >
                <option value="">— Ninguna —</option>
                {s.inputs.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.state !== 'connected'}>
                    {i.name}
                    {i.isCasio ? ' (Casio)' : ''}
                    {i.state !== 'connected' ? ' – desconectado' : ''}
                  </option>
                ))}
              </select>
              {!s.inputs.length && <p className="text-sm text-muted">No se detecta ningún dispositivo de entrada MIDI.</p>}
            </div>
            <div className="space-y-2">
              <div className="label">Salida (para que el Casio toque)</div>
              <select
                className="select w-full"
                value={s.selectedOutputId ?? ''}
                onChange={(e) => {
                  midiService.selectOutput(e.target.value || null)
                  settings.set({ preferredOutput: s.outputs.find((o) => o.id === e.target.value)?.name ?? null })
                }}
              >
                <option value="">— Ninguna —</option>
                {s.outputs.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.state !== 'connected'}>
                    {o.name}
                    {o.isCasio ? ' (Casio)' : ''}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm" disabled={!s.outputConnected} onClick={() => (midiService.sendNoteOn(60, 90), setTimeout(() => midiService.sendNoteOff(60), 600))}>
                Enviar Do4 al teclado
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Cómo conectar el Casio CT-S300" icon={<Usb size={18} />}>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            Usa un cable <b>USB-A a Micro-B que transmita datos</b> (muchos cables de carga no transmiten datos). Conéctalo al puerto USB del CT-S300 y al ordenador.
          </li>
          <li>Enciende el teclado. Windows instala automáticamente el controlador la primera vez (puede tardar unos segundos). Según el manual, aparece como «CASIO USB-MIDI».</li>
          <li>Abre esta app en Chrome o Edge y pulsa «Conectar teclado MIDI». Acepta el aviso de permiso de dispositivos MIDI.</li>
          <li>Ve a «Diagnóstico» y toca una tecla: debe aparecer al instante con su número MIDI y velocidad.</li>
        </ol>
        <div className="label pt-2">Si no aparece</div>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>Prueba otro cable (de datos) y otro puerto USB; evita hubs sin alimentación.</li>
          <li>Cierra otros programas que usen MIDI (DAWs, otras pestañas): en Windows, un puerto MIDI puede no compartirse entre aplicaciones.</li>
          <li>Desconecta y vuelve a conectar el cable; la app detecta la reconexión automáticamente.</li>
          <li>Según el manual, el teclado no envía ni recibe datos MIDI mientras reproduce una canción incorporada.</li>
        </ul>
        <div className="label pt-2">Ajustes del teclado relevantes (botón FUNCTION)</div>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            <b>Local Control</b>: si la app envía notas al Casio y también suenan desde el teclado, puede haber duplicación. La app no puede cambiar este ajuste por MIDI. Revisa en tu teclado qué valor silencia el sonido interno y elige en «Sonido» el destino de audio adecuado para evitar eco.
          </li>
          <li>
            <b>MIDI Out Octave Shift</b> (−3 a +3) cambia los números de nota que envía el teclado. Si lo usas, compénsalo en Preferencias → «Desplazamiento de entrada».
          </li>
          <li>
            <b>Touch Response</b> y <b>MIDI Out Velocity</b>: con la respuesta al tacto desactivada o una velocidad fija, la velocidad que llega es constante. En ese caso la app no evalúa la dinámica.
          </li>
          <li>El sonido físico del Casio no viaja por USB: el USB del CT-S300 transmite solo MIDI. Para escuchar el Casio usa sus altavoces o su salida de auriculares.</li>
        </ul>
      </Card>
    </>
  )
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-miss/40 bg-miss/10 px-3 py-2 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--miss)' }} />
      <div>{children}</div>
    </div>
  )
}

function StatusPill() {
  const s = useMidiState()
  const input = s.inputs.find((i) => i.id === s.selectedInputId)
  const map: Record<string, [string, string]> = {
    unsupported: ['Navegador sin Web MIDI', 'var(--bad)'],
    insecure: ['Contexto no seguro', 'var(--bad)'],
    idle: ['Sin conectar', 'var(--faint)'],
    requesting: ['Solicitando permiso…', 'var(--miss)'],
    denied: ['Permiso denegado', 'var(--bad)'],
    error: ['Error', 'var(--bad)'],
    ready: s.inputConnected ? [`Conectado: ${input?.name}`, 'var(--ok)'] : ['Permiso concedido · sin teclado detectado', 'var(--miss)'],
  }
  const [text, color] = map[s.status]
  return (
    <span className="chip text-sm" style={{ color, borderColor: color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {text}
    </span>
  )
}

// ─────────────────────────── Diagnóstico ───────────────────────────
interface LogRow {
  e: MusicEvent
  id: number
}

function DiagnosticsTab() {
  const settings = useSettings()
  const opts = noteNameOpts(settings)
  const held = useHeldNotes()
  const [log, setLog] = useState<LogRow[]>([])
  const [flash, setFlash] = useState(0)
  const counter = useRef(0)
  const t0 = useRef(performance.now())
  const onsets = useRef(new Map<number, number>())
  useInputEvents((e) => {
    if (e.type === 'noteon') {
      setFlash((x) => x + 1)
      onsets.current.set(e.note, e.time)
    }
    if (e.type === 'noteoff') onsets.current.delete(e.note)
    setLog((l) => [{ e, id: ++counter.current }, ...l].slice(0, 80))
  })
  const heldNotes = [...held.keys()].sort((a, b) => a - b)
  const chord = detectChord(heldNotes)
  const times = heldNotes.map((n) => onsets.current.get(n)).filter((x): x is number => x !== undefined)
  const spread = times.length >= 2 ? Math.max(...times) - Math.min(...times) : null
  const last = log.find((r) => r.e.type === 'noteon')?.e

  return (
    <>
      <Card title="Prueba de conexión" icon={<Activity size={18} />}>
        <div className="flex flex-wrap items-center gap-6">
          <div key={flash} className="pulse-ring grid h-20 w-20 place-items-center rounded-full border-2" style={{ borderColor: flash ? 'var(--ok)' : 'var(--border)', background: held.size ? 'color-mix(in oklab, var(--ok) 25%, transparent)' : 'var(--surface-2)' }}>
            <Cpu size={26} style={{ color: held.size ? 'var(--ok)' : 'var(--faint)' }} />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-5">
            <Big label="Nota" value={last && last.type === 'noteon' ? midiToName(last.note, opts) : '—'} />
            <Big label="Número MIDI" value={last && last.type === 'noteon' ? last.note : '—'} />
            <Big label="Velocidad" value={last && last.type === 'noteon' ? last.velocity : '—'} />
            <Big label="Canal" value={last ? last.channel : '—'} />
            <Big label="Origen" value={last ? SOURCE_LABEL[last.source] : '—'} color={last?.source === 'simulated' ? 'var(--miss)' : undefined} />
          </div>
        </div>
        <PianoKeyboard height={110} held={held} />
        <div className="grid gap-3 md:grid-cols-3">
          <Big label="Notas mantenidas" value={heldNotes.length ? heldNotes.map((n) => midiToName(n, opts)).join(' ') : '—'} />
          <Big label="Acorde" value={chord?.symbol ?? '—'} />
          <Big label="Simultaneidad del acorde" value={spread === null ? '—' : `${Math.round(spread)} ms`} sub="diferencia entre la primera y la última nota" />
        </div>
        {inputBus.sustain && <span className="chip">Pedal de sostenido pulsado (CC64)</span>}
      </Card>
      <Card title="Registro de eventos">
        <div className="max-h-[380px] overflow-auto rounded-xl border border-border font-mono text-xs">
          <table className="w-full">
            <thead className="sticky top-0 bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-2 py-1.5">t (ms)</th>
                <th className="px-2 py-1.5">Evento</th>
                <th className="px-2 py-1.5">Datos</th>
                <th className="px-2 py-1.5">Canal</th>
                <th className="px-2 py-1.5">Origen</th>
              </tr>
            </thead>
            <tbody>
              {log.map(({ e, id }) => (
                <tr key={id} className="border-t border-border" style={e.source === 'simulated' ? { color: 'var(--miss)' } : undefined}>
                  <td className="px-2 py-1 tabular-nums">{Math.round(e.time - t0.current)}</td>
                  <td className="px-2 py-1">{e.type === 'noteon' ? 'Note On' : e.type === 'noteoff' ? 'Note Off' : e.type === 'cc' ? 'Control Change' : e.type === 'pitchbend' ? 'Pitch Bend' : 'Program Change'}</td>
                  <td className="px-2 py-1">
                    {e.type === 'noteon' && `${midiToName(e.note, opts)} (${e.note}) vel ${e.velocity}`}
                    {e.type === 'noteoff' && `${midiToName(e.note, opts)} (${e.note}) vel ${e.velocity}`}
                    {e.type === 'cc' && `CC${e.controller} ${CC_NAMES[e.controller] ? `(${CC_NAMES[e.controller]})` : ''} = ${e.value}`}
                    {e.type === 'pitchbend' && e.value.toFixed(3)}
                    {e.type === 'program' && `Programa ${e.program}`}
                  </td>
                  <td className="px-2 py-1">{e.channel}</td>
                  <td className="px-2 py-1">
                    {SOURCE_LABEL[e.source]}
                    {e.device ? ` · ${e.device}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!log.length && <div className="p-4 text-center text-muted">Toca una tecla del Casio para ver los eventos.</div>}
        </div>
        <p className="text-xs text-muted">Las filas en ámbar son eventos SIMULADOS (pestaña Simulador). Nunca se presentan como procedentes del Casio.</p>
      </Card>
    </>
  )
}

function Big({ label, value, sub, color }: { label: string; value: ReactNode; sub?: string; color?: string }) {
  return (
    <div className="card-flat px-3 py-2">
      <div className="label">{label}</div>
      <div className="truncate text-xl font-extrabold" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  )
}

// ─────────────────────────── Calibración ───────────────────────────
function CalibrationTab() {
  const settings = useSettings()
  const [running, setRunning] = useState(false)
  const [offsets, setOffsets] = useState<number[]>([])
  const clicks = useRef<number[]>([])
  const N = 12
  const BPM = 80
  const COUNT_IN = 4

  useInputEvents((e) => {
    if (!running || e.type !== 'noteon') return
    const beat = 60000 / BPM
    // empareja la pulsación con el clic más cercano (descarta la cuenta previa)
    let best: number | null = null
    for (const c of clicks.current.slice(COUNT_IN)) if (best === null || Math.abs(e.time - c) < Math.abs(e.time - best)) best = c
    if (best !== null && Math.abs(e.time - best) < beat / 2) setOffsets((o) => [...o, e.time - best!])
  })

  const run = async () => {
    await audioEngine.start()
    setOffsets([])
    const beat = 60000 / BPM
    const t0 = performance.now() + 300
    clicks.current = Array.from({ length: N + COUNT_IN }, (_, i) => t0 + i * beat)
    clicks.current.forEach((t, i) => audioEngine.scheduleClick(t, i < COUNT_IN || (i - COUNT_IN) % 4 === 0))
    setRunning(true)
    window.setTimeout(() => setRunning(false), (N + COUNT_IN) * beat + 800)
  }

  const sorted = [...offsets].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  const mad = median !== null && sorted.length ? [...sorted.map((x) => Math.abs(x - median))].sort((a, b) => a - b)[Math.floor(sorted.length / 2)] : null
  const outLat = audioEngine.isStarted ? Math.round(audioEngine.outputLatency() * 1000) : null

  return (
    <Card title="Calibración de latencia" icon={<Timer size={18} />}>
      <p className="text-sm leading-relaxed text-muted">
        Entre que la app produce un sonido, lo oyes, pulsas la tecla y el evento MIDI llega al navegador pasan algunos milisegundos. Esta prueba mide ese retraso total en <b>tu</b> equipo para que la evaluación rítmica sea justa. Pulsa
        cualquier tecla del Casio exactamente con cada clic (después de 4 clics de cuenta previa). Usa auriculares o los altavoces habituales.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={() => void run()} disabled={running}>
          {running ? 'Escuchando… pulsa con cada clic' : 'Empezar prueba (12 pulsaciones)'}
        </button>
        {outLat !== null && <span className="chip">Latencia de salida de audio informada por el navegador: {outLat} ms</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {offsets.map((o, i) => (
          <span key={i} className="chip font-mono">
            {o > 0 ? '+' : ''}
            {Math.round(o)}
          </span>
        ))}
      </div>
      {median !== null && offsets.length >= 6 && (
        <div className="card-flat flex flex-wrap items-center gap-4 p-4">
          <div>
            <div className="label">Desfase medido (mediana)</div>
            <div className="text-3xl font-black tabular-nums">{Math.round(median)} ms</div>
            <div className="text-xs text-muted">Dispersión ±{Math.round(mad ?? 0)} ms · {offsets.length} pulsaciones</div>
          </div>
          {mad !== null && mad > 60 && <Warn>Las pulsaciones son muy irregulares: repite la prueba con más concentración para un resultado fiable.</Warn>}
          <button className="btn btn-primary" onClick={() => settings.set({ latencyMs: Math.round(median) })}>
            <CheckCircle2 size={16} /> Aplicar {Math.round(median)} ms
          </button>
        </div>
      )}
      <Row label={`Compensación actual: ${settings.latencyMs} ms`} hint="Se resta a la marca de tiempo de cada nota recibida antes de evaluarla. Positivo = tus notas llegan tarde por la latencia del sistema.">
        <input type="range" min={-100} max={300} value={settings.latencyMs} onChange={(e) => settings.set({ latencyMs: Number(e.target.value) })} className="w-64" />
      </Row>
    </Card>
  )
}

// ─────────────────────────── Sonido ───────────────────────────
function SoundTab() {
  const s = useSettings()
  const midi = useMidiState()
  const DEST: { id: OutputDestination; label: string; hint: string }[] = [
    { id: 'app', label: 'App (navegador)', hint: 'Sonido de la aplicación por los altavoces del ordenador.' },
    { id: 'casio', label: 'Casio (MIDI)', hint: 'La app envía las notas al CT-S300 y suenan con sus sonidos.' },
    { id: 'both', label: 'Ambos', hint: 'Puede producir eco o duplicación.' },
    { id: 'none', label: 'Silencio', hint: 'No reproducir demos ni acompañamientos.' },
  ]
  return (
    <Card title="Sonido" icon={<Music2 size={18} />}>
      <Row label="Timbre" hint="El piano usa muestras reales (Salamander Grand Piano, CC-BY 3.0). Los demás son sintetizados.">
        <select className="select" value={s.timbre} onChange={(e) => s.set({ timbre: e.target.value as Timbre })}>
          {TIMBRES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.kind})
            </option>
          ))}
        </select>
      </Row>
      <Row label="Destino de reproducción" hint="Para demos, referencia y acompañamiento. Elige uno solo para evitar oír lo mismo por dos salidas.">
        <div className="seg">
          {DEST.map((d) => (
            <button key={d.id} aria-pressed={s.playbackDestination === d.id} onClick={() => s.set({ playbackDestination: d.id })} title={d.hint} disabled={(d.id === 'casio' || d.id === 'both') && !midi.outputConnected}>
              {d.label}
            </button>
          ))}
        </div>
      </Row>
      {(s.playbackDestination === 'casio' || s.playbackDestination === 'both') && (
        <Row label="Canal de salida MIDI" hint="Canal por el que se envían las notas al Casio (1–16).">
          <input type="number" min={1} max={16} className="input w-20" value={s.midiOutputChannel} onChange={(e) => s.set({ midiOutputChannel: Math.max(1, Math.min(16, Number(e.target.value))) })} />
        </Row>
      )}
      <Row label="Sonar en la app lo que toco en el Casio" hint="Normalmente desactivado: el Casio ya suena por sí mismo. Actívalo si usas el teclado con el volumen al mínimo.">
        <Toggle on={s.monitorMidiInput} set={(v) => s.set({ monitorMidiInput: v })} />
      </Row>
      <Row label={`Volumen: ${s.volumeDb} dB`}>
        <input type="range" min={-40} max={0} value={s.volumeDb} onChange={(e) => s.set({ volumeDb: Number(e.target.value) })} className="w-56" />
      </Row>
      <Row label={`Metrónomo: ${s.metronomeDb} dB`}>
        <input type="range" min={-40} max={0} value={s.metronomeDb} onChange={(e) => s.set({ metronomeDb: Number(e.target.value) })} className="w-56" />
      </Row>
      <Row label="Probar sonido">
        <button className="btn btn-sm" onClick={() => void audioEngine.demo([60, 64, 67, 72], { arpeggio: true })}>
          Do mayor
        </button>
      </Row>
    </Card>
  )
}

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => set(!on)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: on ? 'var(--accent)' : 'var(--surface-3)' }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]" style={{ left: on ? 22 : 2 }} />
    </button>
  )
}

// ─────────────────────────── Evaluación ───────────────────────────
function EvaluationTab() {
  const s = useSettings()
  const tol: Tolerance = s.difficulty === 'custom' ? s.customTolerance : TOLERANCE_PRESETS[s.difficulty]
  const setTol = (patch: Partial<Tolerance>) => s.set({ difficulty: 'custom', customTolerance: { ...tol, ...patch } })
  const slider = (label: string, key: keyof Tolerance, min: number, max: number, step: number, unit: string, hint: string) => (
    <Row label={`${label}: ${key === 'durationTolerance' ? `±${Math.round(tol[key] * 100)} %` : `${tol[key]}${unit}`}`} hint={hint}>
      <input type="range" min={min} max={max} step={step} value={tol[key]} onChange={(e) => setTol({ [key]: Number(e.target.value) })} className="w-56" />
    </Row>
  )
  return (
    <>
      <Card title="Nivel de exigencia" icon={<Gauge size={18} />}>
        <div className="seg">
          {(['beginner', 'intermediate', 'advanced', 'custom'] as DifficultyPreset[]).map((d) => (
            <button key={d} aria-pressed={s.difficulty === d} onClick={() => s.set({ difficulty: d })}>
              {PRESET_LABEL[d]}
            </button>
          ))}
        </div>
        {slider('Ventana de acierto', 'hitWindowMs', 40, 400, 5, ' ms', 'Máxima distancia temporal para que una nota cuente como correcta. Se escala con el tempo (×0,75–×1,5) y nunca supera la mitad del intervalo entre notas repetidas.')}
        {slider('Ventana "perfecta"', 'perfectWindowMs', 10, 150, 5, ' ms', 'Dentro de ella la precisión rítmica es del 100 %.')}
        {slider('Simultaneidad de acordes', 'chordSpreadMs', 20, 250, 5, ' ms', 'Diferencia máxima entre las notas de un acorde.')}
        {slider('Tolerancia de duración', 'durationTolerance', 0.1, 0.8, 0.05, '', 'Error relativo permitido en la duración (solo en ejercicios que la evalúan).')}
        {slider('Tolerancia de velocidad', 'velocityTolerance', 5, 50, 1, '', 'Solo en ejercicios de dinámica.')}
      </Card>
      <Card title="Fórmula de puntuación">
        <p className="font-mono text-sm">Total = 100 × N × (w_n + w_r·R + w_d·D + w_v·V) / (suma de pesos activos)</p>
        <p className="text-sm text-muted">N = aciertos / (esperadas + λ × adicionales). R, D y V son las medias de precisión rítmica, de duración y de dinámica de las notas acertadas. Las dimensiones que un ejercicio no evalúa se excluyen de la fórmula.</p>
        {(['notes', 'timing', 'duration', 'dynamics'] as const).map((k) => (
          <Row key={k} label={`Peso ${{ notes: 'notas (w_n)', timing: 'ritmo (w_r)', duration: 'duración (w_d)', dynamics: 'dinámica (w_v)' }[k]}: ${s.weights[k].toFixed(2)}`}>
            <input type="range" min={0} max={1} step={0.05} value={s.weights[k]} onChange={(e) => s.set({ weights: { ...s.weights, [k]: Number(e.target.value) } })} className="w-56" />
          </Row>
        ))}
        <Row label={`Penalización por nota adicional (λ): ${s.extraPenalty}`}>
          <input type="range" min={0} max={1} step={0.05} value={s.extraPenalty} onChange={(e) => s.set({ extraPenalty: Number(e.target.value) })} className="w-56" />
        </Row>
        <button className="btn btn-sm" onClick={() => s.set({ weights: DEFAULT_WEIGHTS, extraPenalty: 0.5 })}>
          Restablecer pesos
        </button>
      </Card>
    </>
  )
}

// ─────────────────────────── Preferencias ───────────────────────────
function PreferencesTab() {
  const s = useSettings()
  return (
    <Card title="Preferencias" icon={<SlidersHorizontal size={18} />}>
      <Row label="Tema">
        <div className="seg">
          <button aria-pressed={s.theme === 'dark'} onClick={() => s.set({ theme: 'dark' })}>
            Oscuro
          </button>
          <button aria-pressed={s.theme === 'light'} onClick={() => s.set({ theme: 'light' })}>
            Claro
          </button>
        </div>
      </Row>
      <Row label="Nombres de notas">
        <div className="seg">
          <button aria-pressed={s.namingStyle === 'latin'} onClick={() => s.set({ namingStyle: 'latin' })}>
            Do Re Mi
          </button>
          <button aria-pressed={s.namingStyle === 'english'} onClick={() => s.set({ namingStyle: 'english' })}>
            C D E
          </button>
        </div>
      </Row>
      <Row label="Alteraciones">
        <div className="seg">
          <button aria-pressed={s.accidental === 'sharp'} onClick={() => s.set({ accidental: 'sharp' })}>
            Sostenidos ♯
          </button>
          <button aria-pressed={s.accidental === 'flat'} onClick={() => s.set({ accidental: 'flat' })}>
            Bemoles ♭
          </button>
        </div>
      </Row>
      <Row label="Numeración de octavas" hint={`MIDI 60 (Do central) = ${midiToName(60, noteNameOpts(s))}. Casio y la convención científica usan C4; Yamaha y algunos programas, C3.`}>
        <div className="seg">
          {(['C4', 'C3', 'C5'] as const).map((c) => (
            <button key={c} aria-pressed={s.octaveConvention === c} onClick={() => s.set({ octaveConvention: c })}>
              Do central = {c}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Etiquetas en el teclado">
        <div className="seg">
          {(
            [
              ['all', 'Todas'],
              ['c-only', 'Solo Do'],
              ['none', 'Ninguna'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={s.showNoteNames === k} onClick={() => s.set({ showNoteNames: k })}>
              {l}
            </button>
          ))}
        </div>
      </Row>
      <Row label={`Desplazamiento de entrada: ${s.inputTranspose > 0 ? '+' : ''}${s.inputTranspose} semitonos`} hint='Compensa "MIDI Out Octave Shift" del Casio (±12 por octava).'>
        <div className="flex items-center gap-2">
          {[-24, -12, 0, 12, 24].map((v) => (
            <button key={v} className="btn btn-sm" style={s.inputTranspose === v ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined} onClick={() => s.set({ inputTranspose: v })}>
              {v > 0 ? '+' : ''}
              {v}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Teclado del ordenador como entrada" hint="A W S E D F T G Y H U J K… tocan notas; Z/X cambian de octava. Se marca como 'Teclado del ordenador', nunca como Casio.">
        <Toggle on={s.computerKeyboard} set={(v) => s.set({ computerKeyboard: v })} />
      </Row>
    </Card>
  )
}

// ─────────────────────────── Datos ───────────────────────────
function DataTab() {
  return (
    <Card title="Datos y copia de seguridad" icon={<Database size={18} />}>
      <p className="text-sm text-muted">Tu progreso, canciones y ajustes se guardan solo en este navegador (IndexedDB). Exporta una copia para no perderlos o para pasarlos a otro equipo.</p>
      <DataTransfer />
    </Card>
  )
}

// ─────────────────────────── Claude Code ───────────────────────────
function AiTab() {
  const ok = FILE_SONGS.filter((f) => f.ok).length
  return (
    <Card title="IA con Claude Code (sin clave de API)" icon={<Terminal size={18} />}>
      <p className="text-sm text-muted">
        La app no llama a ningún servicio de IA. Las funciones de IA se usan desde Claude Code (consola o extensión de VS Code) abierto en la carpeta del proyecto, mediante comandos preparados en <span className="kbd">.claude/skills/</span>:
      </p>
      <ul className="space-y-2 text-sm">
        <li>
          <span className="kbd">/cancion</span> <span className="text-muted">— investiga una canción, escribe el arreglo en </span>
          <span className="kbd">canciones/&lt;id&gt;.json</span>
          <span className="text-muted"> con el esquema de la app, lo valida con </span>
          <span className="kbd">npm run cancion:validar</span>
          <span className="text-muted"> y aparece solo en Canciones. También sirve para ejercicios a medida.</span>
        </li>
        <li>
          <span className="kbd">/coach</span> <span className="text-muted">— lee una exportación de tus datos (Progreso → Exportar) y te da consejos basados solo en tus cifras.</span>
        </li>
        <li className="text-muted">Para dudas de teoría o de una lección, pregúntale directamente a Claude Code.</li>
      </ul>
      <div className="text-sm">
        Archivos en <span className="kbd">canciones/</span>: <b>{FILE_SONGS.length}</b> · válidos: <b style={{ color: 'var(--ok)' }}>{ok}</b>
        {FILE_SONGS.length > ok && (
          <>
            {' '}
            · con errores: <b style={{ color: 'var(--bad)' }}>{FILE_SONGS.length - ok}</b> (detalles en Canciones)
          </>
        )}
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>La puntuación nunca depende de la IA: se calcula con un algoritmo determinista sobre tus eventos MIDI.</li>
        <li>Todo archivo de canción pasa por el validador (esquema, notación, rango C2–C7, duraciones, acordes, secciones, tocabilidad) antes de poder usarse.</li>
        <li>Los arreglos creados así se etiquetan como generados por IA o adaptación didáctica, con fuentes y confianza; nunca como transcripción oficial.</li>
      </ul>
    </Card>
  )
}

