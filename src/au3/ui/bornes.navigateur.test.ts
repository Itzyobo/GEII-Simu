import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'
import { MISE_EN_PAGE } from '../miseEnPage'

/**
 * Bornes empilables, dans un vrai navigateur (Chromium) : tous les clics sont donnés AUX COORDONNÉES de la souris
 * (page.mouse.click), jamais directement sur l'élément, pour reproduire ce que fait l'étudiant.
 */
let serveur: ViteDevServer
let navigateur: Browser
let base = ''

beforeAll(async () => {
  serveur = await createServer({ server: { port: 0 }, logLevel: 'error' })
  await serveur.listen()
  base = serveur.resolvedUrls!.local[0]!.replace(/\/$/, '')
  navigateur = await chromium.launch()
})
afterAll(async () => {
  await navigateur?.close()
  await serveur?.close()
})

const centre = async (l: Locator) => {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const clic = async (page: Page, l: Locator) => {
  const c = await centre(l)
  await page.mouse.click(c.x, c.y)
}
const borne = (page: Page, id: string) => page.locator(`[data-borne="${id}"]`)
async function cable(page: Page, a: string, b: string, couleur = '#d62828') {
  await clic(page, page.locator(`[role="radio"][aria-label="Couleur ${couleur}"]`))
  await clic(page, borne(page, a))
  await clic(page, borne(page, b))
}
/** Élément sous le centre d'une borne : la borne elle-même (aucune fiche ni aucun fil au-dessus) */
const sousLeCentre = async (page: Page, id: string) => {
  const c = await centre(borne(page, id))
  return page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-borne]')?.getAttribute('data-borne') ?? null, c)
}
async function ouvrir(route: string) {
  const page = await navigateur.newPage({ viewport: { width: 1900, height: 1100 } })
  const erreurs: string[] = []
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && erreurs.push(m.text()))
  page.on('pageerror', (e) => erreurs.push(e.message))
  await page.goto(base + route)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('[data-borne="plat.masse1"]')
  return { page, erreurs }
}

describe('1. bornes déjà câblées (fiches empilées)', () => {
  it('(a) sur une borne déjà câblée, un clic au centre démarre un nouveau câble', async () => {
    const { page, erreurs } = await ouvrir('/au3/libre')
    await cable(page, 'plat.p12', 'plat.ampliIn')
    await cable(page, 'gbf.out', 'plat.p12') // une 2e fiche sur +12 V (court-circuit volontaire : seul le geste compte)
    expect(await sousLeCentre(page, 'plat.p12')).toBe('plat.p12')
    await clic(page, borne(page, 'plat.p12'))
    await expect.poll(() => page.locator('[role="status"]').filter({ hasText: 'Borne choisie' }).textContent()).toContain('Platine · +12 V')
    expect(erreurs).toEqual([])
    await page.close()
  })

  it('(b) TP3 partie I avec 2 câbles sur +12 V : « Faire vérifier » 5/5', async () => {
    const { page, erreurs } = await ouvrir('/au3/tp3')
    await cable(page, 'plat.p12', 'plat.ampliIn')
    await cable(page, 'plat.ampliOut', 'mot.rouge')
    await cable(page, 'mot.noir', 'plat.masse1', MISE_EN_PAGE.cable.couleurs[0])
    await cable(page, 'plat.m12', 'pot.rouge', '#2b6fd6')
    await cable(page, 'plat.p12', 'pot.bleue') // 2e câble sur +12 V
    await cable(page, 'pot.verte', 'osc.v2', '#2a9d3f')
    expect(await sousLeCentre(page, 'plat.p12')).toBe('plat.p12')
    await clic(page, page.getByRole('button', { name: 'Faire vérifier' }).first())
    await expect.poll(() => page.locator('[role="status"]').filter({ hasText: 'Vérification' }).first().textContent()).toContain('5/5 liaisons correctes')
    expect(erreurs).toEqual([])
    await page.close()
  })

  it('(c) une masse portant 3 câbles reste utilisable : borne cliquable, chaque fiche sélectionne son câble', async () => {
    const { page, erreurs } = await ouvrir('/au3/libre')
    const noir = MISE_EN_PAGE.cable.couleurs[0]
    for (const autre of ['mot.noir', 'mot.jaune', 'plat.ampliIn']) await cable(page, 'plat.masse1', autre, noir)
    expect(await page.locator('[data-fiche$="@plat.masse1"]').count()).toBe(3)
    expect(await sousLeCentre(page, 'plat.masse1')).toBe('plat.masse1')
    // Chaque fiche est visible sous la souris (aucune n'en recouvre une autre) et sélectionne son câble
    const fiches = await page.locator('[data-fiche$="@plat.masse1"]').all()
    for (const [i, f] of fiches.entries()) {
      const c = await centre(f)
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-fiche') ?? null, c)).toBe(await f.getAttribute('data-fiche'))
      await page.mouse.click(c.x, c.y)
      await expect.poll(() => page.locator('text=/^Câble /').first().textContent()).toContain(['MOTEUR 1 · Alim moteur (noire)', 'MOTEUR 1 · Sortie DT (jaune)', 'Entrée ampli de courant'][i]!)
    }
    // Retirer le 2e câble par sa fiche, puis 4e câble sur la masse : la borne démarre toujours un câble
    await clic(page, page.locator('[data-fiche$="@plat.masse1"]').nth(1))
    await clic(page, page.getByRole('button', { name: 'Débrancher', exact: true }))
    expect(await page.locator('[data-fiche$="@plat.masse1"]').count()).toBe(2)
    await cable(page, 'plat.masse1', 'mot.jaune', noir)
    expect(await page.locator('[data-fiche$="@plat.masse1"]').count()).toBe(3)
    expect(erreurs).toEqual([])
    await page.close()
  })
})
