import { useMemo, useState, type PointerEvent } from 'react'
import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { Croix, ProgressionTp1 } from '../session'
import { rapportT3T1, wnT1, wnT3 } from './abaque'
import { nombre } from './affichage'

const A = MISE_EN_PAGE.abaque
const COUL = MISE_EN_PAGE.identification.couleurs
const W = A.largeur
const H = A.hauteur
const G = A.marge
const ZMIN = au3('ABAQUE_Z_MIN')
const ZMAX = au3('ABAQUE_Z_MAX')

/** Axe z logarithmique (comme l'abaque de l'énoncé), axe des ordonnées linéaire */
const xDeZ = (z: number) => G.gauche + ((Math.log(z) - Math.log(ZMIN)) / (Math.log(ZMAX) - Math.log(ZMIN))) * (W - G.gauche - G.droite)
const zDeX = (x: number) => Math.exp(Math.log(ZMIN) + ((x - G.gauche) / (W - G.gauche - G.droite)) * (Math.log(ZMAX) - Math.log(ZMIN)))
const yDeV = (v: number) => H - G.bas - (v / A.yMax) * (H - G.haut - G.bas)

type Courbe = 'rapport' | 'wn'

/**
 * Abaque interactif (I.2.2 Q2 et Q3) : courbes t3/t1(z) et ωn·t3(z) calculées depuis la réponse d'ordre 2
 * normalisée. L'étudiant pose une croix sur une courbe (clic, ou ◀ ▶) : on affiche sa lecture.
 * Méthode de l'énoncé : ωn = (ωn·t3)/t3 ; passer par t1 (courbe ωn·t1) est signalé comme un écart de méthode.
 */
