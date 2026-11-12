import { describe, expect, it } from 'vitest'
import readme from '../../../docs/au3/README.md?raw'
import { listeHypotheses } from '../hypothese'

const DEBUT = '<!-- hypotheses:debut -->'
const FIN = '<!-- hypotheses:fin -->'
/** Accès Node sans dépendre des types Node (le test tourne sous Vitest, dans Node) */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

describe('README du module AU3', () => {
  it('la liste des hypothèses est générée depuis reference.au3.ts (à jour)', async () => {
    const texte = readme.replace(/\r\n/g, '\n')
    const [avant, reste] = texte.split(DEBUT)
    const apres = reste!.split(FIN)[1]
    const attendu = `${avant}${DEBUT}\n${listeHypotheses()}\n${FIN}${apres}`
    if (env.AU3_ECRIRE_README) {
      const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { writeFileSync: (f: string, t: string) => void }
      fs.writeFileSync('docs/au3/README.md', attendu)
      return
    }
    expect(texte).toBe(attendu)
  })
})
