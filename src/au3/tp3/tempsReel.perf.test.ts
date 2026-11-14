import { expect, it } from 'vitest'
import { au3 } from '../../data/reference'
import { BANC_POSITION } from '../sim/position'
import { CABLAGE_TP3_II, gbfContinu, platineTp3 } from './attendus'
import { creerTempsReel } from './tempsReel'

// Mode temps réel du TP3 : une image (16 ms simulées, 3 200 pas d'Euler, échantillons de l'oscilloscope) bien sous une image à 60 Hz
const LIMITE_MS = 16
const IMAGE = 0.016
const IMAGES = 120

it('TP3 : une image du mode temps réel (16 ms simulées) en moins de 16 ms', () => {
  const tr = creerTempsReel({ gbf: gbfContinu(au3('TP3_GBF_VPP') / 2), platine: platineTp3(), cablage: CABLAGE_TP3_II }, BANC_POSITION, null)
  for (let i = 0; i < IMAGES; i++) tr.avancer(IMAGE) // chauffe du JIT
  const temps = Array.from({ length: IMAGES }, () => {
    const t0 = performance.now()
    tr.avancer(IMAGE)
    return performance.now() - t0
  })
  console.log(`image temps réel : médiane ${[...temps].sort((a, b) => a - b)[IMAGES >> 1]!.toFixed(2)} ms, max ${Math.max(...temps).toFixed(2)} ms`)
  expect(Math.max(...temps)).toBeLessThan(LIMITE_MS)
})
