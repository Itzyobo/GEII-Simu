// Parcours complet du partiel Réseaux en mode entraînement, à 375 px et sur ordinateur : démarrer avec une graine,
// saisir les réponses justes (calculées par src/lib/reseaux/partiel.ts), changer d'onglet, rendre, lire la note.
// Échoue si la note n'est pas 20/20, si la page déborde ou si la console affiche une erreur.
// Usage : npm run check:partiel-res3
import { chromium } from 'playwright'
import { createServer } from 'vite'

const SEED = 2468
const server = await createServer({ server: { port: 0 }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const { subjectOf, correctAnswers, levelFr } = await server.ssrLoadModule('/src/lib/reseaux/partiel.ts')
const { parityFr } = await server.ssrLoadModule('/src/lib/reseaux/serial.ts')
const a = correctAnswers(subjectOf(SEED))

const browser = await chromium.launch()
const failures = []
try {
  for (const [name, width] of [
    ['375 px', 375],
    ['ordinateur', 1440],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(base + '/modbus/partiel-reseaux', { waitUntil: 'networkidle' })
    await page.evaluate(() => sessionStorage.clear())
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByLabel('Graine du sujet').fill(String(SEED))
    await page.getByLabel('Entraînement sans chrono').check()
    await page.getByRole('button', { name: 'Démarrer' }).click()

    await page.getByLabel('Zc (Ω)').fill(a.cable.zc)
    await page.getByLabel('Longueur l (m)').fill(a.cable.l)
    await page.getByLabel('Γ en circuit ouvert').fill(a.cable.gammaOpen)
    await page.getByLabel('Γ en court-circuit').fill(a.cable.gammaShort)
    await page.getByLabel('Méthode utilisée pour Zc').selectOption(a.cable.methode)

    await page.getByRole('tab', { name: /Trame série/ }).click()
    await page.getByLabel('Débit (bauds)').fill(a.serie.baud)
    await page.getByLabel('Parité').selectOption({ label: parityFr(a.serie.parity) })
    await page.getByLabel('Norme').selectOption({ label: levelFr(a.serie.level) })
    await page.getByLabel('Message (casse comprise)').fill(a.serie.message)

    await page.getByRole('tab', { name: /Ping Ethernet/ }).click()
    await page.getByLabel('L (octets) : ping -l L').fill(a.ping.L)
    await page.getByLabel('Octets de bourrage').fill(a.ping.padding)
    await page.getByLabel('Durée de la trame sur le câble (µs)').fill(a.ping.durationUs)
    await page.getByLabel('1er octet de la MAC destination (hexa)').fill(a.ping.macByte)

    // Reprise après rechargement : les réponses sont toujours là
    await page.reload({ waitUntil: 'networkidle' })
    const kept = await page.getByLabel('1er octet de la MAC destination (hexa)').inputValue()
    await page.waitForTimeout(300)
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))

    await page.getByRole('button', { name: 'Rendre', exact: true }).click()
    await page.getByRole('button', { name: 'Oui, rendre' }).click()
    const note = (await page.getByTestId('note-partiel').innerText()).trim()
    const ok = note === '20 / 20' && kept === a.ping.macByte && scroll <= client && errors.length === 0
    console.log(`${ok ? 'ok  ' : 'ÉCHEC'} ${name} : note ${note}, reprise ${kept === a.ping.macByte ? 'ok' : 'perdue'}${scroll > client ? `, débordement ${scroll} > ${client}` : ''}${errors.map((e) => `\n      console : ${e}`).join('')}`)
    if (!ok) failures.push(name)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
if (failures.length) {
  console.error(`\nPartiel Réseaux en échec : ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nPartiel Réseaux : parcours complet conforme.')
