// Entrenador de acordes: tarjetas y examen con el teclado del ordenador (A=Do, W=Do#, S=Re…).
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5180'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

// Teclas del ordenador para C, F y G mayor (octava de Do central) en cada inversión
const KEYS = {
  'Do mayor': [['KeyA', 'KeyD', 'KeyG'], ['KeyD', 'KeyG', 'KeyK'], ['KeyG', 'KeyK', 'Semicolon']],
  'Fa mayor': [['KeyF', 'KeyH', 'KeyK'], ['KeyH', 'KeyK', 'Semicolon'], ['KeyA', 'KeyF', 'KeyH']],
  'Sol mayor': [['KeyG', 'KeyJ', 'KeyL'], ['KeyJ', 'KeyL', 'KeyO'], ['KeyS', 'KeyG', 'KeyJ']],
}
const INV = { 'Estado fundamental': 0, '1.ª inversión': 1, '2.ª inversión': 2 }

async function play(keys) {
  for (const k of keys) await page.keyboard.down(k)
  await page.waitForTimeout(350)
  for (const k of keys) await page.keyboard.up(k)
  await page.waitForTimeout(150)
}
async function prompt(root) {
  const text = await root.locator('.animate-pop').first().innerText()
  const name = Object.keys(KEYS).find((n) => text.includes(n))
  const invText = await root.locator('.animate-pop').first().locator('xpath=following-sibling::div[1]').innerText()
  return { name, inv: INV[invText.trim()] }
}

await page.goto(`${BASE}/#/learn`)
await page.getByText('Entrenador de acordes').first().click()
await page.getByRole('heading', { name: /Las tres de Do/ }).waitFor()

// Tarjetas: 3 aciertos seguidos
const main = page.locator('main')
for (let i = 0; i < 3; i++) {
  const p = await prompt(main)
  await play(KEYS[p.name][p.inv])
  await page.getByText('¡Correcto!').first().waitFor({ timeout: 3000 })
  await page.waitForTimeout(1300)
}
const aciertos = await page.locator('text=Aciertos').first().locator('xpath=preceding-sibling::div[1]').innerText()
console.log('✓ tarjetas: aciertos en la sesión =', aciertos)

// Mano izquierda: una octava más abajo (Z baja la octava del teclado del ordenador) → correcto y sin aviso de zona
await page.getByRole('button', { name: 'Mano izquierda' }).click()
await page.getByText('con la mano izquierda').first().waitFor()
await page.keyboard.press('KeyZ')
{
  const p = await prompt(main)
  await play(KEYS[p.name][p.inv])
  await page.getByText('¡Correcto!').first().waitFor({ timeout: 3000 })
  const hint = await page.getByText('Para la izquierda').count()
  console.log('✓ mano izquierda: correcto en la zona grave, sin aviso de zona:', hint === 0)
  if (hint) process.exit(1)
}
await page.keyboard.press('KeyX')
await page.getByRole('button', { name: 'Mano derecha' }).click()
await page.waitForTimeout(1300)

// Examen: 5 preguntas, solo fundamental, grupo f1; la primera con la inversión equivocada
await page.goto(`${BASE}/#/learn/acordes?tab=examen`)
await page.getByRole('button', { name: 'Solo fundamental' }).click()
await page.getByRole('button', { name: '5', exact: true }).click()
await page.getByRole('button', { name: /Empezar examen/ }).click()
for (let i = 0; i < 5; i++) {
  await page.getByText(`Pregunta ${i + 1} / 5`).waitFor()
  const p = await prompt(main)
  await play(KEYS[p.name][i === 0 ? 1 : p.inv])
  await page.waitForTimeout(i === 0 ? 1900 : 900)
}
await page.getByText('de 100').waitFor()
const score = await page.locator('text=de 100').locator('xpath=preceding-sibling::div[1]').innerText()
console.log('✓ examen: puntuación =', score, '(esperado 90: 4 correctas + 1 inversión equivocada)')
const saved = await page.getByText('Guardado en Progreso.').count()
await page.goto(`${BASE}/#/progress`)
const examRow = await page.locator('td', { hasText: 'Examen' }).count()
console.log('✓ guardado en Progreso:', saved > 0 && examRow > 0)

// Progresiones y consejos
await page.goto(`${BASE}/#/learn/acordes?tab=progresiones`)
await page.getByText('Derecha: 1.ª inversión').first().waitFor()
await page.goto(`${BASE}/#/learn/acordes?tab=consejos`)
await page.getByText('La escalera de inversiones').waitFor()
await page.screenshot({ path: 'e2e/screenshots/chords-tips.png', fullPage: true })
await page.goto(`${BASE}/#/learn/acordes`)
await page.waitForTimeout(400)
await page.screenshot({ path: 'e2e/screenshots/chords-cards.png' })
await browser.close()
if (errors.length) {
  console.error('Errores en consola:', errors)
  process.exit(1)
}
if (score.trim() !== '90' || !(saved > 0 && examRow > 0)) process.exit(1)
console.log('OK chords')
