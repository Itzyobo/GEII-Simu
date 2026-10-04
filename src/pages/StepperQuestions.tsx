import { useMemo } from 'react'
import QuestionCard from '../components/QuestionCard'
import { PAP, type ModePas } from '../data/reference'
import { metaOf, type AnswerSpec, type QuestionMeta } from '../lib/exam'
import { UNVERIFIED_BY_MODE } from '../data/questions'
import {
  apparentInductance, clocksPerCurrentPeriod, findFreq2, isVoltageMode, phaseShiftDeg,
  setpoint, simulate, speedRpm, statesPerPeriod, type Dir,
} from '../models/stepper'

const MODE_LABEL: Record<ModePas, string> = { entier: 'pas entier', demi: 'demi-pas', quart: '1/4 de pas' }
const fr = (x: number, digits = 3) => String(Number(x.toPrecision(digits))).replace('.', ',')
const sgn = (x: number) => (x > 0 ? `+${fr(x, 2)}` : x < 0 ? `−${fr(-x, 2)}` : '0')

/** Séquence (I_A ; I_B) sur une période, telle que produite par le modèle. */
function sequence(mode: ModePas, dir: Dir): string {
  return Array.from({ length: statesPerPeriod(mode) }, (_, k) => `(${sgn(setpoint(mode, k, 'A', dir))} ; ${sgn(setpoint(mode, k, 'B', dir))})`).join(' → ')
}

/**
 * Réponses attendues et explications, calculées sur le modèle (aucune valeur codée en dur).
 * Source unique des cartes et de la clé de correction d'examen.
 */
function specs(mode: ModePas): Record<string, AnswerSpec> {
  const Np = PAP.pasParTour
  const f2 = findFreq2()
  const sim200 = (m: ModePas, dir: Dir) => simulate({ f: 200, mode: m, dir })
  const phi = phaseShiftDeg(sim200('entier', 1))
  const phiInv = phaseShiftDeg(sim200('entier', -1))
  const f7 = 2000
  const e7 = (PAP.ke * 2 * Math.PI * speedRpm(f7, 'entier')) / 60
  const rise7 = (PAP.lReelle * 2 * (PAP.iConsigne - PAP.hysteresis)) / (PAP.vAlim - e7)
  const voltage7 = isVoltageMode(simulate({ f: f7, mode: 'entier', dir: 1 }))
  const q4 = speedRpm(20, 'entier')
  const q5 = speedRpm(180, 'demi')
  const q10 = Math.round(clocksPerCurrentPeriod(sim200(mode, 1)))
  const q12 = apparentInductance() * 1e3
  return {
    'pap-q4': { expected: q4, unit: 'tr/min', explanation: `N = 60·f / Np = 60 × 20 / ${Np.entier} = ${fr(q4)} tr/min (pas entier : ${Np.entier} pas par tour).` },
    'pap-q5': { expected: q5, unit: 'tr/min', explanation: `N = 60·f / Np = 60 × 180 / ${Np.demi} = ${fr(q5)} tr/min (demi-pas : ${Np.demi} pas par tour).` },
    'pap-q6': {
      expected: f2,
      unit: 'Hz',
      tolerance: 0.1,
      explanation: `Freq2 ≈ ${fr(f2, 4)} Hz. Le courant monte avec di/dt = (E − R·i − e)/L ; au-delà de Freq2, la demi-période T/2 = 2/f devient plus courte que la montée de −0,9 A à +0,9 A, et le courant n'atteint plus 0,9 A.`,
    },
    'pap-q7': {
      kind: 'choix',
      choices: ['Mode courant : le hacheur maintient le courant entre 0,9 et 1 A', 'Mode tension : la tension ±15 V est appliquée en permanence et le courant n’atteint plus la consigne'],
      correct: voltage7 ? 1 : 0,
      explanation: `Justification : montée Δt ≈ L·Δi/(E − e) = ${fr(PAP.lReelle * 1e3)} mH × 1,8 A / (15 − ${fr(e7, 2)}) V ≈ ${fr(rise7 * 1e3, 2)} ms, alors que T/2 = 2/f = ${fr((2 / f7) * 1e3, 2)} ms. ${voltage7 ? 'La montée est plus longue que la demi-période : le courant ne plafonne plus, c’est le mode tension (courant triangulaire).' : 'La montée tient dans la demi-période : mode courant.'}`,
    },
    'pap-q8': { expected: phi, unit: '°', explanation: `Δφ = 360° × Δt / T. I_B est en avance d'un quart de période : Δt = T/4, donc Δφ = 360/4 = ${fr(phi, 2)}°.` },
    'pap-q9': {
      kind: 'choix',
      choices: ['Rien ne change', 'Le signe du déphasage s’inverse : I_B passe en retard de T/4, le moteur tourne dans l’autre sens', 'Le déphasage passe à 180°', 'La fréquence des courants double'],
      correct: Math.sign(phiInv) === -Math.sign(phi) ? 1 : 0,
      explanation: "DIR fait parcourir la séquence des consignes dans l'autre sens : Δφ = 360° × Δt/T passe de +90° à −90°, I_B est en retard de T/4 et le sens de rotation s'inverse.",
    },
    'pap-q10': {
      expected: q10,
      unit: 'périodes',
      explanation: `T_courant = n · T_horloge, avec n = nombre d'états de la séquence : 4 en pas entier, 8 en demi-pas, 16 en 1/4 de pas. Ici (${MODE_LABEL[mode]}) n = ${q10}.`,
    },
    'pap-q11': {
      kind: 'choix',
      choices: [sequence('entier', -1), sequence('entier', 1), '(+1 ; 0) → (0 ; +1) → (−1 ; 0) → (0 ; −1)', '(+1 ; +1) → (−1 ; −1) → (+1 ; +1) → (−1 ; −1)'],
      correct: 1,
      explanation: "Pas entier, deux phases alimentées : 4 états de ±1 A, chaque phase s'inverse toutes les 2 périodes d'horloge (T_courant = 4·T_horloge) et I_B est en avance de T/4 sur I_A.",
    },
    'pap-q12': {
      expected: q12,
      unit: 'mH',
      tolerance: 0.1,
      explanation: `L = E·Δt/Δi = 15 × Δt / Δi ≈ ${fr(q12)} mH. La formule néglige la f.c.é.m. ; la valeur obtenue est une inductance apparente, supérieure à l'inductance réelle (≈ ${fr(PAP.lReelle * 1e3)} mH dans le modèle).`,
    },
  }
}

