import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AU3_ATTENDUS, AU3_QUESTIONS, couverture } from '../../data/questions.au3'
import { au3 } from '../../data/reference'
import { reduire, sessionTp3, SUPPORTS_TP3, type EtatBanc } from '../banc'
import BilanExamen from '../examen/BilanExamen'
import { noter } from '../examen/notation'
import { SELON_MODELE } from '../hypothese'
import { MISE_EN_PAGE } from '../miseEnPage'
import { PageTp3 } from '../pages/Tp3'
import { positionFiche, rangsFiches } from '../ui/cables'
import { catalogueTp3, contexteTp3 } from '../examen/catalogue'
import { badgeAffiche } from '../hypothese'
import Accueil from '../pages/Accueil'
import { chargerSession, cleSession, ESPACE_EXAMEN, sessionNeuve, SESSION_VERSION } from '../session'
import { PRESET_TP2 } from '../sim/cablage'
import { BANC_POSITION, etatInitial, lineaire, simulerPosition, step } from '../sim/position'
import { Z1_TP4, Z2_TP4 } from '../tp4/attendus'
import { DEGRES_PAR_TOUR } from '../unites'
import { affichagePourK, CABLAGE_TP3_I, CABLAGE_TP3_II, comparaisonK, debrancherMesure, essaiTp3, gbfContinu, inverserPot, kTp3, platineTp3, rampeBoucleOuverte, reponseContinue } from './attendus'
import { creerTempsReel } from './tempsReel'

/**
 * TP3 : aucune valeur du CR. Les cibles ci-dessous sont des valeurs du modèle calculées hors de l'application
 * (prompt de l'extension TP3) ; leurs tolérances ne doivent jamais être élargies.
 */
const proche = (x: number, cible: number, tol: number) => Math.abs(x / cible - 1) <= tol
const R2_SUR_Z2 = { z1: SUPPORTS_TP3.z1, z2: { composants: ['R2'] as const, montage: 'serie' as const } }

describe('TP3 — grandeurs dérivées de reference.au3.ts', () => {
  it('angle mort, gain du capteur et gain en vitesse sont bien calculés depuis les hypothèses de base (jamais saisis)', () => {
    expect(au3('TP3_ANGLE_MORT')).toBe(au3('TP3_SOUDURE_M12') + au3('TP3_ISOLANT') + au3('TP3_SOUDURE_P12'))
    expect(au3('TP3_GCAPT')).toBeCloseTo((2 * au3('TP3_VALIM_POT')) / (DEGRES_PAR_TOUR - au3('TP3_ANGLE_MORT')), 12)
    expect(au3('TP3_KV')).toBeCloseTo(DEGRES_PAR_TOUR / (au3('TP3_T_TOUR') * (au3('TP3_VALIM_POT') - au3('TP3_UF'))), 12)
  })
})

describe('TP3 — 1 et 2. boucle ouverte : rampe du potentiomètre', () => {
  const r = rampeBoucleOuverte()
  it('1. période = 0,500 s ±1 % ; pente positive ; alimentation inversée → pente négative', () => {
    expect(proche(r.periode, 0.5, 0.01), `période ${r.periode}`).toBe(true)
    expect(r.pente).toBe(1)
    const inv = rampeBoucleOuverte(true)
    expect(inv.pente).toBe(-1)
    expect(proche(inv.periode, 0.5, 0.01)).toBe(true)
  })
  it('2. angle mort lu sur la trace = 20° ±5 % ; paliers −12 V, 0 V, +12 V dans l’ordre du temps (+12 → 0 → −12 en tournant)', () => {
    expect(proche(r.angleMort, 20, 0.05), `angle mort ${r.angleMort}`).toBe(true)
    // Rotation positive, pente positive : la rampe atteint +12 V, puis soudure +12 V, isolant 0 V, soudure −12 V
    expect(r.paliers).toEqual([au3('TP3_VALIM_POT'), 0, -au3('TP3_VALIM_POT')])
  })
})

