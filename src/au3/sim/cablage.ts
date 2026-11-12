import { MISE_EN_PAGE } from '../miseEnPage'

/**
 * Câblage = graphe de bornes nommées. Seules les liaisons que l'étudiant fait au labo sont des câbles ;
 * le reste (secteur, ±12 V internes de la platine, liaison mécanique moteur–DT, masses des BNC du GBF et
 * de l'oscilloscope) est pré-câblé. Toutes les masses de la platine sont équivalentes.
 */

export const BORNES = {
  'gbf.out': { appareil: 'GBF', nom: 'MAIN OUT 50 Ω' },
  'osc.v1': { appareil: 'Oscilloscope', nom: 'Voie 1 (jaune)' },
  'osc.v2': { appareil: 'Oscilloscope', nom: 'Voie 2 (verte)' },
  'osc.v3': { appareil: 'Oscilloscope', nom: 'Voie 3 (bleue)' },
  'osc.v4': { appareil: 'Oscilloscope', nom: 'Voie 4 (rose)' },
  'plat.consigne': { appareil: 'Platine', nom: 'Consigne' },
  'plat.mesure': { appareil: 'Platine', nom: 'Mesure' },
  'plat.erreur': { appareil: 'Platine', nom: 'Erreur' },
  'plat.sortieG2': { appareil: 'Platine', nom: 'Sortie G2 (<25 mA)' },
  'plat.ampliIn': { appareil: 'Platine', nom: 'Entrée ampli de courant' },
  'plat.ampliOut': { appareil: 'Platine', nom: 'Sortie ampli de courant (<1 A)' },
  'plat.p12': { appareil: 'Platine', nom: '+12 V' },
  'plat.m12': { appareil: 'Platine', nom: '−12 V' },
  'plat.masse1': { appareil: 'Platine', nom: 'Masse' },
  'plat.masse2': { appareil: 'Platine', nom: 'Masse' },
  'plat.masse3': { appareil: 'Platine', nom: 'Masse' },
  'plat.masse4': { appareil: 'Platine', nom: 'Masse' },
  'mot.rouge': { appareil: 'MOTEUR 1', nom: 'Alim moteur (rouge)' },
  'mot.noir': { appareil: 'MOTEUR 1', nom: 'Alim moteur (noire)' },
  'mot.verte': { appareil: 'MOTEUR 1', nom: 'Sortie DT (verte)' },
  'mot.jaune': { appareil: 'MOTEUR 1', nom: 'Sortie DT (jaune)' },
} as const satisfies Record<string, { appareil: string; nom: string }>

export type Borne = keyof typeof BORNES
export const TOUTES_BORNES = Object.keys(BORNES) as Borne[]
export const MASSES: readonly Borne[] = ['plat.masse1', 'plat.masse2', 'plat.masse3', 'plat.masse4']
export const nomBorne = (b: Borne) => `${BORNES[b].appareil} · ${BORNES[b].nom}`

export interface Cable {
  id: string
  a: Borne
  b: Borne
  couleur: string
}
export type Cablage = readonly Cable[]

/** Liaison attendue par l'énoncé ; « masse » = n'importe quelle masse de la platine */
export interface Liaison {
  a: Borne | 'masse'
  b: Borne | 'masse'
  /** Intitulé de l'énoncé (docs/au3/enonce.md) */
  nom: string
}

/** TP1, « Câblages à réaliser (platine éteinte) », liaisons 1 à 6 */
export const MONTAGE_TP1: readonly Liaison[] = [
  { a: 'gbf.out', b: 'plat.ampliIn', nom: '1. Alimentez l’amplificateur de courant avec la sortie MAIN OUT de droite (50Ω) du GBF.' },
  { a: 'plat.ampliOut', b: 'mot.rouge', nom: '2. Reliez la sortie de l’amplificateur de courant à l’entrée d’alimentation du moteur (rouge).' },
  { a: 'mot.noir', b: 'masse', nom: '3. Reliez l’autre borne d’alimentation du moteur (noire) à une masse de la platine Régulateur Analogique avec un cable noir.' },
  { a: 'mot.verte', b: 'osc.v2', nom: '4. Reliez la sortie du capteur de vitesse (Dynamo Tachymétrique) (borne verte) à la voie verte de l’oscilloscope.' },
  { a: 'mot.jaune', b: 'masse', nom: '5. Reliez l’autre borne de sortie DT (jaune) à une masse de la platine Régulateur Analogique.' },
  { a: 'gbf.out', b: 'osc.v1', nom: '6. Reliez la sortie MAIN OUT de droite du GBF à la voie jaune de l’oscilloscope.' },
]

