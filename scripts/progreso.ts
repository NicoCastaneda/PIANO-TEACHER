/**
 * Resumen determinista del progreso a partir de una exportación de la app
 * (Progreso → Exportar datos). Lo usa el comando /coach de Claude Code: los consejos
 * deben apoyarse en estas cifras, que se calculan con el mismo código que la app.
 *
 *   npm run progreso:resumen -- ruta\al\piano-coach-AAAA-MM-DD.json
 */
import { readFileSync } from 'node:fs'
import { recommendations, recommendedDifficulty, skillStats, summary } from '../src/core/progress/stats'
import type { ExportFile } from '../src/core/storage/db'

const path = process.argv[2]
if (!path) {
  console.error('Indica el archivo exportado: npm run progreso:resumen -- ruta\\al\\archivo.json')
  process.exit(2)
}
const data = JSON.parse(readFileSync(path, 'utf8')) as ExportFile
if (data?.app !== 'piano-coach' || !Array.isArray(data.attempts)) {
  console.error('El archivo no es una exportación de Piano Coach.')
  process.exit(2)
}

const attempts = [...data.attempts].sort((a, b) => a.at - b.at)
const pct = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 100))

const report = {
  exportadoEl: data.exportedAt,
  resumen: summary(attempts),
  leccionesCompletadas: data.lessons.filter((l) => l.completedAt).map((l) => l.id),
  habilidades: skillStats(attempts).map((s) => ({ habilidad: s.label, nivel: s.level, intentos: s.attempts, dominada: s.mastered })),
  dificultadRecomendada: recommendedDifficulty(attempts),
  recomendacionesDeLaApp: recommendations(attempts).map((r) => ({ titulo: r.title, motivo: r.reason })),
  ultimosIntentos: attempts.slice(-20).map((a) => ({
    fecha: new Date(a.at).toISOString().slice(0, 16).replace('T', ' '),
    actividad: a.title,
    modo: a.mode,
    entrada: a.input,
    puntuacion: Math.round(a.score),
    notasPct: pct(a.noteAccuracy),
    ritmoPct: pct(a.timingScore),
    duracionPct: pct(a.durationScore),
    desfaseMedioMs: a.meanOffsetMs === null ? null : Math.round(a.meanOffsetMs),
    omitidas: a.counts.missed,
    incorrectas: a.counts.wrong,
    octavaEquivocada: a.counts.octave,
    extra: a.counts.extra,
    retrasoCambioAcordeMs: a.chordChangeLagMs ?? null,
    secciones: a.sections?.map((s) => ({ seccion: s.name ?? s.id, precisionPct: pct(s.accuracy) })),
  })),
}
console.log(JSON.stringify(report, (_k, v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v), 2))
