/** Générateur d'exercices « message codé » : chronogramme gradué sans légende, et son corrigé (H29). */
import { REF } from '../data/reference'
import { mulberry32 } from './scope'
import { formatFrame, levelOf, messageWave, uartFrame, type Level, type Liaison, type Waveform } from './uart'

export type Difficulte = 1 | 2 | 3

export interface Exercice {
  graine: number
  difficulte: Difficulte
  level: Level
  liaison: Liaison
  /** Échelles imposées */
  tdiv: number
  vdiv: number
  /** Tension au centre de l'écran — V */
  offset: number
  wave: Waveform
  corrige: { message: string; chars: { char: string; byte: number; bits: string }[] }
}

/** Calibres 1-2-5 de 1 µs à 50 ms */
const CALIBRES = [-6, -5, -4, -3, -2].flatMap((e) => [1, 2, 5].map((m) => Number((m * 10 ** e).toPrecision(3))))

/** Plus grand calibre tel qu'un bit couvre au moins `exerciceBitMinDiv` divisions. */
export const baseDeTemps = (baud: number) => CALIBRES.filter((c) => c <= 1 / baud / REF.exerciceBitMinDiv.value).at(-1) ?? CALIBRES[0]!

export function exerciseGenerate(graine: number, difficulte: Difficulte): Exercice {
  const rnd = mulberry32(graine)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
  const f = REF.exerciceFormats.value
  const liaison: Liaison = { baud: pick(f.bauds), dataBits: pick(f.dataBits), parity: pick(f.parities), stopBits: f.stopBits }
  const level: Level = difficulte >= REF.exerciceRs232Des.value && rnd() < 0.5 ? 'RS232' : 'TTL'

  const [min, max] = REF.exerciceLongueur.value[difficulte]
  const n = min + Math.floor(rnd() * (max - min + 1))
  const alphabet = [...REF.exerciceAlphabet.value]
  const lettres = alphabet.filter((c) => c !== ' ')
  const message = Array.from({ length: n }, (_, k) => pick(k === 0 || k === n - 1 ? lettres : alphabet)).join('')

  const bytes = [...message].map((c) => c.charCodeAt(0))
  const repos = REF.exerciceRepos.value / liaison.baud
  const nbits = bytes.length * uartFrame(0, liaison).length
  const wave = messageWave(bytes, liaison, level, repos + nbits / liaison.baud + repos, repos)
  return {
    graine,
    difficulte,
    level,
    liaison,
    tdiv: baseDeTemps(liaison.baud),
    vdiv: REF.exerciceVoltDiv.value[level],
    offset: (levelOf(0, level) + levelOf(1, level)) / 2,
    wave,
    corrige: { message, chars: bytes.map((byte, k) => ({ char: message[k]!, byte, bits: formatFrame(uartFrame(byte, liaison), liaison) })) },
  }
}
