// Contrôle mobile : ouvre chaque route à 375 px et échoue si la page déborde horizontalement
// (scrollWidth > clientWidth) ou si la console affiche une erreur. Usage : npm run check:375
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 0 }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')

const { TPS } = await server.ssrLoadModule('/src/pages/tps.ts')
const { MODBUS_PAGES } = await server.ssrLoadModule('/src/modbus/routes.ts')
const { CHAPITRES } = await server.ssrLoadModule('/src/cours/chapitres.ts')
// Routes de premier niveau : à tenir à jour avec src/main.tsx
const routes = ['/', '/ener', ...TPS.map((t) => `/tp/${t.slug}`), '/examen-blanc', '/demo', '/ener/cours', ...CHAPITRES.map((c) => `/ener/cours/${c.slug}`), ...MODBUS_PAGES.map(([p]) => (p ? `/modbus/${p}` : '/modbus')), '/info3', '/info3/tp1', '/info3/tp2', '/info3/tp3', '/info3/tp4', '/info3/tp5', '/info3/tp6', '/info3/examen', '/info3/hypotheses', '/info3/libre', '/info3/dev']

const browser = await chromium.launch()
const failures = []
try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(base + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    const ok = scroll <= client && errors.length === 0
    console.log(`${ok ? 'ok  ' : 'ÉCHEC'} ${route}${scroll > client ? `  débordement ${scroll} > ${client} px` : ''}${errors.map((e) => `\n      console : ${e}`).join('')}`)
    if (!ok) failures.push(route)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
if (failures.length) {
  console.error(`\n${failures.length} route(s) en échec à 375 px : ${failures.join(', ')}`)
  process.exit(1)
}
console.log(`\n${routes.length} routes conformes à 375 px.`)
