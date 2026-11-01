/**
 * Herramienta de consola para los archivos de canción (canciones/*.json).
 *
 *   npm run cancion:validar                      → valida todos los archivos de canciones/
 *   npm run cancion:validar -- canciones/x.json  → valida archivos concretos
 *   npm run cancion:esquema                      → regenera canciones/esquema/cancion.schema.json
 *
 * Usa exactamente el mismo validador que la app. Código de salida 1 si hay problemas
 * bloqueantes (errores o duraciones que no cuadran).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { midiToName } from '../src/core/music/notes'
import { makeDifficultyVersion } from '../src/core/songs/adapt'
import { ARRANGEMENT_TYPE_LABEL, beatsToSeconds, DIFFICULTY_LABEL, songLengthBeats } from '../src/core/songs/schema'
import { isBlocking, loadSongFile, SongFileSchema } from '../src/core/songs/songFile'

const DIR = 'canciones'
const [cmd = 'validar', ...args] = process.argv.slice(2)

if (cmd === 'esquema') {
  const schema = z.toJSONSchema(SongFileSchema, { io: 'input' })
  const { $schema, ...rest } = schema
  writeFileSync(join(DIR, 'esquema', 'cancion.schema.json'), JSON.stringify({ $schema, title: 'Archivo de canción de Piano Coach', ...rest }, null, 2) + '\n')
  console.log(`Esquema escrito en ${DIR}/esquema/cancion.schema.json`)
  process.exit(0)
}

if (cmd !== 'validar') {
  console.error(`Comando desconocido: ${cmd}. Usa "validar" o "esquema".`)
  process.exit(2)
}

const files = args.length ? args : readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => join(DIR, f))
if (!files.length) {
  console.log(`No hay archivos en ${DIR}/. Crea uno con /cancion en Claude Code.`)
  process.exit(0)
}

let blocking = 0
for (const path of files) {
  const r = loadSongFile(readFileSync(path, 'utf8'), basename(path))
  const bad = r.issues.filter(isBlocking)
  if (!r.ok || bad.length) blocking++
  console.log(`\n${r.ok && !bad.length ? '✔ VÁLIDO' : '✖ CORREGIR'}  ${path}`)
  const a = r.arrangement
  if (a) {
    const name = (m: number) => midiToName(m)
    const hand = (h: 'L' | 'R') => {
      const n = a.notes.filter((x) => x.hand === h)
      return n.length ? `${n.length} notas (${name(Math.min(...n.map((x) => x.midi)))}–${name(Math.max(...n.map((x) => x.midi)))})` : 'sin notas'
    }
    const beats = songLengthBeats(a)
    console.log(`  ${a.title}${a.artist ? ` · ${a.artist}` : ''} · ${a.key} · ${a.bpm} BPM · ${a.timeSignature.join('/')}`)
    console.log(`  Tipo: ${ARRANGEMENT_TYPE_LABEL[a.arrangementType]} · confianza ${Math.round(a.confidence * 100)} %`)
    console.log(`  Duración: ${beats} negras ≈ ${Math.round(beatsToSeconds(beats, a.bpm))} s · secciones: ${a.sections.map((s) => s.name).join(', ')}`)
    console.log(`  Mano derecha: ${hand('R')} · mano izquierda: ${hand('L')} · acordes: ${a.chords.length}`)
    console.log(
      `  Versiones: ${(['beginner', 'intermediate', 'advanced'] as const)
        .map((d) => `${DIFFICULTY_LABEL[d]} ${makeDifficultyVersion(a, d).notes.length} notas`)
        .join(' · ')}`,
    )
    if (r.ok && !bad.length) console.log(`  Abrir en la app: http://localhost:5180/#/songs/${a.id}${r.recommendedStartLevel ? `?level=${r.recommendedStartLevel}` : ''}`)
  }
  for (const i of r.issues) console.log(`  ${isBlocking(i) ? '✖' : '⚠'} [${i.code}] ${i.message}`)
}
console.log(blocking ? `\n${blocking} archivo(s) con problemas bloqueantes (✖): corrígelos y vuelve a validar.` : '\nTodo correcto.')
process.exit(blocking ? 1 : 0)
