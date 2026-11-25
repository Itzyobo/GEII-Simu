// Banc TP1 branchable, à l'ordinateur (souris, glisser-déposer) et à 375 px (doigt, toucher puis BNC) :
// montage 3.2.2 b, vérification du montage attendu, passage en court-circuit, ohmmètre, rangement.
// Échoue si une étape ne donne pas le montage attendu, si la page déborde ou si la console affiche une erreur.
// Usage : npm run check:banc-tp1
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 0 }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()
const failures = []
const shots = process.env.BANC_SHOTS

const expectText = async (page, text, what) => {
  const got = (await page.getByTestId('montage').innerText()).replace(/\s+/g, ' ')
  if (!got.includes(text)) throw new Error(`${what} : attendu « ${text} », obtenu « ${got} »`)
}

try {
  for (const [name, width, touch] of [
    ['ordinateur', 1440, false],
    ['375 px', 375, true],
  ]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await page.goto(base + '/modbus/tp1', { waitUntil: 'networkidle' })
      await page.evaluate(() => localStorage.setItem('tp-sim:res3-tp1:seed', '3'))
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      const center = async (loc) => {
        await loc.scrollIntoViewIfNeeded()
        const b = await loc.boundingBox()
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      }
      /** Glisser-déposer à la souris */
      const dragTo = async (item, target) => {
        // Les deux bouts doivent être visibles en même temps : on mesure après défilement
        await item.scrollIntoViewIfNeeded()
        const box = async (l) => {
          const r = await l.boundingBox()
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
        }
        const a = await box(item)
        const b = await box(target)
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 })
        await page.mouse.move(b.x, b.y, { steps: 6 })
        await page.mouse.up()
        await page.waitForTimeout(250)
      }
      /** Toucher la fiche, puis toucher la BNC en surbrillance */
      const tapTo = async (itemLabel, targetLabel) => {
        const item = page.getByRole('button', { name: itemLabel }).first()
        await item.scrollIntoViewIfNeeded()
        if (touch) await item.tap()
        else await item.click()
        const t = page.getByRole('button', { name: `Brancher ${targetLabel}` })
        await t.scrollIntoViewIfNeeded()
        if (touch) await t.tap()
        else await t.click()
        await page.waitForTimeout(250)
      }

      // Montage 3.2.2 b : générateur → cordon → Té sur CH1 → câble → extrémité ouverte
      if (!touch) {
        await dragTo(page.getByRole('button', { name: 'cordon 1 m (bout A) (libre)' }), page.locator('[data-port="gen"]'))
        await dragTo(page.getByRole('button', { name: /^Té n° 1 \(glisser/ }), page.locator('[data-port="scope-ch1"]').first())
      } else {
        await tapTo('cordon 1 m (bout A) (libre)', 'cordon 1 m (bout A) sur sortie du générateur')
        await tapTo(/^Té n° 1 \(glisser/, 'Té n° 1 sur entrée CH1')
      }
      await tapTo('cordon 1 m (bout B) (libre)', 'cordon 1 m (bout B) sur Té n° 1 (bras gauche)')
      await tapTo('câble long (bout A) (libre)', 'câble long (bout A) sur Té n° 1 (bras droit)')
      await expectText(page, 'générateur → cordon → CH1 → câble long → extrémité ouverte', '3.2.2 b')
      const ok = await page.getByText('générateur → Té sur CH1 → câble → extrémité ouverte — conforme').count()
      if (!ok) throw new Error('3.2.2 b : indicateur de montage non conforme')
      if (shots) await page.screenshot({ path: `${shots}/banc-${touch ? '375' : 'desktop'}-322b.png`, fullPage: false })

      // Court-circuit au bout : Té posé sur un support, câble sur un bras, bouchon CC sur l'autre
      await tapTo(/^Té n° 2 \(glisser/, 'Té n° 2 sur support n° 1 du plateau')
      await tapTo('câble long (bout B) (libre)', 'câble long (bout B) sur Té n° 2 (bras gauche)')
      await tapTo(/^bouchon court-circuit \(glisser/, 'bouchon court-circuit sur Té n° 2 (bras droit)')
      await expectText(page, 'câble long → court-circuit', '3.2.2 c')
      if (!(await page.getByText('… → câble → court-circuit — conforme').count())) throw new Error('3.2.2 c : indicateur de montage non conforme')

      // Ohmmètre : lisible potentiomètre débranché
      const ohm = await page.getByTestId('ohmmetre').innerText()
      if (!/Ω/.test(ohm)) throw new Error(`ohmmètre illisible : ${ohm}`)

      // Débrancher : ranger le banc
      await page.getByRole('button', { name: 'Ranger le banc' }).click()
      await expectText(page, 'n’est relié à rien', 'rangement')
      await page.getByRole('button', { name: 'Montage précédent' }).click()
      await expectText(page, 'court-circuit', 'montage précédent')

      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
      if (scroll > client) throw new Error(`débordement ${scroll} > ${client} px`)
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
console.log('\nBanc TP1 : montages conformes.')
