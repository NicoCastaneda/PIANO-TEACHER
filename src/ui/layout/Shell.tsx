import { BarChart3, Dumbbell, GraduationCap, Home, Moon, Music, Piano, Settings, Sun, Usb } from 'lucide-react'
import type { ReactNode } from 'react'
import { midiService } from '../../core/midi/MidiService'
import { href, navigate, useRoute } from '../../lib/router'
import { useMidiState } from '../../lib/hooks'
import { useSettings } from '../../state/settings'

export const NAV = [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/learn', label: 'Aprender', icon: GraduationCap },
  { path: '/practice', label: 'Practicar', icon: Dumbbell },
  { path: '/songs', label: 'Canciones', icon: Music },
  { path: '/keyboard', label: 'Teclado', icon: Piano },
  { path: '/progress', label: 'Progreso', icon: BarChart3 },
  { path: '/settings', label: 'Configuración', icon: Settings },
] as const

export function MidiBadge() {
  const s = useMidiState()
  const input = s.inputs.find((i) => i.id === s.selectedInputId)
  let color = 'var(--faint)'
  let text = 'MIDI desconectado'
  if (s.status === 'unsupported') text = 'Navegador sin Web MIDI'
  else if (s.status === 'insecure') text = 'Requiere HTTPS o localhost'
  else if (s.status === 'denied') {
    text = 'Permiso MIDI denegado'
    color = 'var(--bad)'
  } else if (s.status === 'requesting') text = 'Solicitando permiso…'
  else if (s.status === 'ready' && s.inputConnected && input) {
    text = input.isCasio ? `${input.name}` : input.name
    color = 'var(--ok)'
  } else if (s.status === 'ready') {
    text = 'Ningún teclado detectado'
    color = 'var(--miss)'
  }
  const recent = performance.now() - s.lastActivity < 180
  return (
    <button
      className="chip cursor-pointer hover:text-text"
      onClick={() => (s.status === 'idle' ? void midiService.connect() : navigate('/settings/midi'))}
      title="Estado de la conexión MIDI"
    >
      <span className="relative inline-block h-2 w-2 rounded-full" style={{ background: color, boxShadow: recent ? `0 0 8px 2px ${color}` : undefined }} />
      <Usb size={13} />
      <span className="max-w-[180px] truncate">{s.status === 'idle' ? 'Conectar teclado MIDI' : text}</span>
    </button>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const route = useRoute()
  const theme = useSettings((s) => s.theme)
  const set = useSettings((s) => s.set)
  const active = (p: string) => (p === '/' ? route.path === '/' : route.path === p || route.path.startsWith(`${p}/`))
  return (
    <div className="flex h-full">
      <aside className="sticky top-0 hidden h-full w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-4 backdrop-blur md:flex">
        <a href={href('/')} className="mb-6 flex items-center gap-2.5 px-2">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <div>
            <div className="text-[15px] font-extrabold leading-tight tracking-tight">Piano Coach</div>
            <div className="text-[11px] font-medium text-muted">Casio CT-S300</div>
          </div>
        </a>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ path, label, icon: Icon }) => (
            <a
              key={path}
              href={href(path)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
              style={active(path) ? { background: 'color-mix(in oklab, var(--accent) 16%, transparent)', color: 'var(--text)' } : { color: 'var(--muted)' }}
            >
              <Icon size={18} style={active(path) ? { color: 'var(--accent)' } : undefined} />
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2 text-[11px] leading-relaxed text-faint">
          <p>Sonido de piano: Salamander Grand Piano (A. Holm, CC-BY 3.0).</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-2.5 backdrop-blur md:px-8">
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.map(({ path, icon: Icon, label }) => (
              <a key={path} href={href(path)} title={label} className="rounded-lg p-2" style={{ color: active(path) ? 'var(--accent)' : 'var(--muted)' }}>
                <Icon size={18} />
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <MidiBadge />
            <button className="btn btn-ghost btn-sm" onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })} title="Cambiar tema" aria-label="Cambiar tema">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