describe('TP3 — 3 à 7. consigne carrée ±2 V à 0,2 Hz', () => {
  const k7 = essaiTp3()
  it('3. K = 7 : erreur statique < 0,5 % ; D1 < 1 % ; TR5%b = 110 ms ±5 % ; U = 10,6 V pendant 67 ms ±10 %', () => {
    expect(k7.K).toBe(7)
    expect(Math.abs(k7.erreur)).toBeLessThan(0.005)
    expect(k7.d1rel).toBeLessThan(0.01)
    expect(proche(k7.tr5, 0.11, 0.05), `TR5 ${k7.tr5}`).toBe(true)
    expect(k7.umax).toBeCloseTo(au3('USAT'), 9)
    expect(proche(k7.dureeSaturation, 0.067, 0.1), `saturation ${k7.dureeSaturation}`).toBe(true)
  })
  it('4. K = 9 : D1 compris entre 0,5 % et 1,5 %', () => {
    const k9 = essaiTp3(au3('TP3_G1_K9'))
    expect(k9.K).toBe(9)
    expect(k9.d1rel).toBeGreaterThan(0.005)
    expect(k9.d1rel).toBeLessThan(0.015)
  })
  it('5. K = 4 : erreur statique entre 0,5 % et 0,8 % ; TR5%b = 159 ms ±5 %', () => {
    const k4 = essaiTp3(affichagePourK(4))
    expect(k4.erreur).toBeGreaterThan(0.005)
    expect(k4.erreur).toBeLessThan(0.008)
    expect(proche(k4.tr5, 0.159, 0.05), `TR5 ${k4.tr5}`).toBe(true)
  })
  it('6. K = 2 : TR5%b = 327 ms ±5 % ; K = 1 : TR5%b = 680 ms ±5 %, erreur statique = 2,5 % ±10 %', () => {
    const k2 = essaiTp3(affichagePourK(2))
    const k1 = essaiTp3(affichagePourK(1))
    expect(proche(k2.tr5, 0.327, 0.05), `TR5 K=2 ${k2.tr5}`).toBe(true)
    expect(proche(k1.tr5, 0.68, 0.05), `TR5 K=1 ${k1.tr5}`).toBe(true)
    expect(proche(k1.erreur, 0.025, 0.1), `erreur K=1 ${k1.erreur}`).toBe(true)
  })
  it('7. Q7 : l’ensemble des K de {1, 2, 4, 7} qui respectent le cahier des charges, calculé, est {7}', () => {
    expect(comparaisonK().retenus).toEqual([7])
    expect(catalogueTp3(contexteTp3()).ouvertes['tp3-ii2-m-q7']!.attendu).toBe('K = 7')
  })
  it('convergence : un pas d’Euler deux fois plus petit change m(∞), TR5%b, la saturation de U et la période de moins de 0,5 %', () => {
    const fin = { ...BANC_POSITION, pas: BANC_POSITION.pas / 2 }
    const f = essaiTp3(au3('TP3_G1'), SUPPORTS_TP3, fin)
    for (const k of ['dm', 'tr5', 'dureeSaturation'] as const) expect(proche(f[k], k7[k], 0.005), k).toBe(true)
    expect(proche(rampeBoucleOuverte(false, fin).periode, rampeBoucleOuverte().periode, 0.005)).toBe(true)
  })
})