export default function Abaque({ tp1, onChange, examen = false }: { tp1: ProgressionTp1; onChange: (p: Partial<ProgressionTp1>) => void; examen?: boolean }) {
  const [courbe, setCourbe] = useState<Courbe>('rapport')
  const [survol, setSurvol] = useState<number | null>(null)
  const fWn = tp1.methodeWn === 't3' ? wnT3 : wnT1
  const nomWn = tp1.methodeWn === 't3' ? 'ωn·t3' : 'ωn·t1'
  const zs = useMemo(() => Array.from({ length: A.points + 1 }, (_, i) => ZMIN * (ZMAX / ZMIN) ** (i / A.points)), [])
  const pts = useMemo(() => ({ rapport: zs.map((z) => [z, rapportT3T1(z)] as const), wn: zs.map((z) => [z, fWn(z)] as const) }), [zs, fWn])
  const f = (c: Courbe) => (c === 'rapport' ? rapportT3T1 : fWn)
  const cle = (c: Courbe) => (c === 'rapport' ? 'croixT3T1' : 'croixWnT')
  const poser = (c: Courbe, z: number) => {
    const zz = Math.min(ZMAX, Math.max(ZMIN, z))
    onChange({ [cle(c)]: { z: zz, y: f(c)(zz) } satisfies Croix })
  }
  const croix = (c: Courbe) => (c === 'rapport' ? tp1.croixT3T1 : tp1.croixWnT)
  const pasLog = (ZMAX / ZMIN) ** (1 / A.points)
  const versZ = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return zDeX(((e.clientX - r.left) * W) / r.width)
  }
  const chemin = (p: readonly (readonly [number, number])[]) => p.map(([z, v], i) => `${i ? 'L' : 'M'} ${xDeZ(z).toFixed(1)} ${yDeV(v).toFixed(1)}`).join(' ')
  const marque = (c: Courbe, couleur: string) => {
    const x = croix(c)
    if (!x) return null
    const cx = xDeZ(x.z)
    const cy = yDeV(x.y)
    return (
      <g stroke={couleur} strokeWidth="2.5" data-croix={c}>
        <line x1={cx - A.croix} y1={cy - A.croix} x2={cx + A.croix} y2={cy + A.croix} />
        <line x1={cx - A.croix} y1={cy + A.croix} x2={cx + A.croix} y2={cy - A.croix} />
      </g>
    )
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-au3-muted">Croix sur :</span>
        {(['rapport', 'wn'] as const).map((c) => (
          <button key={c} type="button" aria-pressed={courbe === c} onClick={() => setCourbe(c)} className={`rounded px-2 py-0.5 ring-1 ring-au3-line ${courbe === c ? 'bg-au3-accent text-on-accent' : 'bg-au3-panel-2'}`}>
            {c === 'rapport' ? 't3/t1' : nomWn}
          </button>
        ))}
        <button type="button" aria-label="Croix : z plus petit" className="rounded bg-au3-panel-2 px-1.5 ring-1 ring-au3-line" onClick={() => poser(courbe, (croix(courbe)?.z ?? 1) / pasLog)}>
          ◀
        </button>
        <button type="button" aria-label="Croix : z plus grand" className="rounded bg-au3-panel-2 px-1.5 ring-1 ring-au3-line" onClick={() => poser(courbe, (croix(courbe)?.z ?? 1) * pasLog)}>
          ▶
        </button>
        <label className="ml-auto flex items-center gap-1 text-au3-muted">
          ωn calculé avec
          <select value={tp1.methodeWn} onChange={(e) => onChange({ methodeWn: e.target.value as 't3' | 't1', croixWnT: null })} className="rounded bg-au3-panel-2 px-1 text-au3-ink">
            <option value="t3">t3 (énoncé)</option>
            <option value="t1">t1</option>
          </select>
        </label>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none rounded bg-au3-panel ring-1 ring-au3-line"
        role="img"
        aria-label={`Abaque : t3/t1 et ${nomWn} en fonction de z (échelle logarithmique)`}
        onPointerDown={(e) => poser(courbe, versZ(e))}
        onPointerMove={(e) => setSurvol(versZ(e))}
        onPointerLeave={() => setSurvol(null)}
      >
        {A.graduationsZ.map((z) => (
          <g key={z}>
            <line x1={xDeZ(z)} x2={xDeZ(z)} y1={G.haut} y2={H - G.bas} stroke="var(--color-au3-line)" />
            <text x={xDeZ(z)} y={H - G.bas + G.bas / 2} fill="var(--color-au3-muted)" fontSize="11" textAnchor="middle">
              {nombre(z)}
            </text>
          </g>
        ))}
        {Array.from({ length: A.yMax / A.pasY + 1 }, (_, i) => i * A.pasY).map((v) => (
          <g key={v}>
            <line x1={G.gauche} x2={W - G.droite} y1={yDeV(v)} y2={yDeV(v)} stroke="var(--color-au3-line)" />
            <text x={G.gauche - A.croix} y={yDeV(v)} dy="4" fill="var(--color-au3-muted)" fontSize="11" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <text x={W - G.droite} y={H - A.croix} fill="var(--color-au3-muted)" fontSize="11" textAnchor="end">
          z (coefficient d’amortissement)
        </text>
        <path d={chemin(pts.rapport)} fill="none" stroke={COUL.mesure} strokeWidth="2" />
        <path d={chemin(pts.wn)} fill="none" stroke={COUL.modele} strokeWidth="2" strokeDasharray={MISE_EN_PAGE.identification.tirets} />
        {/* Étiquettes directes (l'identité ne repose pas sur la couleur seule) */}
        <text x={W - G.droite} y={yDeV(pts.rapport[pts.rapport.length - 1]![1])} dy="-6" fill="var(--color-au3-ink)" fontSize="11" textAnchor="end">
          t3/t1
        </text>
        <text x={xDeZ(A.etiquetteZ)} y={yDeV(fWn(A.etiquetteZ))} dx="-8" dy="-4" fill="var(--color-au3-ink)" fontSize="11" textAnchor="end">
          {nomWn}
        </text>
        {survol !== null && survol >= ZMIN && survol <= ZMAX && (
          <g pointerEvents="none">
            <line x1={xDeZ(survol)} x2={xDeZ(survol)} y1={G.haut} y2={H - G.bas} stroke="var(--color-au3-ink)" strokeDasharray={MISE_EN_PAGE.identification.pointilles} />
            <text x={G.gauche + A.croix} y={G.haut + A.croix * 2} fill="var(--color-au3-ink)" fontSize="11">
              z = {nombre(survol)} · t3/t1 = {nombre(rapportT3T1(survol))} · {nomWn} = {nombre(fWn(survol))}
            </text>
          </g>
        )}
        {marque('rapport', COUL.mesure)}
        {marque('wn', COUL.modele)}
      </svg>
      <p className="font-mono" role="status" data-lecture-abaque>
        {tp1.croixT3T1 ? `Croix t3/t1 : z = ${nombre(tp1.croixT3T1.z)} (t3/t1 = ${nombre(tp1.croixT3T1.y)})` : 'Pas de croix sur t3/t1'}
        {' · '}
        {tp1.croixWnT ? `Croix ${nomWn} : z = ${nombre(tp1.croixWnT.z)}, ${nomWn} = ${nombre(tp1.croixWnT.y)}` : `Pas de croix sur ${nomWn}`}
      </p>
      {tp1.methodeWn === 't1' && !examen && (
        <p className="text-au3-warn" role="status">
          Écart de méthode : l’énoncé impose ωn = (ωn·t3)/t3 (croix sur la courbe ωn·t3). Passer par t1 n’est pas pénalisé hors mode examen, mais la précision dépend alors de t1, plus court et moins précis.
        </p>
      )}
    </div>
  )
}
