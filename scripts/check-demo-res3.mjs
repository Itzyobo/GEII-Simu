// Démonstration complète du partiel Réseaux (câble, série, ping), vitesse de test ×8, à l'ordinateur et à 375 px :
// aucune erreur console, chaque entourage visible dans la fenêtre au moment où il apparaît, récapitulatif de chaque
// partie, captures à trois moments clés par partie (DEMO_SHOTS=dossier).
// Usage : npm run check:demo-res3
import { chromium } from 'playwright'
import { createServer } from 'vite'

const KEYS = [
  ['ΔY donne Eg', 'même signe', 'On reporte les résultats'],
  ['créneau le plus court', 'On pose la grille', 'Message complet'],
  ['Réglages de la consigne', 'Zoom à 200 ns', 'On reporte L'],
]
const server = await createServer({ server: { port: 0 }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()
const shots = process.env.DEMO_SHOTS
const failures = []
try {
  for (const [name, width] of [
    ['ordinateur', 1440],
    ['375 px', 375],
  ]) {
    const ctx = await browser.newContext({ viewport: { width, height: 860 }, deviceScaleFactor: width < 500 ? 2 : 1 })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await page.goto(base + '/modbus/partiel-reseaux?demo=complet&vitesse=8', { waitUntil: 'networkidle' })
      for (let part = 0; part < 3; part++) {
        const taken = new Set()
        const hidden = new Set()
        for (let i = 0; i < 900 && !(await page.getByTestId('demo-recap').count()); i++) {
          const text = await page.getByTestId('demo-narration').innerText().catch(() => '')
          if (text.startsWith('Démo interrompue')) throw new Error(`partie ${part + 1} : ${text}`)
          // Entourages : la cible doit être dans la fenêtre au moment où elle est entourée
          for (const r of await page.locator('[data-demo-ring][data-shown="0"]').all()) hidden.add(await r.getAttribute('data-demo-ring').catch(() => '?'))
          for (const [j, k] of KEYS[part].entries())
            if (!taken.has(j) && text.includes(k)) {
              taken.add(j)
              if (shots) await page.screenshot({ path: `${shots}/demo-${width}-p${part + 1}-${j + 1}.png` })
            }
          await page.waitForTimeout(200)
        }
        const recap = await page.getByTestId('demo-recap').innerText().catch(() => '')
        if (!recap) throw new Error(`partie ${part + 1} : pas de récapitulatif`)
        if (hidden.size) throw new Error(`partie ${part + 1} : entourage hors de la fenêtre (${[...hidden].join(', ')})`)
        if (shots) await page.screenshot({ path: `${shots}/demo-${width}-p${part + 1}-recap.png` })
        console.log(`  partie ${part + 1} : ${recap.split('\n').slice(0, 2).join(' · ')}`)
        if (part < 2) {
          await page.getByRole('button', { name: 'Partie suivante' }).click()
          await page.getByTestId('demo-recap').waitFor({ state: 'detached', timeout: 60_000 })
        }
      }
      if (errors.length) throw new Error(`console : ${errors.join(' | ')}`)
      console.log(`ok   ${name}`)
    } catch (e) {
      console.log(`ÉCHEC ${name} : ${e.message}`)
      failures.push(name)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  await server.close()
}
if (failures.length) process.exit(1)
console.log('\nDémonstration complète conforme.')