describe('TP3 — 8 à 10. défauts de câblage', () => {
  it('8. fil du potentiomètre débranché, K = 7, consigne +2 V : |U| = 10,6 V et θ augmente d’au moins 360° en 1 s', () => {
    const r = reponseContinue(au3('TP3_GBF_VPP') / 2, 1, debrancherMesure(CABLAGE_TP3_II))
    expect(Math.abs(r.commande[r.commande.length - 1]!)).toBeCloseTo(au3('USAT'), 9)
    expect(r.final.theta - r.theta[0]!).toBeGreaterThanOrEqual(DEGRES_PAR_TOUR)
  })
  it('9. potentiomètre inversé en boucle fermée : réaction positive, U saturé (conflit signalé : le disque reste piégé dans l’angle mort)', () => {
    const c = au3('TP3_GBF_VPP') / 2
    const r = reponseContinue(c, 1, inverserPot(CABLAGE_TP3_II))
    // Réaction positive : la mesure s'éloigne de la consigne au lieu de la rejoindre
    const i = r.t.findIndex((t) => t >= au3('TP3_TR5_MAX'))
    expect(Math.abs(c - r.voie2[i]!)).toBeGreaterThan(Math.abs(c - r.voie2[0]!))
    expect(Math.max(...r.commande)).toBeCloseTo(au3('USAT'), 9)
    expect(Math.min(...r.commande)).toBeCloseTo(-au3('USAT'), 9)
    // Le prompt attend une rotation continue ; le modèle (paliers de l'angle mort) donne autre chose : à la soudure
    // côté rouge (+12 V), l'erreur change de signe et renvoie le disque vers l'isolant (0 V), qui le renvoie vers la
    // soudure : U commute entre ±10,6 V et le disque reste au bord isolant/soudure, sans faire de tour complet.
    const a = r.final.theta - DEGRES_PAR_TOUR * Math.floor(r.final.theta / DEGRES_PAR_TOUR)
    expect(a).toBeGreaterThanOrEqual(lineaire(BANC_POSITION))
    expect(r.final.theta - r.theta[0]!).toBeLessThan(DEGRES_PAR_TOUR)
  })
  it('10. résistances inégales (10 kΩ / 27 kΩ) : K calculé = 18,9 ±1 %, et « Faire vérifier » le signale', () => {
    expect(proche(kTp3(au3('TP3_G1'), au3('TP3_G2'), R2_SUR_Z2.z1, R2_SUR_Z2.z2)!, 18.9, 0.01)).toBe(true)
    expect(kTp3(au3('TP3_G1'), au3('TP3_G2'), SUPPORTS_TP3.z1, SUPPORTS_TP3.z2)).toBe(7)
    const verif = (supports: typeof SUPPORTS_TP3) => {
      const s = sessionNeuve('libre')
      const e: EtatBanc = { session: { ...s, cablage: [...CABLAGE_TP3_II], platine: { ...s.platine, ...supports } }, montage: 'tp3-ii1', verdict: null, message: null }
      return reduire(e, { type: 'faire-verifier' }, 0).verdict!
    }
    expect(verif(SUPPORTS_TP3).reussi).toBe(true)
    const v = verif(R2_SUR_Z2)
    expect(v.reussi).toBe(false)
    const eg = v.impedances.find((z) => z.support === 'egales')!
    expect(eg.ok).toBe(false)
    expect(eg.message).toContain('inégales')
    // Le +12 V laissé sur l'entrée de l'ampli (modification n° 1 oubliée) est aussi refusé
    const s = sessionNeuve('libre')
    const oubli = reduire({ session: { ...s, cablage: [...CABLAGE_TP3_II, { id: 'x', a: 'plat.p12', b: 'plat.ampliIn', couleur: '#d62828' }], platine: { ...s.platine, ...SUPPORTS_TP3 } }, montage: 'tp3-ii1', verdict: null, message: null }, { type: 'faire-verifier' }, 0).verdict!
    expect(oubli.reussi).toBe(false)
    expect(oubli.manquantes.map((l) => l.nom)).toContain('1. Enlevez le cable entre l’entrée de l’ampli de courant et la borne +12V de la platine régulateur')
  })
})

