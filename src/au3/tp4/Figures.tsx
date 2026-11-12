import { memo, useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MISE_EN_PAGE } from '../miseEnPage'
import { formatSi } from '../ui/format'
import type { ScenarioII } from './attendus'

const I = MISE_EN_PAGE.identification
const COUL = { ...I.couleurs, cc: '#a3a9b3' }

export type SerieII = 'c' | 'm' | 'u' | 'e' | 'cc' | 'mP'
const NOMS: Record<SerieII, string> = { c: 'Consigne C', m: 'Mesure M', u: 'Commande U', e: 'Erreur e = C − M', cc: 'Couple de charge Cc (bouteille, V équivalent)', mP: 'Mesure M, régulateur P seul' }
const COULEURS: Record<SerieII, string> = { c: COUL.tangente, m: COUL.mesure, u: COUL.modele, e: COUL.tangente, cc: COUL.cc, mP: COUL.modele }

/**
 * Figure d'un scénario de la partie II (façon figure Matlab) : séries choisies, sous-échantillonnées.
 * `aire` remplit l'aire sous e(t) : « une intégrale est une aire » (II.4 b), affichée après la réponse.
 * `p` : scénario du régulateur P seul, superposé en série « mP » (II.5 : PI contre P).
 */
function FigureII({ s, series, titre, aire = false, id, p }: { s: ScenarioII; series: readonly SerieII[]; titre: string; aire?: boolean; id: string; p?: ScenarioII }) {
  const data = useMemo(() => {
    const pas = Math.max(1, Math.floor(s.t.length / I.pointsTrace))
    const pts: Record<string, number>[] = []
    for (let i = 0; i < s.t.length; i += pas) pts.push({ t: s.t[i]!, c: s.c[i]!, m: s.m[i]!, u: s.u[i]!, e: s.e[i]!, cc: s.cc[i]!, mP: p?.m[i] ?? NaN })
    return pts
  }, [s, p])
  return (
    <figure className="rounded bg-[#101215] p-2 ring-1 ring-au3-line" data-figure={id}>
      <figcaption className="mb-1 text-[11px] text-au3-muted">{titre}</figcaption>
      <ResponsiveContainer width="100%" height={I.hauteurGraphe}>
        <ComposedChart data={data} margin={I.marge}>
          <CartesianGrid stroke="#2a2e35" />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => formatSi(t, 's', I.chiffresAxe)} stroke="#a3a9b3" fontSize={I.police} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => formatSi(v, 'V', I.chiffresAxe)} stroke="#a3a9b3" fontSize={I.police} width={I.largeurAxe} />
          <Tooltip contentStyle={{ background: '#1e2127', border: '1px solid #353a44', fontSize: I.police }} labelFormatter={(t) => `t = ${formatSi(Number(t), 's')}`} formatter={(v) => formatSi(Number(v), 'V')} />
          <Legend wrapperStyle={{ fontSize: I.police }} />
          {aire && <Area dataKey="e" name="Aire de e(t) (intégrale)" stroke={COULEURS.e} fill={COULEURS.e} fillOpacity={I.opaciteAire} isAnimationActive={false} />}
          {series.map((k) => (
            <Line key={k} dataKey={k} name={NOMS[k]} stroke={COULEURS[k]} strokeWidth={2} strokeDasharray={k === 'c' || k === 'cc' ? I.tirets : undefined} dot={false} isAnimationActive={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  )
}

/** Recharts est coûteux : une figure ne se redessine que si son scénario ou ses séries changent */
export default memo(FigureII, (a, b) => a.s === b.s && a.p === b.p && a.aire === b.aire && a.id === b.id && a.titre === b.titre && a.series.join() === b.series.join())
