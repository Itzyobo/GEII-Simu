/**
 * Clone du logiciel « SERVEUR JBUS/MODBUS » du TP (fenêtre Windows grise classique), un par PC.
 * Configuration Serveur : Analyseur (liste des trames, Détail Trame, Messages système), Maître (Nouvelle trame,
 * Liste des trames mémorisées), Parcours Réseau (fenêtre « Esclaves détectés sur le bus », reconstituée).
 */
import { useState, type ReactNode } from 'react'
import { REF } from '../data/reference'
import { detectes, trafic } from '../lib/bench'
import { dispatch, parcoursEnCours, useStore, type CardId } from '../lib/store'
import { toHex } from '../models/crc'
import { buildRequest, FONCTIONS, type Base, type Field, type FieldKey } from '../models/modbus'
import { analyzerDecode } from '../models/slaves'
import UnverifiedBadge from './UnverifiedBadge'

const PARITY_LABEL = { none: 'Aucune', even: 'Paire', odd: 'Impaire' } as const
const I = REF.parcoursIntervalle.value
const N = REF.parcoursAdresses.value
/** Lignes gardées par l'analyseur : au moins un parcours complet (256 requêtes + réponses) et des trames mémorisées */
const ANALYSEUR_MAX = 2 * N

/** Relief Windows classique */
const raised = 'border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040]'
const sunken = 'border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white'

