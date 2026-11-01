import { loadSongFile, type SongFileResult } from '../core/songs/songFile'

/**
 * Canciones de la carpeta `canciones/` del proyecto (las crea Claude Code con `/cancion`).
 * Se leen como texto para que un archivo roto muestre su error en vez de romper la app.
 * En desarrollo, Vite recarga la página automáticamente al añadir o editar un archivo.
 */
const raw = import.meta.glob('/canciones/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

export const FILE_SONGS: SongFileResult[] = Object.entries(raw)
  .map(([path, text]) => loadSongFile(text, path.split('/').pop() ?? path))
  .sort((a, b) => (a.arrangement?.title ?? a.file).localeCompare(b.arrangement?.title ?? b.file))
