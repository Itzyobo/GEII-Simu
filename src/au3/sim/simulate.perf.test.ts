import { expect, it } from 'vitest'
import { au3 } from '../../data/reference'
import { GBF_DEFAUT } from '../instruments/gbf'
import { PRESET_TP1 } from './cablage'
import { BANC_REEL, simulate } from './simulate'

// Étape 2, correction 7 : simulate() sur 1,54 s simulées au pas de 5 µs en moins de 150 ms (Node), banc réel (bruit : 2 passes)
const LIMITE_MS = 150
const DUREE = 1.54

it('15. performance : 1,54 s simulées (308 000 pas d’Euler, bruit compris) en moins de 150 ms', () => {
  const reglages = { gbf: { ...GBF_DEFAUT, vpp: au3('CR_TP1_DU') }, platine: { sousTension: true, ampli: 'normal' as const, g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null }, duree: DUREE, pasSortie: BANC_REEL.pas * 5 }
  simulate(BANC_REEL, reglages, PRESET_TP1, 0) // chauffe du JIT
  const temps = Array.from({ length: 5 }, (_, g) => {
    const t0 = performance.now()
    simulate(BANC_REEL, reglages, PRESET_TP1, g + 1)
    return performance.now() - t0
  })
  console.log(`simulate 1,54 s : ${temps.map((t) => t.toFixed(1)).join(' / ')} ms`)
  expect(Math.max(...temps)).toBeLessThan(LIMITE_MS)
})
