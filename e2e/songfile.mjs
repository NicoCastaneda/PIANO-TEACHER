// Comprueba que una canción de canciones/*.json aparece en la app y se puede abrir.
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5180'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(`${BASE}/#/songs`)
await page.getByText('Crear una canción con Claude Code').waitFor()
const created = page.getByRole('heading', { name: 'Creadas con Claude Code' })
if (await created.count()) {
  const card = page.locator('a[href*="#/songs/cancion-"]').first()
  const href = await card.getAttribute('href')
  await card.click()
  await page.getByText('Secciones').first().waitFor()
  console.log('Canción de archivo abierta:', href)
} else console.log('No hay canciones en canciones/ (nada que abrir).')
await page.goto(`${BASE}/#/settings/ai`)
await page.getByText('IA con Claude Code (sin clave de API)').waitFor()
await page.goto(`${BASE}/#/progress`)
await page.waitForTimeout(500)
await browser.close()
if (errors.length) {
  console.error('Errores en consola:', errors)
  process.exit(1)
}
console.log('OK songfile')