/** « 10:52:14,650 » */
const heure = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())},${p(d.getMilliseconds(), 3)}`
}

/** Heure murale (ms) ; appelée seulement dans les gestionnaires d'événements */
const maintenant = () => Date.now()

type Menu = 'liaison' | 'serveur' | 'filtrage' | 'aide'
type Dialog = 'maitre' | 'liste' | 'apropos' | 'parcours'

export default function ServeurModbus({ card }: { card: CardId }) {
  const s = useStore()
  const sw = s.software[card]
  const [menu, setMenu] = useState<Menu | null>(null)
  const [sub, setSub] = useState<'maitre' | 'esclave' | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const log = (text: string) => dispatch({ type: 'message', card, text: `${heure(maintenant())}  ${text}` })
  const close = () => {
    setMenu(null)
    setSub(null)
  }
  const pick = (fn: () => void) => () => {
    close()
    fn()
  }
  const empty = sw.memorized.length === 0
  const connected = s.wiring.db9[card]
  const analyse = sw.role === 'Analyseur'
  const frames = analyse ? trafic(s, card).slice(-ANALYSEUR_MAX) : []
  const wall = (t: number) => heure((s.sim.wall0 ?? 0) + t * 1000)
  const sel = frames.find((f) => f.t0 === selected)

  return (
    <div onKeyDown={(e) => e.key === 'Escape' && close()} style={{ fontFamily: "Tahoma, 'MS Sans Serif', system-ui, sans-serif" }} className={`relative flex min-h-[420px] flex-col bg-[#c0c0c0] text-[12px] text-black ${raised}`}>
      {/* Barre de titre */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-[#000080] to-[#1084d0] px-1.5 py-0.5 text-white">
        <span className="truncate font-bold">SERVEUR JBUS/MODBUS — PC binôme {card === 'c1' ? 1 : 2}</span>
        <span className="ml-auto flex gap-0.5" aria-hidden>
          {['_', '□', '×'].map((c) => (
            <span key={c} className={`grid h-4 w-4 place-items-center bg-[#c0c0c0] text-[10px] leading-none text-black ${raised}`}>
              {c}
            </span>
          ))}
        </span>
      </div>

      {/* Barre de menus */}
      <div className="relative z-20 flex flex-wrap" role="menubar">
        {(
          [
            ['liaison', 'Configuration Liaison'],
            ['serveur', 'Configuration Serveur'],
            ['filtrage', 'Filtrage'],
            ['aide', '?'],
          ] as const
        ).map(([id, label]) => (
          <div key={id} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={menu === id}
              onClick={() => (menu === id ? close() : (setMenu(id), setSub(null)))}
              className={`px-2 py-1 ${menu === id ? 'bg-[#000080] text-white' : 'hover:bg-[#000080] hover:text-white'}`}
            >
              {label}
            </button>
            {menu === id && (
              <div role="menu" className={`absolute top-full left-0 min-w-56 bg-[#c0c0c0] py-0.5 shadow-md max-sm:fixed max-sm:inset-x-4 max-sm:top-auto max-sm:min-w-0 ${raised}`}>
                {id === 'liaison' && <Item disabled title="Réglages imposés par le TP : COM1, 38 400 bauds, 8 bits, parité paire, 1 stop">Paramètres de la liaison…</Item>}
                {id === 'serveur' && (
                  <>
                    <Item onClick={pick(() => (dispatch({ type: 'role', card, role: 'Analyseur' }), log(connected ? 'Mode Analyseur' : 'Mode Analyseur — aucun réseau connecté')))}>Analyseur</Item>
                    <Item submenu onEnter={() => setSub('maitre')} onClick={() => setSub(sub === 'maitre' ? null : 'maitre')} open={sub === 'maitre'}>
                      Maître
                    </Item>
                    <Item submenu disabled title="hors programme du TP" onEnter={() => setSub('esclave')}>
                      Esclave
                    </Item>
                    <Item
                      onClick={pick(() => {
                        dispatch({ type: 'parcours', card, on: true, wall: maintenant() })
                        log(empty ? 'Parcours Réseau lancé' : `Parcours Réseau lancé — ${sw.memorized.length} trame(s) mémorisée(s) toujours émise(s)`)
                        setDialog('parcours')
                      })}
                    >
                      Parcours Réseau
                    </Item>
                    {sub === 'maitre' && (
                      <div role="menu" className={`absolute top-6 left-full min-w-60 bg-[#c0c0c0] py-0.5 shadow-md max-sm:static max-sm:ml-6 max-sm:min-w-0 max-sm:shadow-none ${raised}`}>
                        <Item onClick={pick(() => setDialog('maitre'))}>Nouvelle trame</Item>
                        <Item disabled={empty} title={empty ? 'Aucune trame mémorisée' : undefined} onClick={pick(() => setDialog('liste'))}>
                          Liste des trames mémorisées
                        </Item>
                      </div>
                    )}
                  </>
                )}
                {id === 'filtrage' && <Item disabled title="Non utilisé dans le TP">Filtrage des trames…</Item>}
                {id === 'aide' && <Item onClick={pick(() => setDialog('apropos'))}>A propos…</Item>}
              </div>
            )}
          </div>
        ))}
      </div>
      {menu && <div className="fixed inset-0 z-10" onClick={close} aria-hidden />}

      {/* Panneau d'analyse */}
      <div className="grid flex-1 gap-1.5 p-1.5 md:grid-cols-2">
        <Pane title="Trames reçues" className="md:row-span-2">
          {!analyse ? (
            <p className="text-[#606060]">Passez en mode Analyseur pour espionner le bus.</p>
          ) : !connected ? (
            <p className="text-[#606060]">aucun réseau connecté</p>
          ) : frames.length === 0 ? (
            <p className="text-[#606060]">Aucune trame reçue.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto font-mono text-[11px]" aria-label="Trames reçues">
              {frames.map((f) => (
                <li key={`${f.t0}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(f.t0)}
                    className={`w-full px-0.5 text-left ${selected === f.t0 ? 'bg-[#000080] text-white' : f.crcOk ? '' : 'text-[#a00000]'}`}
                  >
                    Trame reçue à {wall(f.t1)} Esclave {String(f.bytes[0] ?? 0).padStart(3, '0')} Fonction {(f.bytes[1] ?? 0).toString(16).toUpperCase().padStart(2, '0')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Pane>
        <Pane title="Détail Trame">
          {sel ? (
            <ul className="font-mono text-[11px]">
              {analyzerDecode(sel.bytes, sel.collision ? undefined : sel.type).map((l) => (
                <li key={l} className="break-words">
                  {l}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#606060]">—</p>
          )}
        </Pane>
        <Pane title="Messages système">
          <ul className="max-h-40 overflow-y-auto font-mono text-[11px]">
            {sw.messages.length === 0 && frames.length === 0 && <li className="text-[#606060]">{connected ? '—' : 'aucun réseau connecté'}</li>}
            {sw.messages.map((m, k) => (
              <li key={k} className="break-all">
                {m}
              </li>
            ))}
            {frames.slice(-30).map((f) => (
              <li key={`h${f.t0}`} className="break-all">
                {toHex(f.bytes)}
              </li>
            ))}
          </ul>
        </Pane>
      </div>

      {/* Barre d'état */}
      <div className="flex flex-wrap gap-1 p-0.5">
        {[REF.modbusPort.value, REF.modbusBaud.value, REF.modbusDataBits.value, PARITY_LABEL[REF.modbusParity.value], REF.modbusStopBits.value, sw.role].map((v, k) => (
          <span key={k} className={`px-2 ${sunken}`}>
            {v}
          </span>
        ))}
      </div>

      {dialog === 'maitre' && <ConfigMaitre card={card} log={log} onClose={() => setDialog(null)} />}
      {dialog === 'liste' && <ListeTrames card={card} log={log} onClose={() => setDialog(null)} />}
      {dialog === 'parcours' && <Parcours card={card} onClose={() => setDialog(null)} />}
      {dialog === 'apropos' && (
        <Window title="A propos" onClose={() => setDialog(null)}>
          <p>SERVEUR JBUS/MODBUS — reconstitution pour l’entraînement au TP2.</p>
          <p className="mt-1 text-[#404040]">Fenêtres dessinées d’après le PRD, en l’absence des photos du logiciel.</p>
        </Window>
      )}
    </div>
  )
}

/** Fenêtre « Esclaves détectés sur le bus » (reconstituée) : grille 00 à FF et progression du parcours. */
function Parcours({ card, onClose }: { card: CardId; onClose: () => void }) {
  const s = useStore()
  const p = s.parcours[card]
  const enCours = parcoursEnCours(s, card)
  // Adresses déjà interrogées ; la grille garde le résultat après la fin du parcours
  const k = p === null ? 0 : Math.min(N, Math.floor((Math.min(s.sim.t, p.fin - 1e-9) - p.debut) / I) + 1)
  const trouves = new Set(p === null ? [] : detectes(s, card, p.debut))
  const examen = s.session.mode === 'examen'
  return (
    <Window title="Parcours Réseau" onClose={onClose}>
      <p>Esclaves détectés sur le bus</p>
      <div className={`mt-1 grid grid-cols-16 gap-px bg-white p-0.5 font-mono text-[9px] ${sunken}`} role="grid" aria-label="Adresses 00 à FF">
        {Array.from({ length: N }, (_, adr) => (
          <span
            key={adr}
            role="gridcell"
            aria-label={`${adr.toString(16).toUpperCase().padStart(2, '0')}${trouves.has(adr) ? ' détecté' : ''}`}
            className={`text-center ${trouves.has(adr) ? 'bg-[#008000] font-bold text-white' : enCours && adr === k - 1 ? 'bg-[#000080] text-white' : adr < k ? 'text-[#808080]' : 'text-[#c0c0c0]'}`}
          >
            {adr.toString(16).toUpperCase().padStart(2, '0')}
          </span>
        ))}
      </div>
      <div className={`mt-2 h-4 bg-white ${sunken}`} role="progressbar" aria-valuemin={0} aria-valuemax={N} aria-valuenow={k} aria-label="Progression du parcours">
        <div className="h-full bg-[#000080]" style={{ width: `${(k / N) * 100}%` }} />
      </div>
      <p className="mt-1" role="status">
        {enCours ? `Adresse ${(k - 1).toString(16).toUpperCase().padStart(2, '0')}H — ${k} / ${N}` : k === N ? 'Parcours terminé' : `Parcours arrêté à ${k} / ${N}`} · détectés :{' '}
        {[...trouves].sort((a, b) => a - b).join(', ') || 'aucun'}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <label className="mr-auto flex items-center gap-1" title={examen ? 'Désactivé en mode partiel' : 'Simulation accélérée'}>
          <input type="checkbox" disabled={examen} checked={s.sim.speed === 10} onChange={(e) => dispatch({ type: 'speed', speed: e.target.checked ? 10 : 1 })} />
          Accélérer ×10
        </label>
        {enCours && (
          <button type="button" onClick={() => dispatch({ type: 'parcours', card, on: false, wall: maintenant() })} className={`bg-[#c0c0c0] px-3 py-1 ${raised}`}>
            Arrêter
          </button>
        )}
        <button type="button" onClick={onClose} className={`bg-[#c0c0c0] px-3 py-1 ${raised}`}>
          Fermer
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[#404040]">Fenêtre reconstituée ; {(I * 1000).toFixed(1).replace('.', ',')} ms par adresse (horodatages de l’analyseur).</p>
    </Window>
  )
}

function Item({
  children,
  onClick,
  onEnter,
  disabled,
  title,
  submenu,
  open,
}: {
  children: ReactNode
  onClick?: () => void
  onEnter?: () => void
  disabled?: boolean
  title?: string
  submenu?: boolean
  open?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled}
      aria-haspopup={submenu ? 'menu' : undefined}
      aria-expanded={submenu ? !!open : undefined}
      title={title}
      onMouseEnter={onEnter}
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-center justify-between px-5 py-1 text-left whitespace-nowrap ${disabled ? 'cursor-default text-[#808080] [text-shadow:1px_1px_0_#fff]' : 'hover:bg-[#000080] hover:text-white'} ${open ? 'bg-[#000080] text-white' : ''}`}
    >
      {children}
      {submenu && <span className="ml-4">▸</span>}
    </button>
  )
}

function Pane({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col ${className}`}>
      <h3 className="px-0.5 pb-0.5">{title}</h3>
      <div className={`min-h-20 flex-1 bg-white p-1 ${sunken}`}>{children}</div>
    </section>
  )
}

function Window({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/10 p-2 pt-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full max-w-md bg-[#c0c0c0] shadow-lg ${raised}`}>
        <div className="flex items-center bg-gradient-to-r from-[#000080] to-[#1084d0] px-1.5 py-0.5 text-white">
          <span className="font-bold">{title}</span>
          <button type="button" aria-label="Fermer" onClick={onClose} className={`ml-auto grid h-4 w-4 place-items-center bg-[#c0c0c0] text-[10px] leading-none text-black ${raised}`}>
            ×
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  )
}

/** Bouton de base d'un champ : bascule Décimal ⇄ Hexadécimal (H17). */
function BaseBox({ base, onChange }: { base: Base; onChange: (b: Base) => void }) {
  return (
    <button type="button" onClick={() => onChange(base === 'dec' ? 'hex' : 'dec')} className={`min-w-24 bg-[#c0c0c0] px-2 py-0.5 ${raised}`}>
      {base === 'dec' ? 'Décimal' : 'Hexadécimal'}
    </button>
  )
}

function FieldRow({ label, field, onChange }: { label: string; field: Field; onChange: (f: Field) => void }) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-0.5 sm:grid-cols-[13rem_1fr_auto]">
      <span className="col-span-2 sm:col-span-1">{label}</span>
      <input value={field.text} onChange={(e) => onChange({ ...field, text: e.target.value })} className={`min-w-0 bg-white px-1 py-0.5 font-mono uppercase ${sunken}`} />
      <BaseBox base={field.base} onChange={(base) => onChange({ ...field, base })} />
    </label>
  )
}

function ConfigMaitre({ card, log, onClose }: { card: CardId; log: (t: string) => void; onClose: () => void }) {
  const bases = REF.basesParDefaut.value
  const [esclave, setEsclave] = useState<Field>({ text: '', base: bases.esclave })
  const [code, setCode] = useState<number>(REF.maitreFonctionDefaut.value)
  const [champs, setChamps] = useState<Record<FieldKey, Field>>({
    adresse: { text: '', base: bases.adresse },
    nombre: { text: '', base: bases.nombre },
    valeur: { text: '', base: bases.valeur },
  })
  const [freq, setFreq] = useState(String(REF.pollPeriod.value))
  const [errors, setErrors] = useState<string[]>([])
  const def = FONCTIONS.find((f) => f.code === code)

  const validate = () => {
    const r = buildRequest({ esclave, fonction: code, champs })
    if (!r.ok) return setErrors(r.errors)
    dispatch({ type: 'memorize', card, bytes: r.bytes, wall: maintenant() })
    log(`Trame mémorisée : ${toHex(r.bytes)}`)
    onClose()
  }

  return (
    <Window title="Configuration Maître" onClose={onClose}>
      <div className="space-y-2">
        <FieldRow label="Numéro d’Esclave" field={esclave} onChange={setEsclave} />
        <label className="block">
          <span>Fonction à réaliser</span>
          <select value={code} onChange={(e) => (setCode(Number(e.target.value)), setErrors([]))} className={`mt-0.5 block w-full bg-white px-1 py-0.5 ${sunken}`}>
            {FONCTIONS.map((f) => (
              <option key={f.code} value={f.code}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {def?.fields.map((f) => (
          <FieldRow key={f.key} label={f.label} field={champs[f.key]} onChange={(v) => setChamps((c) => ({ ...c, [f.key]: v }))} />
        ))}
        {def?.list && (
          <p className="text-[11px] text-[#404040]">
            Valeurs séparées par des espaces.
            <UnverifiedBadge deps={['saisieFonctions15et16']} />
          </p>
        )}
        <label className="grid grid-cols-[1fr_5rem] items-center gap-2">
          <span>Fréquence interrogation esclave (en seconde)</span>
          <input value={freq} onChange={(e) => setFreq(e.target.value)} inputMode="numeric" className={`bg-white px-1 py-0.5 font-mono ${sunken}`} />
        </label>
        {errors.length > 0 && (
          <ul className="bg-white p-1 text-[#a00000]" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-center pt-1">
          <button type="button" onClick={validate} className={`min-w-28 bg-[#c0c0c0] px-3 py-1 font-semibold ${raised}`}>
            Validation
          </button>
        </div>
        <p className="text-[11px] text-[#404040]">
          Boîtes de base et intitulés des fonctions 2, 5, 15, 16 reconstitués.
          <UnverifiedBadge deps={['basesParDefaut', 'saisieFonctions15et16']} />
        </p>
      </div>
    </Window>
  )
}

function ListeTrames({ card, log, onClose }: { card: CardId; log: (t: string) => void; onClose: () => void }) {
  const { software } = useStore()
  return (
    <Window title="Liste des trames mémorisées" onClose={onClose}>
      <ol className={`max-h-48 list-inside list-decimal overflow-y-auto bg-white p-1 font-mono ${sunken}`}>
        {software[card].memorized.map((b, k) => (
          <li key={k}>{toHex(b)}</li>
        ))}
      </ol>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'clearMemorized', card })
            log('Trames mémorisées supprimées')
            onClose()
          }}
          className={`bg-[#c0c0c0] px-3 py-1 ${raised}`}
        >
          Supprimer tout
        </button>
        <button type="button" onClick={onClose} className={`bg-[#c0c0c0] px-3 py-1 ${raised}`}>
          Fermer
        </button>
      </div>
    </Window>
  )
}
