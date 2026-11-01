/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    strictPort: true,
    // Web MIDI requiere contexto seguro: http://localhost lo es.
    host: 'localhost',
  },
  // npm start (versión compilada) usa el mismo puerto.
  preview: { port: 5180, strictPort: true, host: 'localhost' },
  build: {
    // Tone.js (motor de audio) ocupa la mayor parte del paquete; es una app local,
    // por lo que un único bloque de ~830 kB (240 kB gzip) es aceptable.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
})