/**
 * TP2, « Câblages à réaliser (en boucle fermée cette fois) », liaisons numérotées comme l'énoncé : 1 à 6 puis 8 à 10
 * (la 7 n'existe pas dans l'énoncé). Aucune ne relie la consigne à la voie 1 : voir PRECABLAGE_TP2.
 */
export const MONTAGE_TP2: readonly Liaison[] = [
  { a: 'gbf.out', b: 'plat.consigne', nom: '1. Alimentez l’entrée de consigne (verte) de la platine régulation avec la sortie MAIN OUT de droite du GBF.' },
  { a: 'plat.sortieG2', b: 'plat.ampliIn', nom: '2. Reliez la sortie de l’amplificateur G2 (<25 mA) de la platine régulation à l’entrée de l’amplificateur de courant (verte)' },
  { a: 'plat.ampliOut', b: 'mot.rouge', nom: '3. Reliez la sortie bleue de l’amplificateur de courant (< 1A) à l’entrée d’alimentation du moteur (rouge).' },
  { a: 'mot.noir', b: 'masse', nom: '4. Reliez l’autre borne d’alimentation du moteur (noire) à une masse de la platine Régulateur Analogique avec un cable noir.' },
  { a: 'mot.verte', b: 'plat.mesure', nom: '5. Reliez la sortie du capteur de vitesse (Dynamo Tachymétrique) (borne verte) à la borne verte « Mesure » de la platine « Régulateur » pour fermer la boucle.' },
  { a: 'mot.jaune', b: 'masse', nom: '6. Reliez l’autre borne de sortie DT (jaune) à une masse de la platine Régulateur Analogique avec un cable noir.' },
  { a: 'mot.verte', b: 'osc.v2', nom: '8. Reliez la sortie du capteur de vitesse (Dynamo Tachymétrique) (borne verte) à la voie 2 (verte) de l’oscilloscope.' },
  { a: 'plat.sortieG2', b: 'osc.v3', nom: '9. Reliez la sortie de l’amplificateur G2 (<25 mA), c’est-à-dire la sortie du régulateur, appelée commande U, à la voie 3 (bleue) de l’oscilloscope.' },
  { a: 'plat.erreur', b: 'osc.v4', nom: '10. Reliez la signal d’erreur (Borne « Erreur »), sur la voie 4 (rose) de l’oscilloscope.' },
]

export const MONTAGES = { tp1: { titre: 'TP1 — boucle ouverte', liaisons: MONTAGE_TP1 }, tp2: { titre: 'TP2 — boucle fermée', liaisons: MONTAGE_TP2 } } as const
export type MontageId = keyof typeof MONTAGES

const [NOIR, ROUGE, VERT, JAUNE] = MISE_EN_PAGE.cable.couleurs

/** Préréglage « câblage TP1 » : un câble par liaison de l'énoncé, masses en noir */
export const PRESET_TP1: Cablage = [
  { id: 'tp1-1', a: 'gbf.out', b: 'plat.ampliIn', couleur: ROUGE },
  { id: 'tp1-2', a: 'plat.ampliOut', b: 'mot.rouge', couleur: ROUGE },
  { id: 'tp1-3', a: 'mot.noir', b: 'plat.masse1', couleur: NOIR },
  { id: 'tp1-4', a: 'mot.verte', b: 'osc.v2', couleur: VERT },
  { id: 'tp1-5', a: 'mot.jaune', b: 'plat.masse2', couleur: NOIR },
  { id: 'tp1-6', a: 'gbf.out', b: 'osc.v1', couleur: JAUNE },
]

/** Réseaux (équipotentielles) : chaque borne → indice de réseau ; toutes les masses dans le même réseau */
export interface Reseaux {
  de: (b: Borne) => number
  masse: number
  /** Bornes de chaque réseau */
  membres: Borne[][]
  /** Nombre de câbles arrivant sur chaque borne */
  degre: (b: Borne) => number
}

