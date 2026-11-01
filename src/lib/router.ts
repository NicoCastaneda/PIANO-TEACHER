import { useEffect, useState } from 'react'

/**
 * Enrutador mínimo por hash (#/ruta/param). Suficiente para 7 secciones con
 * parámetros y evita una dependencia; funciona sin servidor (también en dist/).
 */
export interface Route {
  path: string
  segments: string[]
  query: URLSearchParams
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs] = raw.split('?')
  return { path, segments: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs ?? '') }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(path: string) {
  const target = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash !== target) window.location.hash = target
}

export function href(path: string) {
  return `#${path}`
}