describe('TP3 — bornes empilées et liaison n° 4 à deux fils', () => {
  it('partie I : 2 câbles sur +12 V (ampli et potentiomètre) → « Faire vérifier » 5/5 ; un seul des deux fils de la n° 4 → 4/5', () => {
    const s = sessionNeuve('libre')
    const verif = (cablage: typeof CABLAGE_TP3_I) => reduire({ session: { ...s, cablage: [...cablage] }, montage: 'tp3', verdict: null, message: null }, { type: 'faire-verifier' }, 0).verdict!
    expect(CABLAGE_TP3_I.filter((c) => c.a === 'plat.p12' || c.b === 'plat.p12')).toHaveLength(2)
    const v = verif(CABLAGE_TP3_I)
    expect([v.correctes.length, v.total, v.reussi]).toEqual([5, 5, true])
    const sansBleue = verif(CABLAGE_TP3_I.filter((c) => c.b !== 'pot.bleue'))
    expect([sansBleue.correctes.length, sansBleue.reussi]).toEqual([4, false])
  })
  it('les fiches d’une borne sont hors du disque de la borne et ne se recouvrent pas', () => {
    const o = { x: 0, y: 0 }
    const rayonBorne = 16 // bouton h-7 (28 px) + anneau de 2 px
    const f = Array.from({ length: 6 }, (_, k) => positionFiche(o, k))
    for (const p of f) expect(Math.hypot(p.x, p.y) - MISE_EN_PAGE.cable.rayonPlot).toBeGreaterThanOrEqual(rayonBorne)
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) expect(Math.hypot(f[i]!.x - f[j]!.x, f[i]!.y - f[j]!.y)).toBeGreaterThan(2 * MISE_EN_PAGE.cable.rayonPlot)
    expect([...rangsFiches([{ id: 'a', a: 'm', b: 'x' }, { id: 'b', a: 'm', b: 'y' }, { id: 'c', a: 'z', b: 'm' }]).values()].map((r) => [r.a, r.b])).toEqual([[0, 0], [1, 0], [0, 2]])
  })
})

