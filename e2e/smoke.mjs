// Prueba de interfaz (humo): recorre todas las secciones, detecta errores de consola
// y guarda capturas. Uso: node e2e/smoke.mjs [url] [carpetaCapturas]
// Requiere la app en marcha (npm run dev) y `npx playwright install chromium`.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:5180'
const OUT = process.argv[3] ?? 'e2e/screenshots'
mkdirSync(OUT, { recursive: true })

const ROUTES = ['/', '/learn', '/learn/l1-melody', '/practice', '/songs', '/songs/ode-to-joy', '/keyboard', '/progress', '/settings/midi', '/settings/diagnostics', '/settings/calibration', '/settings/evaluation', '/settings/simulator']

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()} ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${page.url()} ${m.text()}`)
})

let failed = false
for (const r of ROUTES) {
  await page.goto(`${BASE}/#${r}`)
  await page.waitForTimeout(700)
  const h1 = await page.locator('h1').first().textContent().catch(() => null)
  if (!h1) {
    failed = true
    errors.push(`[render] ${r}: sin título`)
  }
  await page.screenshot({ path: join(OUT, `${r.replace(/\//g, '_') || 'home'}.png`) })
  console.log(`✓ ${r.padEnd(24)} ${h1 ?? '(sin h1)'}`)
}

// Interacción: tocar teclas con el ratón en el teclado virtual y detectar acorde
await page.goto(`${BASE}/#/keyboard`)
await page.waitForTimeout(500)
// el ratón toca una nota cada vez; para un acorde usamos el teclado del ordenador (A D G = Do Mi Sol)
await page.locator('h1').click()
for (const k of ['KeyA', 'KeyD', 'KeyG']) await page.keyboard.down(k)
await page.waitForTimeout(200)
const chordText = await page.locator('text=Acorde detectado').locator('..').textContent()
for (const k of ['KeyA', 'KeyD', 'KeyG']) await page.keyboard.up(k)
console.log(`✓ acorde detectado tras pulsar Do-Mi-Sol: ${chordText?.replace('Acorde detectado', '').trim()}`)
if (!chordText?.includes('C')) {
  failed = true
  errors.push('[interacción] no se detectó el acorde C')
}

// Simulador del motor de evaluación
await page.goto(`${BASE}/#/settings/simulator`)
await page.getByRole('button', { name: 'Simular y evaluar' }).click()
await page.waitForTimeout(500)
const sim = await page.locator('text=SIMULADOS').first().isVisible()
console.log(`✓ simulador marca el resultado como SIMULADO: ${sim}`)
await page.screenshot({ path: join(OUT, 'simulator-result.png'), fullPage: true })
if (!sim) failed = true

// Práctica en modo guiado con el ratón: completar la primera lección (todos los Do)
await page.goto(`${BASE}/#/learn/l1-keyboard`)
await page.getByRole('button', { name: /Practicar y evaluar/ }).click()
await page.getByRole('button', { name: /Guiado/ }).click()
await page.getByRole('button', { name: 'Empezar' }).click()
await page.waitForTimeout(400)
for (const n of ['Do2', 'Do3', 'Do4', 'Do5', 'Do6', 'Do7']) {
  const key = page.getByRole('button', { name: n, exact: true }).last()
  await key.dispatchEvent('pointerdown')
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')))
  await page.waitForTimeout(1100)
}
await page.waitForTimeout(3500)
const scoreVisible = await page.locator('text=de 100').first().isVisible().catch(() => false)
console.log(`✓ lección guiada completada con ratón, resultado visible: ${scoreVisible}`)
await page.screenshot({ path: join(OUT, 'lesson-result.png') })
if (!scoreVisible) failed = true

await browser.close()
if (errors.length) {
  console.log('\nErrores:')
  for (const e of errors) console.log('  ' + e)
}
process.exit(failed || errors.length ? 1 : 0)