export function reseaux(cablage: Cablage): Reseaux {
  const parent = new Map<Borne, Borne>(TOUTES_BORNES.map((b) => [b, b]))
  const racine = (b: Borne): Borne => {
    let r = b
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(b, r)
    return r
  }
  const unir = (a: Borne, b: Borne) => parent.set(racine(a), racine(b))
  for (const m of MASSES) unir(m, MASSES[0]!)
  const degres = new Map<Borne, number>()
  for (const c of cablage) {
    unir(c.a, c.b)
    degres.set(c.a, (degres.get(c.a) ?? 0) + 1)
    degres.set(c.b, (degres.get(c.b) ?? 0) + 1)
  }
  const indices = new Map<Borne, number>()
  const membres: Borne[][] = []
  for (const b of TOUTES_BORNES) {
    const r = racine(b)
    if (!indices.has(r)) {
      indices.set(r, membres.length)
      membres.push([])
    }
    membres[indices.get(r)!]!.push(b)
  }
  const de = (b: Borne) => indices.get(racine(b))!
  return { de, masse: de(MASSES[0]!), membres, degre: (b) => degres.get(b) ?? 0 }
}

export interface Verdict {
  total: number
  correctes: Liaison[]
  manquantes: Liaison[]
  /** Câbles de masse d'une autre couleur que noir (règle de l'énoncé) */
  massesNonNoires: Cable[]
}

/** « Faire vérifier » : une liaison est correcte si ses deux bornes sont dans le même réseau */
export function verifier(cablage: Cablage, attendu: readonly Liaison[]): Verdict {
  const r = reseaux(cablage)
  const net = (b: Borne | 'masse') => (b === 'masse' ? r.masse : r.de(b))
  const correctes = attendu.filter((l) => net(l.a) === net(l.b))
  return { total: attendu.length, correctes, manquantes: attendu.filter((l) => !correctes.includes(l)), massesNonNoires: massesNonNoires(cablage) }
}

export function massesNonNoires(cablage: Cablage): Cable[] {
  const r = reseaux(cablage)
  return cablage.filter((c) => r.de(c.a) === r.masse && c.couleur.toLowerCase() !== NOIR)
}

/** Signature d'un câblage : indépendante de l'ordre des câbles, du sens et de la couleur */
export const signature = (cablage: Cablage) =>
  cablage
    .map((c) => [c.a, c.b].sort().join('~'))
    .sort()
    .join('|')

/**
 * Liaison consigne → voie 1 : l'énoncé du TP2 fait observer la consigne « sur la voie 1 (jaune) » (réglage 1) mais
 * aucune liaison numérotée ne la câble. Elle est dessinée pré-câblée (ni vérifiée ni modifiable).
 */
export const PRECABLAGE_TP2: Cablage = [{ id: 'pre-v1', a: 'gbf.out', b: 'osc.v1', couleur: JAUNE }]

/** Préréglage « câblage TP2 » (tests) : les 9 liaisons de l'énoncé, masses en noir */
export const PRESET_TP2: Cablage = [
  { id: 'tp2-1', a: 'gbf.out', b: 'plat.consigne', couleur: JAUNE },
  { id: 'tp2-2', a: 'plat.sortieG2', b: 'plat.ampliIn', couleur: ROUGE },
  { id: 'tp2-3', a: 'plat.ampliOut', b: 'mot.rouge', couleur: ROUGE },
  { id: 'tp2-4', a: 'mot.noir', b: 'plat.masse1', couleur: NOIR },
  { id: 'tp2-5', a: 'mot.verte', b: 'plat.mesure', couleur: VERT },
  { id: 'tp2-6', a: 'mot.jaune', b: 'plat.masse2', couleur: NOIR },
  { id: 'tp2-8', a: 'mot.verte', b: 'osc.v2', couleur: VERT },
  { id: 'tp2-9', a: 'plat.sortieG2', b: 'osc.v3', couleur: ROUGE },
  { id: 'tp2-10', a: 'plat.erreur', b: 'osc.v4', couleur: ROUGE },
]

/** Variante « DT inversée » : les bornes verte et jaune de la DT permutées dans le câblage de l'étudiant */
export const inverserDt = (c: Cablage): Cablage => {
  const p = (b: Borne): Borne => (b === 'mot.verte' ? 'mot.jaune' : b === 'mot.jaune' ? 'mot.verte' : b)
  return c.map((x) => ({ ...x, a: p(x.a), b: p(x.b) }))
}

/** Variante « ampli de courant oublié » : sortie G2 reliée directement au moteur (rouge) */
export const oublierAmpli = (c: Cablage): Cablage => [
  ...c.filter((x) => ![x.a, x.b].some((b) => b === 'plat.ampliIn' || b === 'plat.ampliOut')),
  { id: 'variante-g2-moteur', a: 'plat.sortieG2', b: 'mot.rouge', couleur: ROUGE },
]