/** Clé de correction (questions non affichées à la remise d'un examen). Q10 : mode pas entier par défaut. */
export function answerKey(mode: ModePas = 'entier'): Record<string, QuestionMeta> {
  return Object.fromEntries(Object.entries(specs(mode)).map(([id, s]) => [id, metaOf(s)]))
}

/** Questions Q4 à Q12 de l'énoncé du TP moteur pas à pas. */
export default function StepperQuestions({ mode }: { mode: ModePas }) {
  const s = useMemo(() => specs(mode), [mode])
  return (
    <>
      <QuestionCard
        id="pap-q4"
        label="Q4"
        statement="Appliquer une fréquence de 20 Hz en mode pas complet (régler S1, S2 et S3) et mesurer expérimentalement la vitesse de rotation du moteur. Vérifier ce résultat par le calcul."
        {...s['pap-q4']}
      />
      <QuestionCard
        id="pap-q5"
        label="Q5"
        statement="Appliquer une fréquence de 180 Hz en mode demi pas et mesurer la vitesse de rotation du moteur. Vérifier ce résultat par le calcul."
        {...s['pap-q5']}
      />
      <QuestionCard id="pap-q6" label="Q6" statement="Déterminer la valeur de la fréquence Freq2." {...s['pap-q6']} />
      <QuestionCard
        id="pap-q7"
        label="Q7"
        statement="Pour les fréquences Freq1 et Freq2, relever sur une phase le courant et la tension à ses bornes. Justifier le mode de fonctionnement pour chacune de ces fréquences (mode courant ou mode tension) — Ici : à 2000 Hz en pas entier, quel est le mode ?"
        {...s['pap-q7']}
      />
      <QuestionCard
        id="pap-q8"
        label="Q8"
        statement="Pour la fréquence Freq1, enregistrer le courant dans les 2 phases du moteur et retrouver un déphasage de T/4. — Ici : déphasage de I_B par rapport à I_A, en degrés (positif si I_B est en avance)."
        {...s['pap-q8']}
      />
      <QuestionCard
        id="pap-q9"
        label="Q9"
        statement="A l'arrêt, en mode pas complet, inverser le sens de rotation du moteur, pour fréquence du GBF autour de 200Hz. Démarrer le moteur et relever les courants dans les enroulements en mode courant. Expliquer les différences avec la question 8."
        {...s['pap-q9']}
      />
      <QuestionCard
        id="pap-q10"
        label="Q10"
        statement={`Pour une fréquence d'horloge de 500 Hz, relever le signal d'horloge etle courant. Justifiez dans quel mode fonctionne le moteur et indiquez le nombre de périodes horloge pour une période du courant moteur. — Ici : mode réglé sur le driver (${MODE_LABEL[mode]}).`}
        {...s['pap-q10']}
        unverified={UNVERIFIED_BY_MODE[mode]?.['pap-q10']}
      />
      <QuestionCard
        id="pap-q11"
        label="Q11"
        statement="Relever le courant dans chacune des 2 phases du moteur, et déterminer la séquence des courants. — Ici : séquence (I_A ; I_B) en ampères, en pas entier."
        {...s['pap-q11']}
        unverified={UNVERIFIED_BY_MODE[mode]?.['pap-q11']}
      />
      <QuestionCard
        id="pap-q12"
        label="Q12"
        statement="En mode pas entier et pour une fréquence de 1khz (courant trapézoïdal), observer la montée, ou descente, du courant pour passer de +Imax à –Imax. Que vaut la tension aux bornes d'une phase ? En partant de l'équation V(t) = L ⋅ di(t)/dt et en supposant une croissance linéaire du courant, calculer la valeur de l'inductance. — Ici : L en mH, mesurée aux curseurs."
        {...s['pap-q12']}
      />
    </>
  )
}
