// Réécrit la « Liste des hypothèses à vérifier » du PRD (§3) depuis HYPOTHESES de src/modbus/data/reference.ts.
// Usage : npm run sync:prd (le test data.test.ts échoue tant que la liste n'est pas synchronisée).
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const PRD = 'PRD — Simulateur TP2 Liaison série MODBUS.md'
const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
try {
  const { HYPOTHESES } = await server.ssrLoadModule('/src/modbus/data/reference.ts')
  const { listeHypotheses } = await server.ssrLoadModule('/src/modbus/data/prd.ts')
  const texte = readFileSync(PRD, 'utf8')
  const lignes = texte.split('\n')
  const debut = lignes.findIndex((l) => /^\d+\. H\d+ — /.test(l))
  let fin = debut
  while (fin < lignes.length && /^\d+\. H\d+ — /.test(lignes[fin])) fin++
  if (debut < 0) throw new Error('liste des hypothèses introuvable dans le PRD')
  lignes.splice(debut, fin - debut, ...listeHypotheses(HYPOTHESES))
  writeFileSync(PRD, lignes.join('\n'))
  console.log(`${PRD} : ${Object.keys(HYPOTHESES).length} hypothèses synchronisées.`)
} finally {
  await server.close()
}
