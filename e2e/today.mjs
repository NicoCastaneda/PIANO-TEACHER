// Práctica de hoy, oído y acompañar con cifrados, con el teclado del ordenador (A=Do, W=Do#, S=Re…).
// Uso: node e2e/today.mjs   (con la app en marcha en :5180)
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5180'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const fail = (msg) => {
  console.error('✗', msg)
  process.exitCode = 1
}

const PC_KEY = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ']
const NAME_PC = { Do: 0, 'Do#': 1, Reb: 1, Re: 2, 'Re#': 3, Mib: 3, Mi: 4, Fa: 5, 'Fa#': 6, Solb: 6, Sol: 7, 'Sol#': 8, Lab: 8, La: 9, 'La#': 10, Sib: 10, Si: 11 }
const tap = async (key, ms = 160) => {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
  await page.waitForTimeout(90)
}

// ── 1. Oído: reconocer (responde con botones) ──
await page.goto(`${BASE}/#/practice/oido?ej=quality`)
await page.getByText('Escuchar otra vez').first().waitFor()
await page.keyboard.press('Digit1')
await page.locator('text=/¡Correcto!|Era «/').first().waitFor({ timeout: 3000 })
console.log('✓ reconocer: respuesta evaluada')

// ── 2. Oído: repetir la melodía (se muestran las notas y se tocan en orden) ──
await page.goto(`${BASE}/#/practice/oido?ej=play-melody`)
await page.getByText('Repite la melodía').first().waitFor()
await page.getByRole('button', { name: 'Mostrar notas' }).click()
const names = (await page.locator('[aria-label="Progreso de la melodía"] > div').allInnerTexts()).map((t) => t.trim())
for (const n of names) {
  if (!(n in NAME_PC)) fail(`nombre de nota inesperado: ${n}`)
  await tap(PC_KEY[NAME_PC[n]])
}
await page.getByText('Completada con las notas a la vista').waitFor({ timeout: 3000 })
console.log('✓ melodía de oído:', names.join(' '), '→ completada (vale cualquier octava)')

// ── 3. Acompañar con cifrados: Estrellita, sección A, tocando la fundamental en cada cambio ──
await page.goto(`${BASE}/#/songs/twinkle/acompanar`)
await page.getByText('Hoja de cifrados').waitFor()
await page.locator('select[aria-label="Sección"]').selectOption('a1')
await page.waitForTimeout(300)
// A: C C F C F C G C (2 pulsos cada uno) a 90 BPM; el 4.º se toca mal (Re) y el 7.º se omite.
// Las dos C del principio son un solo acorde → se evalúan 7: 5 bien, 1 fuera del acorde, 1 omitido
const chordKeys = ['KeyA', 'KeyA', 'KeyF', 'KeyS', 'KeyF', 'KeyA', null, 'KeyA']
await page.getByRole('button', { name: 'Empezar', exact: true }).click()
const t0 = Date.now()
const beat = 60000 / 90
const countIn = 4 * beat + 80
for (let i = 0; i < chordKeys.length; i++) {
  const target = t0 + countIn + i * 2 * beat + 20
  while (Date.now() < target) await new Promise((r) => setTimeout(r, 2))
  if (!chordKeys[i]) continue
  await page.keyboard.down(chordKeys[i])
  await new Promise((r) => setTimeout(r, beat))
  await page.keyboard.up(chordKeys[i])
}
await page.getByTestId('comp-strip').waitFor({ timeout: 6000 })
const compScore = await page.locator('text=de 100').locator('xpath=preceding-sibling::div[1]').innerText()
console.log('✓ acompañar: puntuación =', compScore, '(esperado 71: 100 × 5/7)')
if (compScore.trim() !== '71') fail('puntuación de acompañamiento inesperada')
await page.screenshot({ path: 'e2e/screenshots/accompany-result.png' })

// ── 4. Práctica de hoy: tarjetas (6 aciertos), luego saltar el resto y ver el resumen ──
const KEYS = {
  'Do mayor': [
    ['KeyA', 'KeyD', 'KeyG'],
    ['KeyD', 'KeyG', 'KeyK'],
    ['KeyG', 'KeyK', 'Semicolon'],
  ],
  'Fa mayor': [
    ['KeyF', 'KeyH', 'KeyK'],
    ['KeyH', 'KeyK', 'Semicolon'],
    ['KeyA', 'KeyF', 'KeyH'],
  ],
  'Sol mayor': [['KeyG', 'KeyJ', 'KeyL'], null, ['KeyS', 'KeyG', 'KeyJ']],
}
const INV = { 'Estado fundamental': 0, '1.ª inversión': 1, '2.ª inversión': 2 }
await page.goto(`${BASE}/#/hoy`)
await page.getByRole('heading', { name: 'Práctica de hoy' }).waitFor()
const steps = await page.locator('ol[aria-label="Pasos"] > li').count()
console.log('✓ plan del día con', steps, 'pasos')
const main = page.locator('main')
for (let i = 0; i < 6; i++) {
  const text = await main.locator('.animate-pop').first().innerText()
  const name = Object.keys(KEYS).find((n) => text.includes(n))
  const invText = await main.locator('.animate-pop').first().locator('xpath=following-sibling::div[1]').innerText()
  const keys = KEYS[name][INV[invText.trim()]]
  for (const k of keys) await page.keyboard.down(k)
  await page.waitForTimeout(350)
  for (const k of keys) await page.keyboard.up(k)
  await page.getByText('¡Correcto!').first().waitFor({ timeout: 3000 })
  await page.waitForTimeout(1300)
}
await page.getByText('Paso completado').waitFor({ timeout: 3000 })
console.log('✓ paso de tarjetas completado')
await page.getByRole('button', { name: /Siguiente paso/ }).click()
for (let i = 1; i < steps; i++) await page.getByRole('button', { name: 'Saltar' }).first().click()
await page.getByText(`Resumen de hoy: 1 de ${steps} pasos`).waitFor({ timeout: 3000 })
const cardsDetail = await page.getByText('6/6 tarjetas a la primera').count()
console.log('✓ resumen: 1 paso hecho (6/6 tarjetas), el resto saltado:', cardsDetail > 0)
if (!cardsDetail) fail('no aparece el resultado de las tarjetas')
await page.screenshot({ path: 'e2e/screenshots/today-summary.png', fullPage: true })

// el plan se conserva al recargar
await page.reload()
await page.getByText(`Resumen de hoy: 1 de ${steps} pasos`).waitFor({ timeout: 3000 })
await page.goto(`${BASE}/#/`)
await page.getByText(/Continuar \(\d\/\d\)|Ver resumen/).waitFor({ timeout: 3000 })
console.log('✓ plan guardado y visible en Inicio')
await page.goto(`${BASE}/#/practice/oido`)
await page.waitForTimeout(300)
await page.screenshot({ path: 'e2e/screenshots/ear.png' })

await browser.close()
if (errors.length) fail(`errores en consola: ${errors.join(' | ')}`)
if (!process.exitCode) console.log('OK today')
