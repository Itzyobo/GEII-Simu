/**
 * Questions du TP1 qui ne sont pas des défis de code : QCM, questions numériques, mise en ordre.
 * Les réponses attendues sont calculées à chaque appel (INFO3.pins, fichiers générés du projet),
 * jamais écrites en dur. Les intitulés viennent de docs/info3/enonce.md (ancres).
 */
import { INFO3 } from '../../data/reference'
import type { Project } from '../project/project'

/* ───────────── Énoncé ───────────── */

/**
 * Intitulé d'une question : texte (Markdown) qui suit l'ancre `<a id="…"></a>`, jusqu'à l'ancre suivante,
 * un filet `---` ou un titre (sauf s'il est la première ligne : « ### 1. Interruption Timer2 … »).
 */
export function questionTitle(md: string, id: string): string | null {
  const marker = `<a id="${id}"></a>`
  const at = md.indexOf(marker)
  if (at < 0) return null
  const lines = md.slice(at + marker.length).replace(/^\s*\n/, '').split('\n')
  const out: string[] = []
  for (const l of lines) {
    if (l.includes('<a id=') || /^---\s*$/.test(l) || (out.some((x) => x.trim()) && /^#{1,6} /.test(l))) break
    out.push(l)
  }
  const text = out.join('\n').trim()
  return text || null
}

/** Libellé court d'une question (liste) : première ligne de l'intitulé sans marque de titre ni numéro */
export const questionLabel = (title: string) =>
  title
    .split('\n')[0]
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\d+(\.\d+)*\.?\s+/, '')
    .replace(/\*\*/g, '')

/** Ancres de l'énoncé, dans l'ordre du fichier */
export const enonceAnchors = (md: string): string[] => [...md.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1])

/** Section d'un TP dans l'énoncé (du titre « TP n » au titre du TP suivant), null si absente */
export function enonceSection(md: string, tp: number): string | null {
  const start = md.search(new RegExp(`^#{1,3} .*TP\\s*${tp}\\b`, 'm'))
  if (start < 0) return null
  const after = md.slice(start + 1)
  const next = after.search(new RegExp(`^#{1,3} .*TP\\s*${tp + 1}\\b`, 'm'))
  return md.slice(start, next < 0 ? undefined : start + 1 + next)
}

/* ───────────── Types de questions ───────────── */

export interface Qcm {
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

const P = INFO3.tp1.namePrefix
const led = (name: string) => INFO3.pins.leds.find((l) => l.name === name)!

/** 3.1 : broche de D2 (réponse tirée de INFO3.pins) */
export function qcm31(): Qcm {
  const d2 = led('D2')
  return {
    prompt: 'Sur quelle broche du PIC la LED D2 est-elle câblée ?',
    options: ['RA0', 'RA4', 'RB4', 'RC5'],
    answer: d2.pin,
    explanation: `D2 est reliée à ${d2.pin} (${d2.source}), active à ${d2.activeLevel}.`,
  }
}

const MCC_DIR = INFO3.mcc.dir
const macroValue = (header: string | undefined, macro: string) => new RegExp(`#define\\s+${macro}\\s+(\\S+)`).exec(header ?? '')?.[1] ?? null

/** 3.2 : expansion de `LED_D2_PORT = 1;` d'après le pin_manager.h généré du projet */
export function qcm32(p: Project): Qcm | null {
  const name = `${P.led}D2`
  const target = macroValue(p.generated?.[`${MCC_DIR}/pin_manager.h`], `${name}_PORT`)
  if (!target) return null
  const m = /^PORT([A-E])bits\.R([A-E])(\d)$/.exec(target)
  const port = m?.[1] ?? 'A'
  const bit = `${port}${m?.[3] ?? '0'}`
  return {
    prompt: `Après le préprocesseur, que devient l’instruction « ${name}_PORT = 1; » ?`,
    options: [`${target} = 1;`, `LAT${port}bits.LAT${bit} = 1;`, `TRIS${port}bits.TRIS${bit} = 1;`, `PORT${port} = 1;`],
    answer: `${target} = 1;`,
    explanation: `pin_manager.h définit ${name}_PORT comme ${target} : le préprocesseur remplace le nom par ce texte.`,
  }
}

/** 3.4 : TRISB et ANSELB lus dans le pin_manager.c généré du projet */
export function registersOf(p: Project, regs: string[]): Record<string, number> | null {
  const c = p.generated?.[`${MCC_DIR}/pin_manager.c`]
  if (!c) return null
  const out: Record<string, number> = {}
  for (const r of regs) {
    const m = new RegExp(`\\b${r}\\s*=\\s*(0x[0-9A-Fa-f]+)\\s*;`).exec(c)
    if (!m) return null
    out[r] = parseInt(m[1], 16)
  }
  return out
}

/** Réponse saisie : 0xEF, 239 ou 0b11101111 (null si illisible) */
export function parseRegisterAnswer(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\s+/g, '')
  let v: number
  if (/^0x[0-9a-f]+$/.test(t)) v = parseInt(t.slice(2), 16)
  else if (/^0b[01]+$/.test(t)) v = parseInt(t.slice(2), 2)
  else if (/^\d+$/.test(t)) v = parseInt(t, 10)
  else return null
  return v <= (1 << INFO3.c.bitsPerByte) - 1 ? v : null
}

