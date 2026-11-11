import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { ResultatFit } from '../session'
import { formatSi } from '../ui/format'
import { nombre } from './affichage'
import { modele, penteMesure, penteOrigine, type Fenetre } from './identification'

const I = MISE_EN_PAGE.identification

interface Point {
  t: number
  mesure: number
  modele?: number
  tangenteModele?: number
  tangenteMesure?: number
}

/**
 * Superposition mesure / modèle sur l'échelon positif, avec un zoom sur le démarrage (énoncé I.2.3 Q11 :
 * « Vous pouvez zoomer sur le démarrage autour de t=0 »). Après la réponse de l'étudiant, les tangentes à
 * l'origine sont tracées : non nulle pour l'ordre 1, horizontale pour l'ordre 2 et pour la mesure.
 */
export function Superposition({ f, r, tangentes }: { f: Fenetre; r: ResultatFit; tangentes: boolean }) {
  const { complet, zoom } = useMemo(() => {
    const pas = Math.max(1, Math.floor(f.t.length / I.pointsTrace))
    const tMax = f.t[f.t.length - 1]!
    const pente = penteOrigine(f, r)
    const fin = modele(f, r, tMax)
    const pm = penteMesure(f, r.ordre === 1 ? r.tau! : 1 / r.wn!)
    const pt = (i: number, avecTangentes: boolean): Point => {
      const t = f.t[i]!
      const base = { t, mesure: f.m[i]!, modele: modele(f, r, t) }
      if (!avecTangentes) return base
      const tm = f.m0 + pente * t
      const ts = f.m0 + pm * t
      return { ...base, tangenteModele: tm <= fin ? tm : undefined, tangenteMesure: ts <= fin ? ts : undefined }
    }
    const complet = f.t.flatMap((_, i) => (i % pas === 0 ? [pt(i, false)] : []))
    const nZoom = f.t.findIndex((t) => t > tMax * I.zoom)
    const zoom = f.t.slice(0, nZoom < 0 ? f.t.length : nZoom).flatMap((_, i) => (i % Math.max(1, Math.floor(pas * I.zoom)) === 0 ? [pt(i, tangentes)] : []))
    return { complet, zoom }
  }, [f, r, tangentes])

  const graphe = (data: Point[], titre: string, avecTangentes: boolean) => (
    <figure className="rounded bg-[#101215] p-2 ring-1 ring-au3-line">
      <figcaption className="mb-1 text-[11px] text-au3-muted">{titre}</figcaption>
      <ResponsiveContainer width="100%" height={I.hauteurGraphe}>
        <LineChart data={data} margin={I.marge}>
          <CartesianGrid stroke="#2a2e35" />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => formatSi(t, 's', I.chiffresAxe)} stroke="#a3a9b3" fontSize={I.police} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => formatSi(v, 'V', I.chiffresAxe)} stroke="#a3a9b3" fontSize={I.police} width={I.largeurAxe} />
          <Tooltip contentStyle={{ background: '#1e2127', border: '1px solid #353a44', fontSize: I.police }} labelFormatter={(t) => `t = ${formatSi(Number(t), 's')}`} formatter={(v) => formatSi(Number(v), 'V')} />
          <Legend wrapperStyle={{ fontSize: I.police }} />
          <Line dataKey="mesure" name="Mesure (voie 2)" stroke={I.couleurs.mesure} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="modele" name={`Modèle d’ordre ${r.ordre}`} stroke={I.couleurs.modele} strokeWidth={2} strokeDasharray={I.tirets} dot={false} isAnimationActive={false} />
          {avecTangentes && <Line dataKey="tangenteModele" name={`Tangente à l’origine, ordre ${r.ordre}`} stroke={I.couleurs.tangente} strokeWidth={2} strokeDasharray={I.pointilles} dot={false} isAnimationActive={false} connectNulls={false} />}
          {avecTangentes && <Line dataKey="tangenteMesure" name="Tangente à l’origine, mesure" stroke="#e6e6e6" strokeWidth={1} strokeDasharray={I.pointilles} dot={false} isAnimationActive={false} connectNulls={false} />}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )

  return (
    <div className="space-y-2" data-superposition={r.ordre}>
      {graphe(complet, `Échelon positif : mesure et modèle d’ordre ${r.ordre}`, false)}
      {graphe(zoom, `Zoom sur le démarrage (premiers ${Math.round(I.zoom * MISE_EN_PAGE.pourcent)} % de la fenêtre)`, tangentes)}
    </div>
  )
}

/** Valeurs Matlab du CR, affichées pour comparaison (non testées, ne servent pas de référence) */
export function ValeursMatlabCr({ ordre }: { ordre: 1 | 2 }) {
  return (
    <p className="text-[11px] text-au3-muted">
      Pour comparaison, Matlab dans le CR (non testé, ne sert pas de référence) :{' '}
      {ordre === 1
        ? `G0 = ${nombre(au3('CR_TP1_MATLAB_O1_G0'))}, τ = ${formatSi(au3('CR_TP1_MATLAB_O1_TAU'), 's')}`
        : `G0 = ${nombre(au3('CR_TP1_MATLAB_O2_G0'))}, z = ${nombre(au3('CR_TP1_MATLAB_O2_Z'))}, ωn = ${nombre(au3('CR_TP1_MATLAB_O2_WN'))} rad/s`}
    </p>
  )
}
