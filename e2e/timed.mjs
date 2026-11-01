// Prueba de interfaz del modo con tempo: toca la escala de Do mayor con el teclado del ordenador
// en los instantes exactos (una nota tarde y una omitida a propósito) y comprueba la evaluación.
// Uso: node e2e/timed.mjs [carpetaCapturas]   (con la app en marcha en :5180)
import { chromium } from 'playwright'
const shots = process.argv[2] ?? 'e2e/screenshots'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await page.goto('http://localhost:5180/#/practice')
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Empezar' }).click()
const t0 = Date.now()
const beat = 60000 / 72
const countIn = 4 * beat + 80
const keys = ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyJ','KeyH','KeyG','KeyF','KeyD','KeyS','KeyA']
for (let i = 0; i < keys.length; i++) {
  const target = t0 + countIn + i * beat + (i === 5 ? 120 : 0) // una nota deliberadamente tarde
  while (Date.now() < target) await new Promise((r) => setTimeout(r, 2))
  if (i === 10) continue // una nota omitida a propósito
  await page.keyboard.down(keys[i])
  await new Promise((r) => setTimeout(r, beat * 0.7))
  await page.keyboard.up(keys[i])
  if (i === 3) await page.screenshot({ path: shots + '/timed-live.png' })
}
await page.waitForTimeout(2500)
const txt = await page.locator('text=de 100').first().locator('..').textContent().catch(() => null)
console.log('score block:', txt)
const stats = await page.locator('.card-flat').allTextContents()
console.log(stats.slice(0, 9).join(' | '))
await page.screenshot({ path: shots + '/timed-result.png' })
await page.goto('http://localhost:5180/#/progress')
await page.waitForTimeout(800)
const rows = await page.locator('table tbody tr').count()
console.log('filas en el historial:', rows)
await page.screenshot({ path: shots + '/progress-with-data.png', fullPage: true })
console.log('errors:', errs)
if (errs.length || rows < 1) process.exitCode = 1
await browser.close()
