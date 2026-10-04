import { useMemo, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import { MAS } from '../data/reference'
import { metaOf, tableMeta, type AnswerSpec, type QuestionMeta } from '../lib/exam'
import { exactNoLoad, inverterVoltage, lossSeparation, lossVerdict, motorState, nominalTorque, ohmmeter, polePairs, powerBalance, syncSpeed, type LossInputs } from '../models/asyncMotor'
import { BalanceSection, Exercise, LossSection, lossComplete, lossInputs, ReleveTable, TABLE_EXPLANATIONS, VariateurTable, type LossValues } from './AsyncWorksheet'

const fr = (x: number, digits = 3) => String(Number(x.toPrecision(digits))).replace('.', ',')

/** Réponses calculées sur le modèle. */
function computeAnswers() {
  const tri = (c: number) => motorState({ couple: c, couplage: 'triangle', source: 'reseau', f: 50 })
  const star0 = motorState({ couple: 0, couplage: 'etoile', source: 'reseau', f: 50 })
  const ns = syncSpeed(MAS.fReseau)
  // Q6 : proportionnalité Cu/g, cos φ à vide, variation relative de Qa
  const ratios = [2.5, 5, 7.5, 10].map((c) => c / tri(c).g)
  const spread = (Math.max(...ratios) - Math.min(...ratios)) / Math.min(...ratios)
  const qas = MAS.releves.map((r) => r.qa)
  const qaVar = (Math.max(...qas) - Math.min(...qas)) / Math.min(...qas)
  const varN = [15, 35, 50].map((f) => motorState({ couple: 5, couplage: 'triangle', source: 'variateur', f }).n)
  return {
    cun: nominalTorque(),
    p: polePairs(),
    ns,
    coupling: Math.min(...MAS.plaque.u) === MAS.uReseau ? 0 : 1,
    rs: ohmmeter('aucune', 'U1-U2', false) ?? NaN,
    p0y: star0.pa,
    i0y: star0.is,
    cuProp: spread < 0.15,
    spread,
    cos0: tri(0).cosPhi,
    qaFlat: qaVar < 0.25,
    qaVar,
    uf: inverterVoltage(50, 'fondamental') / 50,
    nPropF: Math.abs(varN[2] / varN[0] - 50 / 15) / (50 / 15) < 0.05,
    loss: lossSeparation(exactNoLoad()),
    bilan: (() => {
      const nom = tri(10)
      return powerBalance({ pa: nom.pa, is: nom.is, g: nom.g, pu: nom.pu, alpha: lossSeparation(exactNoLoad()).alpha })
    })(),
  }
}

/** Réponses attendues et explications (hors Q8, dont l'explication dépend des saisies). */
function specs(): Record<string, AnswerSpec> {
  const a = computeAnswers()
  return {
    'mas-q1-cu': {
      expected: a.cun,
      unit: 'N·m',
      explanation: `Cu = Pn / Ωn, avec Ωn = Nn·π/30 = ${MAS.plaque.nn} × π/30 = ${fr((MAS.plaque.nn * Math.PI) / 30)} rad/s : Cu = ${MAS.plaque.pn} / ${fr((MAS.plaque.nn * Math.PI) / 30)} ≈ ${fr(a.cun)} N·m.`,
    },
    'mas-q1-p': { expected: a.p, unit: '', explanation: `Ns = 60·f/p doit être juste au-dessus de Nn = ${MAS.plaque.nn} tr/min : p = ${a.p} donne Ns = ${a.ns} tr/min.` },
    'mas-q1-ns': { expected: a.ns, unit: 'tr/min', explanation: `f = p·n : Ns = 60·f/p = 60 × 50 / ${a.p} = ${a.ns} tr/min. À vide, N est très proche de Ns (glissement presque nul).` },
    'mas-q2': {
      kind: 'choix',
      choices: ['Triangle', 'Étoile'],
      correct: a.coupling,
      explanation: `La tension d'un enroulement est la plus petite valeur de la plaque (${Math.min(...MAS.plaque.u)} V). Sur un réseau ${MAS.uReseau} V, chaque enroulement doit recevoir la tension composée : couplage triangle. En étoile, il ne recevrait que ${fr(MAS.uReseau / Math.sqrt(3))} V.`,
    },
    'mas-q4': {
      expected: a.rs,
      unit: 'Ω',
      explanation: `Barrettes retirées, entre U1 et U2 : on mesure un seul enroulement, Rs = ${fr(a.rs)} Ω. Avec les barrettes en triangle, U1–V1 donne Rs ∥ 2Rs = 2/3·Rs = ${fr((2 / 3) * a.rs)} Ω ; en étoile, U1–V1 donne 2·Rs = ${fr(2 * a.rs)} Ω.`,
    },
    'mas-q5-p0': {
      expected: a.p0y,
      unit: 'W',
      explanation: `À vide, la puissance absorbée ne couvre que les pertes. En étoile, chaque enroulement ne reçoit que ${fr(MAS.uReseau / Math.sqrt(3))} V : P'0 ≈ ${fr(a.p0y)} W.`,
    },
    'mas-q5-i0': { expected: a.i0y, unit: 'A', explanation: `I's0 ≈ ${fr(a.i0y)} A : le courant magnétisant diminue avec la tension par enroulement.` },
    'mas-q6-g': {
      kind: 'choix',
      choices: ['Cu est proportionnel à g', 'Cu est indépendant de g', 'Cu décroît quand g augmente'],
      correct: a.cuProp ? 0 : 1,
      explanation: `Pour un glissement faible, Ce = K·g : le rapport Cu/g ne varie que de ${fr(a.spread * 100, 2)} % entre ¼ et pleine charge, la courbe est une droite passant près de l'origine.`,
    },
    'mas-q6-cos': {
      kind: 'choix',
      choices: ['Parce que la puissance réactive magnétisante domine la faible puissance active absorbée', 'Parce que le courant à vide est nul', 'Parce que le rendement est maximal à vide'],
      correct: a.cos0 < 0.3 ? 0 : 1,
      explanation: `À vide, Pa ne couvre que les pertes (≈ ${MAS.releves[0].pa} W) alors que Qa ≈ ${MAS.releves[0].qa} var magnétise la machine : cos φ = Pa/S ≈ ${fr(a.cos0, 2)}.`,
    },
    'mas-q6-qa': {
      kind: 'choix',
      choices: ['Qa est presque constante', 'Qa est proportionnelle au couple', 'Qa s’annule en charge'],
      correct: a.qaFlat ? 0 : 1,
      explanation: `Qa sert surtout à magnétiser la machine, à tension constante : elle ne varie que de ${fr(a.qaVar * 100, 2)} % entre vide et pleine charge.`,
    },
    'mas-q7-uf': {
      expected: a.uf,
      unit: 'V/Hz',
      explanation: `U/f ≈ ${fr(a.uf)} V/Hz, constant : le variateur maintient le flux (Φ ∝ U/f) à toutes les vitesses. En mode RMS, l'appareil ajoute les harmoniques des créneaux ±${MAS.variateurCreneau} V et U/f n'apparaît plus constant : seul le fondamental est utile à la machine.`,
    },
    'mas-q7-var': {
      kind: 'choix',
      choices: ['Il fait varier la vitesse en changeant f, à flux constant (U/f constant)', 'Il augmente le rendement en réduisant le glissement à zéro', 'Il ne sert qu’au démarrage'],
      correct: a.nPropF ? 0 : 1,
      explanation: 'N ≈ Ns·(1 − g) avec Ns = 60·f/p : la vitesse suit la fréquence, et le rapport U/f constant garde le couple disponible.',
    },
    'mas-bilan-qcm': {
      kind: 'choix',
      choices: [
        'Le bilan au point nominal : les puissances mesurées sont grandes et le cos φ élevé (≈ 0,8), l’erreur relative reste faible',
        'La séparation à vide : elle n’utilise que deux essais simples',
        'Les deux méthodes sont équivalentes et donnent le même Pméca',
      ],
      correct: a.bilan.pmeca > 0 && a.loss.pmeca < 0 ? 0 : 2,
      explanation: `Avec les valeurs du banc, le bilan donne Pméca ≈ ${fr(a.bilan.pmeca)} W contre ${fr(a.loss.pmeca)} W pour la séparation à vide. Les deux méthodes ne concordent pas. La séparation à vide est peu fiable, parce que le circuit est saturé et que le wattmètre est imprécis à faible cos φ.`,
    },
  }
}

/** Q8 (α) : explication selon le signe du Pméca calculé depuis les mesures fournies. */
function q8Spec(inputs: LossInputs): AnswerSpec {
  return {
    expected: lossSeparation(exactNoLoad()).alpha,
    unit: 'W/V²',
    tolerance: 0.1,
    explanation: `PjsΔ = 3·Rs·(I0Δ/√3)², PjsY = 3·Rs·I0Y² ; α = (PcΔ − PcY)/(U² − V²) ; Pméca = PcΔ − α·U². ${lossVerdict(inputs).text}`,
  }
}

/** Clé de correction (questions et tableaux non affichés à la remise d'un examen) ; Q8 avec les valeurs exactes. */
export function answerKey(): Record<string, QuestionMeta> {
  return {
    ...Object.fromEntries(Object.entries(specs()).map(([id, sp]) => [id, metaOf(sp)])),
    'mas-q8-alpha': metaOf(q8Spec(exactNoLoad())),
    'mas-q3': tableMeta(TABLE_EXPLANATIONS.releve),
    'mas-q7-table': tableMeta(TABLE_EXPLANATIONS.variateur),
    'mas-q8-pertes': tableMeta(TABLE_EXPLANATIONS.pertes),
    'mas-bilan': tableMeta(TABLE_EXPLANATIONS.bilan),
  }
}

export default function AsyncQuestions() {
  const s = useMemo(specs, [])
  // Explication de Q8 selon le signe du Pméca calculé depuis les saisies (valeurs exactes tant qu'elles sont incomplètes)
  const [lossVals, setLossVals] = useState<LossValues>({})
  const q1Ici = (x: string) => ` — Ici : ${x}.`
  return (
    <>
      <QuestionCard id="mas-q1-cu" label="Q1" statement={`Calculer le couple utile nominal de la machine. Le constructeur donne 10N.m.`} {...s['mas-q1-cu']} />
      <QuestionCard id="mas-q1-p" label="Q1" statement={`Combien de paires de pôles possède le moteur ? Quelle est sa vitesse de synchronisme, vitesse à vide ?${q1Ici('nombre de paires de pôles p')}`} {...s['mas-q1-p']} />
      <QuestionCard id="mas-q1-ns" label="Q1" statement={`Combien de paires de pôles possède le moteur ? Quelle est sa vitesse de synchronisme, vitesse à vide ?${q1Ici('vitesse de synchronisme')}`} {...s['mas-q1-ns']} />
      <QuestionCard id="mas-q2" label="Q2" statement="Le moteur 690/400V est directement relié au réseau en prenant garde au couplage. — Ici : quel couplage sur le réseau 400 V ?" {...s['mas-q2']} />
      <Exercise
        id="mas-q3"
        label="Q3"
        statement="Pour un couple utile compris entre la valeur nominale et la valeur nulle (essai à vide) : Cun , ¾Cun , ½Cun , ¼Cun, 0, mesurer : le courant statorique Is, la tension simple V, la puissance active absorbée Pa, la puissance réactive Qa, la puissance apparente S, la vitesse Ω en rd/s. Présenter les résultats sous forme de tableau comme ci-dessous."
      >
        <ReleveTable id="mas-q3" />
      </Exercise>
      <QuestionCard id="mas-q4" label="Q4" statement="Mesurer en continu à l'ohmmètre, la résistance d'une bobine du stator Rs à chaud. (Alimentation coupée, moteur à l'arrêt)." {...s['mas-q4']} />
      <QuestionCard id="mas-q5-p0" label="Q5" statement="Alimenter le moteur sous 400V, mais couplé en étoile. Mesurer P'0 et I's0 (mesure en vue de séparer les pertes magnétiques et mécaniques) — Ici : P'0." {...s['mas-q5-p0']} />
      <QuestionCard id="mas-q5-i0" label="Q5" statement="Alimenter le moteur sous 400V, mais couplé en étoile. Mesurer P'0 et I's0 (mesure en vue de séparer les pertes magnétiques et mécaniques) — Ici : I's0." {...s['mas-q5-i0']} />
      <QuestionCard id="mas-q6-g" label="Q6" statement="Tracer les courbes suivantes : Cu=f(N) et Cu = f(g). — Ici : que montre Cu = f(g) en zone de fonctionnement ?" {...s['mas-q6-g']} />
      <QuestionCard id="mas-q6-cos" label="Q6" statement="Tracer les courbes suivantes : cosφ et η en fonction du couple utile. — Ici : pourquoi cos φ est-il faible à vide ?" {...s['mas-q6-cos']} />
      <QuestionCard id="mas-q6-qa" label="Q6" statement="Tracer la courbe Qa en fonction du couple utile. — Ici : comment évolue Qa ?" {...s['mas-q6-qa']} />
      <Exercise id="mas-q7-table" label="Q7" statement="Tracer la courbe donnant la vitesse en fonction de la fréquence d'alimentation. Conclure sur l'utilité du variateur de vitesse. Relever pour trois points (15, 35 et 50Hz), la fréquence et la tension entre deux phases du moteur. Calculer pour chaque point le rapport U/f, conclure.">
        <VariateurTable id="mas-q7-table" />
      </Exercise>
      <QuestionCard id="mas-q7-uf" label="Q7" statement="Relever pour trois points (15, 35 et 50Hz), la fréquence et la tension entre deux phases du moteur. Calculer pour chaque point le rapport U/f, conclure. — Ici : U/f, tension fondamentale (mode harmonique du wattmètre)." {...s['mas-q7-uf']} />
      <QuestionCard id="mas-q7-var" label="Q7" statement="Conclure sur l'utilité du variateur de vitesse." {...s['mas-q7-var']} />
      <Exercise id="mas-q8-pertes" label="Q8" statement="Résoudre le système pour déterminer α et Pméca.">
        <LossSection id="mas-q8-pertes" vals={lossVals} setVals={setLossVals} />
      </Exercise>
      <QuestionCard id="mas-q8-alpha" label="Q8" statement="Pour séparer les pertes mécaniques et les pertes magnétiques, on suppose que les pertes magnétiques sont proportionnelles au carré de la tension stator, Pmag = α.U² montage triangle ou α.V² montage étoile. Résoudre le système pour déterminer α et Pméca. — Ici : α." {...q8Spec(lossComplete(lossVals) ? lossInputs(lossVals) : exactNoLoad())} />
      <Exercise id="mas-bilan" label="Bilan" statement="Bilan de puissance au point nominal : à partir de vos mesures en charge nominale et de α, calculer Pjs, Pfer, Ptr, Pjr, Pméca et η, puis comparer au Pméca de la séparation des pertes.">
        <BalanceSection id="mas-bilan" lossVals={lossVals} />
      </Exercise>
      <QuestionCard id="mas-bilan-qcm" label="Bilan" statement="Quelle méthode donne l'estimation la plus fiable des pertes mécaniques, et pourquoi ?" {...s['mas-bilan-qcm']} />
    </>
  )
}
