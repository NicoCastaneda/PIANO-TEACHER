import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { bootstrap } from './lib/bootstrap'

const root = createRoot(document.getElementById('root')!)
bootstrap()
  .catch((e) => console.error('[bootstrap]', e))
  .finally(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