describe('TP3 — 3. comportements prédits non vérifiés (texte rendu)', () => {
  const texte = (html: string) => html.replace(/<!-- -->/g, '')
  /** Contenu textuel des éléments marqués data-predit */
  const predits = (html: string) => [...texte(html).matchAll(/<(\w+)[^>]*data-predit[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]!)
  it('page TP3 : la réponse attendue et la correction de II.1 Q6 (consigne proche de ±12 V) commencent par le préfixe et portent le badge', () => {
    const s = { ...sessionTp3('libre'), reponses: { 'tp3-ii1-q6': { valeur: 'Oui, partout\nx', essais: 1 } } }
    const html = renderToString(createElement(MemoryRouter, null, createElement(PageTp3, { etat: { session: s, montage: 'tp3-ii1', verdict: null, message: null }, agir: () => {} })))
    const p = predits(html)
    expect(p).toHaveLength(2)
    for (const x of p) {
      expect(x.startsWith(SELON_MODELE)).toBe(true)
      expect(x).toContain('valeur non vérifiée')
    }
  })
  it('bilan d’examen : la question non traitée II.1 Q6 est corrigée avec le préfixe et le badge', () => {
    const s = { ...sessionTp3('examen'), examen: { tp: 'tp3' as const, graine: 1, incident: 'aucun' as const, debut: 0, duree: au3('DUREE_EXAMEN'), termine: true, finA: 1 } }
    const bilan = noter(s, 'tp3', catalogueTp3(contexteTp3()))
    const html = renderToString(createElement(MemoryRouter, null, createElement(BilanExamen, { bilan, examen: s.examen })))
    const p = predits(html)
    expect(p).toHaveLength(1)
    expect(p[0]!.startsWith(SELON_MODELE)).toBe(true)
    expect(p[0]).toContain('±12 V')
    expect(p[0]).toContain('valeur non vérifiée')
  })
})

describe('TP3 — 11. mode temps réel', () => {
  it('1 s simulée en tranches de 16 ms donne le même θ final que d’un seul bloc (±0,1 %), en boucle ouverte et en boucle fermée', () => {
    const cas = [
      { gbf: gbfContinu(0), platine: platineTp3(), cablage: CABLAGE_TP3_I },
      { gbf: gbfContinu(au3('TP3_GBF_VPP') / 2), platine: platineTp3(), cablage: CABLAGE_TP3_II },
    ]
    for (const entrees of cas) {
      const bloc = simulerPosition(BANC_POSITION, entrees, 1, au3('TP3_PAS_MESURE')).final
      const tr = creerTempsReel(entrees, BANC_POSITION, null)
      const tranche = 0.016
      let t = 0
      while (t + tranche <= 1) {
        tr.avancer(tranche)
        t += tranche
      }
      tr.avancer(1 - t)
      expect(tr.etat().n).toBe(bloc.n)
      expect(Math.abs(tr.etat().theta / bloc.theta - 1)).toBeLessThan(0.001)
      // step() = une tranche avec les entrées de l'image
      expect(step(etatInitial(), entrees, 1).theta).toBeCloseTo(bloc.theta, 9)
    }
  })
})

describe('TP3 — 12. badges et accueil', () => {
  const tp3 = AU3_QUESTIONS.filter((q) => q.tp === 'tp3')
  it('toutes les questions du TP3 ont le badge « valeur non vérifiée »', () => {
    expect(tp3.length).toBeGreaterThan(30)
    for (const q of tp3) expect(badgeAffiche(q.cles, q.validee), q.id).toBe(true)
  })
  it('accueil : les 4 attendus du TP3 sont couverts ; le cas triangulaire est affiché optionnel, non couvert', () => {
    const a3 = AU3_ATTENDUS.filter((a) => a.tp === 'tp3')
    expect(a3).toHaveLength(4)
    for (const a of a3) {
      expect(couverture(a).etat, a.id).toBe('couvert')
      expect(couverture(a).questions.some((q) => q.statut === 'disponible')).toBe(true)
    }
    const tri = tp3.find((q) => q.id === 'tp3-triangle')!
    expect(tri.statut).toBe('non-couverte')
    expect(tri.optionnelle).toBe(true)
    const html = renderToString(createElement(MemoryRouter, null, createElement(Accueil))).replace(/<!-- -->/g, '')
    expect(html).toContain('href="/au3/tp3"')
    expect(html).toMatch(/data-non-couverte="tp3-triangle"[^>]*>[^<]*optionnelle, non couverte/)
  })
})

describe('TP3 — 13. migration de session v4 → v5', () => {
  it('une session d’examen TP4 v4 est conservée sans perte (seule la progression TP3 est ajoutée)', () => {
    const m = new Map<string, string>()
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    const { tp3: _t, ...base } = sessionNeuve('examen')
    void _t
    const v4 = {
      ...base,
      version: 4,
      cablage: [...PRESET_TP2],
      platine: { ...base.platine, sousTension: true, z1: Z1_TP4, z2: Z2_TP4, g1: 95 },
      reponses: { 'tp4-i-q1': { valeur: '0,8 V', essais: 1 } },
      essaisVerification: 2,
      essaiReussi: 2,
      evenementsSousTension: [{ instant: 9, type: 'manip-sous-tension' as const, detail: 'retrait du câble tp2-5' }],
      examen: { tp: 'tp4' as const, graine: 42, incident: 'aucun' as const, debut: 5, duree: au3('DUREE_EXAMEN'), termine: false, finA: null },
    }
    st.setItem(cleSession('examen', ESPACE_EXAMEN), JSON.stringify(v4))
    const s = chargerSession(st, 'examen', ESPACE_EXAMEN)!
    expect(SESSION_VERSION).toBe(5)
    expect(s).toEqual({ ...v4, version: 5, tp3: { validations: {} } })
  })
})
