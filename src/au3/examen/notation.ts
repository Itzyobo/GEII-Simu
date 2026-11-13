import { AU3_ATTENDUS, AU3_QUESTIONS, type Attendu, type QuestionAu3 } from '../../data/questions.au3'
import { au3 } from '../../data/reference'
import type { IncidentExamen, SessionAu3, SessionExamen, TpExamen } from '../session'
import { mulberry32 } from '../sim/prng'
import { MS_PAR_SECONDE } from '../unites'
import type { Correction } from '../tp1/correction'
import type { Catalogue, ChampDef, OuverteDef } from './catalogue'

/** TP du tirage au sort et incident, déterministes pour une graine */
export const TPS_EXAMEN: readonly TpExamen[] = ['tp1', 'tp2', 'tp4']
export function tirage(graine: number): { tp: TpExamen; incident: IncidentExamen } {
  const alea = mulberry32(graine)
  const tp = TPS_EXAMEN[Math.min(TPS_EXAMEN.length - 1, Math.floor(alea() * TPS_EXAMEN.length))]!
  return { tp, incident: alea() < 1 / au3('INCIDENT_UN_SUR') ? 'ampli-bloque' : 'aucun' }
}

/** Temps restant (s), calculé depuis l'horodatage absolu de début : le temps passé page fermée compte */
export const dureeExamen = (ex: SessionExamen) => ex.duree ?? au3('DUREE_EXAMEN')
export const tempsRestant = (ex: SessionExamen, maintenant: number) => Math.max(0, dureeExamen(ex) - (Math.min(maintenant, ex.finA ?? maintenant) - ex.debut) / MS_PAR_SECONDE)

export interface NoteChamp {
  def: ChampDef
  reponse: string | null
  correction: Correction | null
  points: number
}
export interface NoteOuverte {
  def: OuverteDef
  reponse: string | null
  points: number
}
export interface NoteQuestion {
  question: QuestionAu3
  champs: NoteChamp[]
  ouvertes: NoteOuverte[]
  points: number
  max: number
  traitee: boolean
}
export interface Penalite {
  instant: number
  type: 'manip-sous-tension' | 'autoscale'
  points: number
  detail: string
}
export interface Bilan {
  questions: NoteQuestion[]
  cablage: { points: number; max: number; essaiReussi: number | null; essais: number }
  penalites: Penalite[]
  brut: number
  total: number
  max: number
  parAttendu: { attendu: Attendu; points: number; max: number; couvert: boolean; evalue: boolean }[]
}

const scoreVerdict = (c: Correction | null) => (!c ? 0 : c.verdict === 'juste' ? 1 : c.verdict === 'incomplete' ? au3('COEF_INCOMPLET') : 0)

/** Question qualitative : bon choix et justification = 1 ; bon choix sans justification = COEF_INCOMPLET */
function scoreOuverte(def: OuverteDef, reponse: string | null): number {
  if (!reponse || def.attendu === null) return 0
  const [choix, ...texte] = reponse.split('\n')
  if (choix !== def.attendu) return 0
  return texte.join('\n').trim() ? 1 : au3('COEF_INCOMPLET')
}

/** Questions d'un TP notées : celles qui ont au moins un champ ou une question qualitative au catalogue */
export function questionsNotees(tp: TpExamen, c: Catalogue): QuestionAu3[] {
  const ids = new Set([...Object.keys(c.champs), ...Object.keys(c.ouvertes)].map((id) => id.split('#')[0]))
  return AU3_QUESTIONS.filter((q) => q.tp === tp && q.statut === 'disponible' && !q.optionnelle && ids.has(q.id))
}

/** Note de l'examen : questions, câblage (barème des essais), pénalités, bilan par attendu officiel */
export function noter(s: SessionAu3, tp: TpExamen, c: Catalogue): Bilan {
  const pq = au3('POINTS_QUESTION')
  const champsDe = (q: QuestionAu3) => Object.values(c.champs).filter((x) => x.id.split('#')[0] === q.id)
  const ouvertesDe = (q: QuestionAu3) => Object.values(c.ouvertes).filter((x) => x.id.split('#')[0] === q.id)
  const questions = questionsNotees(tp, c).map((q): NoteQuestion => {
    const champs = champsDe(q).map((def): NoteChamp => {
      const r = s.reponses[def.id]
      const correction = r && def.attendu !== null ? def.corriger(r.valeur, r.lectures) : null
      return { def, reponse: r?.valeur ?? null, correction, points: scoreVerdict(correction) }
    })
    const ouvertes = ouvertesDe(q).map((def): NoteOuverte => {
      const r = s.reponses[def.id]?.valeur ?? null
      return { def, reponse: r, points: scoreOuverte(def, r) }
    })
    const scores = [...champs, ...ouvertes].map((x) => x.points)
    // POINTS_PAR_CHAMP : la question est partagée à parts égales entre ses champs
    return { question: q, champs, ouvertes, points: (pq * au3('POINTS_PAR_CHAMP') * scores.reduce((a, b) => a + b, 0)) / Math.max(1, scores.length), max: pq, traitee: [...champs, ...ouvertes].some((x) => x.reponse !== null) }
  })
  const essai = s.essaiReussi
  const coefCablage = essai === 1 ? 1 : essai === 2 ? au3('COEF_DEUXIEME_ESSAI') : 0
  const cablage = { points: au3('POINTS_CABLAGE') * coefCablage, max: au3('POINTS_CABLAGE'), essaiReussi: essai, essais: s.essaisVerification }
  const penalites: Penalite[] = [
    ...s.evenementsSousTension.map((e) => ({ instant: e.instant, type: e.type, points: au3('PENALITE_SOUS_TENSION'), detail: e.detail })),
    ...s.fautes.map((e) => ({ instant: e.instant, type: e.type, points: au3('PENALITE_AUTOSCALE'), detail: e.detail })),
  ].sort((a, b) => a.instant - b.instant)
  const brut = questions.reduce((a, q) => a + q.points, 0) + cablage.points - penalites.reduce((a, p) => a + p.points, 0)
  const qCablage = AU3_QUESTIONS.find((q) => q.id === `${tp}-cablage`)
  const parAttendu = AU3_ATTENDUS.map((attendu) => {
    const qs = questions.filter((n) => n.question.attendus.includes(attendu.id))
    const avecCablage = !!qCablage?.attendus.includes(attendu.id)
    return {
      attendu,
      points: qs.reduce((a, q) => a + q.points, 0) + (avecCablage ? cablage.points : 0),
      max: qs.reduce((a, q) => a + q.max, 0) + (avecCablage ? cablage.max : 0),
      couvert: AU3_QUESTIONS.some((q) => q.attendus.includes(attendu.id) && q.statut === 'disponible'),
      evalue: attendu.tp === tp && (qs.length > 0 || avecCablage),
    }
  })
  return { questions, cablage, penalites, brut, total: Math.max(0, brut), max: questions.reduce((a, q) => a + q.max, 0) + cablage.max, parAttendu }
}