/** 3.4 : justification, leurres tirés des erreurs typiques (PRD §4.4) */
export function qcm34(): Qcm {
  const s1 = INFO3.pins.buttons.find((b) => b.name === 'S1')!
  const port = s1.pin[1]
  const bit = s1.pin.slice(1)
  return {
    prompt: `Pourquoi le bit ANS${bit} d’ANSEL${port} doit-il être à 0 pour lire S1 ?`,
    options: [
      `Sinon ${s1.pin} est en analogique : sa lecture numérique dans PORT${port} renvoie toujours 0`,
      `Sinon ${s1.pin} reste en sortie et impose son niveau au bouton`,
      `Sinon il faut activer le tirage interne WPU${port} pour lire le bouton`,
      'Sinon le bouton ne peut être lu que sous interruption (GIE = 1)',
    ],
    answer: `Sinon ${s1.pin} est en analogique : sa lecture numérique dans PORT${port} renvoie toujours 0`,
    explanation: `Avec ANSEL = 1 le buffer d’entrée numérique est coupé : PORT${port} lit 0 quel que soit le niveau de la broche (cours p. 9). TRIS règle le sens, WPU le tirage : ils ne changent pas la lecture analogique.`,
  }
}

/** 4.1 : blocs de l'architecture du programme du cahier des charges, dans l'ordre d'exécution */
export const ARCHITECTURE_BLOCKS = [
  'SYSTEM_Initialize() : configuration des broches et de l’horloge',
  'Saisie du motif bit par bit : S1 bascule la LED, S2 valide le bit (D2 puis D3, D4, D5)',
  'Lecture du motif saisi dans PORTA',
  'Boucle infinie : affichage du motif sur D2 à D5',
  'Attente de la tempo (n × __delay_ms(100)) en surveillant S2 pour changer de tempo',
  'Décalage du motif : à droite si S1 est maintenu, à gauche sinon',
] as const

/** Ordre proposé à l'étudiant : mélange déterministe (inversion des paires) */
export function shuffledBlocks(): string[] {
  const b = [...ARCHITECTURE_BLOCKS]
  for (let i = 0; i + 1 < b.length; i += 2) [b[i], b[i + 1]] = [b[i + 1], b[i]]
  return b
}

export const orderIsCorrect = (order: string[]) => order.length === ARCHITECTURE_BLOCKS.length && order.every((x, i) => x === ARCHITECTURE_BLOCKS[i])
