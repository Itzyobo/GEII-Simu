import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { Action, EtatBanc } from '../banc'
import { periodeGbf } from '../instruments/gbf'
import type { Enregistrement, PlanAcquisition } from '../instruments/oscillo'
import { MONTAGES, PRESET_TP1, massesNonNoires, nomBorne, type Borne as IdBorne } from '../sim/cablage'
import { BANC_REEL, simulate, vitesseAffichee } from '../sim/simulate'
import { cheminCable, type Rect } from './cables'
import Gbf from './Gbf'
import Moteur from './Moteur'
import Oscillo from './Oscillo'
import Platine from './Platine'
import type { PropsBornes } from './types'

const C = MISE_EN_PAGE.cable
const UI = MISE_EN_PAGE.ui
type Points = Partial<Record<IdBorne, { x: number; y: number }>>

export interface OptionsEtabli {
  /** Bouton « Préréglage câblage TP1 » (banc libre seulement : en TP, l'étudiant câble lui-même) */
  preset?: boolean
  /** Sélecteur de variante de l'enseignant (ampli de courant bloqué) */
  variantes?: boolean
  /** Dernier enregistrement affiché par l'oscilloscope */
  onEnregistrement?: (rec: Enregistrement | null) => void
}

/** Établi : GBF sur l'oscilloscope à gauche, platine au centre, moteur à droite ; câbles posés borne à borne */
export default function Etabli({ etat, agir, preset = true, variantes = false, onEnregistrement }: { etat: EtatBanc; agir: (a: Action) => void } & OptionsEtabli) {
  const s = etat.session
  const [choisie, setChoisie] = useState<IdBorne | null>(null)
  const [couleur, setCouleur] = useState<string>(C.couleurs[1])
  const [cableActif, setCableActif] = useState<string | null>(null)
  const [points, setPoints] = useState<Points>({})
  const [zones, setZones] = useState<Rect[]>([])
  /** Extrémité de câble en cours de déplacement (« Déplacer cette extrémité », puis clic sur la borne d'arrivée) */
  const [deplacement, setDeplacement] = useState<{ id: string; de: IdBorne } | null>(null)
  const plan = useRef<HTMLDivElement>(null)

  // Positions des bornes, mesurées dans le DOM (le dessin des instruments reste en flux normal)
  useLayoutEffect(() => {
    const el = plan.current
    if (!el) return
    const mesurer = () => {
      const r = el.getBoundingClientRect()
      const p: Points = {}
      el.querySelectorAll<HTMLElement>('[data-borne]').forEach((b) => {
        const q = b.getBoundingClientRect()
        p[b.dataset.borne as IdBorne] = { x: q.left + q.width / 2 - r.left, y: q.top + q.height / 2 - r.top }
      })
      setPoints(p)
      // Zones que les câbles contournent : panneau de commandes de l'oscilloscope
      setZones([...el.querySelectorAll<HTMLElement>('[data-exclusion]')].map((z) => {
        const q = z.getBoundingClientRect()
        return { left: q.left - r.left, top: q.top - r.top, right: q.right - r.left, bottom: q.bottom - r.top }
      }))
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onBorne = (id: IdBorne) => {
    setCableActif(null)
    if (deplacement) {
      if (id !== deplacement.de) agir({ type: 'rebrancher', id: deplacement.id, de: deplacement.de, vers: id })
      return setDeplacement(null)
    }
    if (!choisie) return setChoisie(id)
    if (choisie !== id) agir({ type: 'ajouter-cable', a: choisie, b: id, couleur })
    setChoisie(null)
  }
  const bornes: PropsBornes = { choisie, verrouillee: s.platine.sousTension, onBorne }

  const { gbf, platine, cablage } = s
  const simuler = useCallback(
    (graine: number, p: PlanAcquisition) => {
      const r = simulate(BANC_REEL, { gbf, platine, duree: p.duree, pasSortie: p.pasSortie }, cablage, graine)
      return { t: r.t, voies: [r.voie1, r.voie2, r.voie3, r.voie4] }
    },
    [gbf, platine, cablage],
  )
  // Animation du moteur : vitesse simulée (sans bruit), pas le câblage
  const vitesse = useMemo(() => vitesseAffichee(BANC_REEL, { gbf, platine }, cablage), [gbf, platine, cablage])
  const alerteMasse = massesNonNoires(cablage)
  const verdict = etat.verdict
  const actif = cablage.find((c) => c.id === cableActif)

  return (
    <div className="space-y-3">
      {/* Barre d'outils : câbles, montage attendu, Faire vérifier, messages */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-au3-panel p-2 text-xs ring-1 ring-au3-line">
        <span className="text-au3-muted">Couleur du câble</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Couleur du prochain câble">
          {C.couleurs.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={couleur === c} aria-label={`Couleur ${c}`} onClick={() => setCouleur(c)} className={`h-6 w-6 rounded-full ring-2 ${couleur === c ? 'ring-au3-accent' : 'ring-white/20'}`} style={{ background: c }} />
          ))}
        </div>
        {preset && (
          <button type="button" onClick={() => agir({ type: 'remplacer-cablage', cablage: PRESET_TP1 })} className="rounded bg-au3-panel-2 px-2 py-1 ring-1 ring-au3-line hover:ring-au3-accent">
            Préréglage câblage TP1
          </button>
        )}
        <button type="button" onClick={() => agir({ type: 'remplacer-cablage', cablage: [] })} className="rounded bg-au3-panel-2 px-2 py-1 ring-1 ring-au3-line hover:ring-au3-accent">
          Tout débrancher
        </button>
        {variantes && (
          <label className="flex items-center gap-1 text-au3-muted">
            Variante enseignant
            <select
              value={platine.ampli.startsWith('bloque') ? platine.ampli : platine.ampli === 'normal' ? 'normal' : 'en-cours'}
              onChange={(e) => agir({ type: 'variante-ampli', etat: e.target.value as 'normal' | 'bloque-haut' | 'bloque-zero' })}
              className="rounded bg-au3-panel-2 px-1 text-au3-ink"
            >
              <option value="normal">ampli normal</option>
              <option value="bloque-haut">ampli bloqué (+USAT)</option>
              <option value="bloque-zero">ampli bloqué (0 V)</option>
              {platine.ampli.startsWith('reamorce') && <option value="en-cours">ampli réamorcé (procédure en cours)</option>}
            </select>
          </label>
        )}
        <span className="ml-auto text-au3-muted">Montage attendu : {MONTAGES[etat.montage].titre}</span>
        <button type="button" onClick={() => agir({ type: 'faire-verifier' })} className="rounded bg-au3-accent px-3 py-1 font-semibold text-black">
          Faire vérifier
        </button>
      </div>

      {deplacement && (
        <p className="rounded bg-au3-panel-2 px-3 py-1.5 text-xs" role="status">
          Cliquez la borne où rebrancher l’extrémité <strong>{nomBorne(deplacement.de)}</strong>.{' '}
          <button type="button" className="underline" onClick={() => setDeplacement(null)}>
            Annuler
          </button>
        </p>
      )}
      {choisie && (
        <p className="rounded bg-au3-panel-2 px-3 py-1.5 text-xs" role="status">
          Borne choisie : <strong>{nomBorne(choisie)}</strong> — cliquez sur une autre borne pour poser le câble.{' '}
          <button type="button" className="underline" onClick={() => setChoisie(null)}>
            Annuler
          </button>
        </p>
      )}
      {etat.message && (
        <p className="flex items-center justify-between rounded bg-au3-err/15 px-3 py-1.5 text-xs text-au3-err ring-1 ring-au3-err/40" role="alert">
          {etat.message}
          <button type="button" className="underline" onClick={() => agir({ type: 'effacer-message' })}>
            OK
          </button>
        </p>
      )}
      {verdict && (
        <div className="rounded bg-au3-panel p-2 text-xs ring-1 ring-au3-line" role="status">
          <p className={verdict.manquantes.length ? 'text-au3-warn' : 'text-au3-ok'}>
            Vérification : {verdict.correctes.length}/{verdict.total} liaisons correctes
          </p>
          {verdict.manquantes.map((l) => (
            <p key={l.nom} className="text-au3-muted">
              ✗ {l.nom}
            </p>
          ))}
        </div>
      )}
      {alerteMasse.length > 0 && (
        <p className="rounded bg-au3-warn/15 px-3 py-1.5 text-xs text-au3-warn ring-1 ring-au3-warn/40" role="status">
          Masse câblée avec un câble non noir ({alerteMasse.length}) : l’énoncé demande des câbles noirs pour toutes les masses.
        </p>
      )}
      {s.evenementsSousTension.length > 0 && <p className="text-xs text-au3-muted">Manipulations sous tension refusées : {s.evenementsSousTension.length}</p>}
      {actif && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-au3-panel p-2 text-xs ring-1 ring-au3-accent">
          <span>
            Câble {nomBorne(actif.a)} — {nomBorne(actif.b)}
          </span>
          {C.couleurs.map((c) => (
            <button key={c} type="button" aria-label={`Recolorer en ${c}`} onClick={() => agir({ type: 'couleur-cable', id: actif.id, couleur: c })} className="h-5 w-5 rounded-full ring-1 ring-white/30" style={{ background: c }} />
          ))}
          {[actif.a, actif.b].map((b) => (
            <button key={b} type="button" className="rounded bg-au3-panel-2 px-2 py-0.5 ring-1 ring-au3-line" onClick={() => (setDeplacement({ id: actif.id, de: b }), setCableActif(null))}>
              Déplacer l’extrémité {nomBorne(b)}
            </button>
          ))}
          <button type="button" className="rounded bg-au3-err/20 px-2 py-0.5 text-au3-err" onClick={() => (agir({ type: 'retirer-cable', id: actif.id }), setCableActif(null))}>
            Débrancher
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-[#101215] p-3 ring-1 ring-au3-line">
        <div ref={plan} className="relative flex items-start gap-4" style={{ width: UI.largeurEtabli, minHeight: UI.hauteurEtabli }}>
          <div className="flex flex-col gap-3">
            <div className="w-80">
              <Gbf gbf={gbf} onChange={(patch) => agir({ type: 'gbf', patch })} bornes={bornes} />
            </div>
            <Oscillo
              osc={s.oscillo}
              curseurs={s.curseurs}
              onOsc={(patch) => agir({ type: 'oscillo', patch })}
              onCurseurs={(patch) => agir({ type: 'curseurs', patch })}
              onAutoscale={() => agir({ type: 'autoscale' })}
              simuler={simuler}
              periode={periodeGbf(gbf)}
              pasEuler={BANC_REEL.pas}
              bornes={bornes}
              onEnregistrement={onEnregistrement}
            />
          </div>
          <div className="w-80 pt-10">
            <Platine platine={platine} onReglage={(patch) => agir({ type: 'platine', patch })} onInterrupteur={() => agir({ type: 'interrupteur' })} bornes={bornes} />
          </div>
          <div className="w-48 pt-24">
            <Moteur bornes={bornes} vitesse={vitesse} />
          </div>

          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-label="Câbles">
            {cablage.map((c) => {
              const a = points[c.a]
              const b = points[c.b]
              if (!a || !b) return null
              return (
                <g key={c.id} className="pointer-events-auto cursor-pointer" onClick={() => setCableActif(c.id)}>
                  <path d={cheminCable(a, b, zones)} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth={C.epaisseur * 2} strokeLinecap="round" />
                  <path d={cheminCable(a, b, zones)} fill="none" stroke={c.couleur} strokeWidth={C.epaisseur} strokeLinecap="round" className={cableActif === c.id ? 'opacity-100' : 'opacity-90'} />
                  <title>{`${nomBorne(c.a)} — ${nomBorne(c.b)}`}</title>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
