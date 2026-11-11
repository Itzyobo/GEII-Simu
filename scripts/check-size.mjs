// Budgets de taille INFO3 (PRD §5.1) : construit le site, l'ouvre dans Chromium et échoue si
// - une page INFO3 + Worker (+ le plus gros professeur chargé à la demande) dépasse INFO3.budget.pageWithWorkerKb gzip ;
// - le bundle initial dépasse la base + la marge.
// L'examen est mesuré au moment de la remise (feuille de notes et corrections chargées). Usage : npm run check:size
import { build, createServer, preview } from 'vite'
import { chromium } from 'playwright'
import fs from 'node:fs'
import zlib from 'node:zlib'

// Build de production d'abord : createServer (lecture des constantes) passe NODE_ENV en développement
process.env.NODE_ENV = 'production'
await build({ logLevel: 'error', mode: 'production' })
const ssr = await createServer({ server: { middlewareMode: true, hmr: false }, logLevel: 'error' })
const { INFO3 } = await ssr.ssrLoadModule('/src/data/reference.ts')
await ssr.close()
const B = INFO3.budget
const assets = 'dist/assets'
const gz = (file) => zlib.gzipSync(fs.readFileSync(file)).length / 1024
const files = fs.readdirSync(assets)
const one = (re) => files.find((f) => re.test(f))
const worker = gz(`${assets}/${one(/^sim\.worker-.*\.js$/)}`)
// Professeurs chargés à la demande dans le Worker : on compte le plus gros (et tp23, importé par tp4)
const graders = files.filter((f) => /^tp(\d|23)-.*\.js$/.test(f)).map((f) => gz(`${assets}/${f}`))
const grader = Math.max(...graders) + gz(`${assets}/${one(/^tp23-.*\.js$/)}`)
const entry = /<script type="module"[^>]*src="\/([^"]+)"/.exec(fs.readFileSync('dist/index.html', 'utf8'))[1]
const initial = gz(`dist/${entry}`)

const server = await preview({ preview: { port: 0 }, logLevel: 'error' })
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const loaded = new Set()
page.on('request', (r) => r.url().endsWith('.js') && loaded.add(new URL(r.url()).pathname))
const sum = (paths) => [...paths].reduce((t, p) => t + gz(`dist${p}`), 0)

await page.goto(base + '/')
await page.waitForLoadState('networkidle')
const home = new Set(loaded)
const failures = []
const rows = []
async function measure(route, act) {
  loaded.clear()
  await page.goto(base + route)
  await page.waitForLoadState('networkidle')
  if (act) await act()
  // Éditeur (CodeMirror) à part, comme le budget du PRD ; le Worker et un professeur s'ajoutent
  const own = [...loaded].filter((p) => !home.has(p) && !p.includes('CodeEditor') && !p.includes('sim.worker') && !/\/tp(\d|23)-/.test(p))
  const total = sum(own) + worker + grader
  rows.push([route, sum(own), total])
  if (total > B.pageWithWorkerKb) failures.push(`${route} : ${total.toFixed(1)} Ko > ${B.pageWithWorkerKb} Ko`)
}
for (const r of ['/info3', '/info3/tp1', '/info3/tp2', '/info3/tp3', '/info3/tp4', '/info3/tp5', '/info3/tp6', '/info3/libre', '/info3/hypotheses']) await measure(r)
await measure('/info3/examen (remise)', async () => {
  await page.goto(base + '/info3/examen')
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Commencer l’épreuve' }).click()
  await page.getByRole('button', { name: 'Remettre la copie' }).click()
  await page.getByLabel('Feuille de notes').waitFor()
  await page.waitForLoadState('networkidle')
})
await browser.close()
server.httpServer.close()

console.log(`Worker ${worker.toFixed(1)} Ko, plus gros professeur (+ tp23) ${grader.toFixed(1)} Ko`)
for (const [r, own, total] of rows) console.log(`${r.padEnd(26)} page ${own.toFixed(1).padStart(6)} Ko   + Worker + professeur ${total.toFixed(1).padStart(6)} Ko`)
const limit = B.initialBaseKb + B.initialMarginKb
console.log(`Bundle initial ${initial.toFixed(2)} Ko (limite ${limit.toFixed(2)} Ko = base ${B.initialBaseKb} + ${B.initialMarginKb})`)
if (initial > limit) failures.push(`bundle initial : ${initial.toFixed(2)} Ko > ${limit.toFixed(2)} Ko`)
if (failures.length) {
  console.error(`\nBudgets dépassés :\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('\nBudgets respectés.')
