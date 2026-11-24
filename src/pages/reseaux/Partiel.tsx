/**
 * Partiel pratique Réseaux (RES3) : 1 h 30, fascicule seul, sans Modbus. Trois parties en onglets (câble coaxial,
 * trame série, ping Ethernet), chacune avec son banc et un oscilloscope en Default Setup. Session en sessionStorage
 * (reprise après rechargement, chrono qui continue), historique en localStorage. Logique : src/lib/reseaux/partiel.ts.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ScopeInstrument from '../../components/ScopeInstrument'
import { RES3_PARTIEL } from '../../data/reference'
import { formatSI } from '../../lib/format'
import {
  addHistory,
  gradePartiel,
  levelFr,
  loadHistory,
  loadSession,
  METHODES,
  newSession,
  PARTIES,
  remainingS,
  saveSession,
  subjectOf,
  submit,
  switchTab,
  type HistoryEntry,
  type PartielAnswers,
  type PartielSession,
  type PartIndex,
} from '../../lib/reseaux/partiel'
import { parityFr, type Level, type Parity } from '../../lib/reseaux/serial'
import { salleTraffic } from '../../lib/reseaux/traffic'
import Layout from '../../modbus/pages/Layout'
import CoaxBench from './CoaxBench'
import { Btn, Card } from './ui'

const fr = (v: number, d = 4) => String(Number(v.toPrecision(d))).replace('.', ',')
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const minutes = (ms: number) => `${Math.round(ms / 60000)} min`

export default function PartielReseaux() {
  const [session, setSession] = useState<PartielSession | null>(() => loadSession())
  const [now, setNow] = useState(() => Date.now())
  // Rendu hors des fonctions de mise à jour d'état : l'historique n'est écrit qu'une fois
  const current = useRef(session)
  current.current = session
  const finish = () => {
    const s = current.current
    if (s && !s.submittedAt) setSession(finalize(s))
  }
  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      // Fin du chrono : rendu automatique
      const s = current.current
      if (s && s.mode === 'exam' && !s.submittedAt && remainingS(s, t) <= 0) finishRef.current()
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => saveSession(session), [session])

  const update = (f: (s: PartielSession) => PartielSession) => setSession((s) => (s ? f(s) : s))

  return (
    <Layout>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted">RÉSEAUX · PARTIEL PRATIQUE</p>
        <h1 className="mt-1 text-2xl font-bold">Partiel Réseaux (1 h 30, fascicule seul)</h1>
        {!session && <Start onStart={(seed, mode) => setSession(newSession(seed, mode, Date.now()))} />}
        {session && !session.submittedAt && <Running s={session} now={now} update={update} finish={finish} />}
        {session?.submittedAt && <Result s={session} onNew={() => setSession(null)} />}
      </main>
    </Layout>
  )
}

/** Rendu de la copie : arrêt du chrono, note inscrite à l'historique */
function finalize(s: PartielSession): PartielSession {
  const done = submit(s, Date.now())
  const r = gradePartiel(subjectOf(s.seed), s.answers)
  addHistory({ date: new Date(done.submittedAt ?? Date.now()).toISOString(), seed: s.seed, mode: s.mode, note: r.note, parts: r.parts.map((p) => p.pts) })
  return done
}

/* ─────────── Démarrage et historique ─────────── */

function Start({ onStart }: { onStart: (seed: number, mode: PartielSession['mode']) => void }) {
  const [seedText, setSeedText] = useState(() => String(Math.floor(Math.random() * 1e6)))
  const [mode, setMode] = useState<PartielSession['mode']>('exam')
  const seed = Number(seedText)
  const valid = Number.isInteger(seed) && seed > 0
  const history = useMemo(() => loadHistory(), [])
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card title="Nouveau sujet">
        <p className="text-sm text-muted">Trois parties : câble coaxial (7 pts), trame série (6 pts), ping Ethernet (7 pts). Seul le fascicule est autorisé ; pas de Modbus.</p>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          Graine du sujet
          <input value={seedText} onChange={(e) => setSeedText(e.target.value.trim())} inputMode="numeric" className="min-h-11 w-32 rounded-lg bg-field px-2 font-mono ring-1 ring-line" aria-label="Graine du sujet" />
          <span className="text-xs text-muted">(même graine = même sujet)</span>
        </label>
        <fieldset className="mt-2 grid gap-1">
          <legend className="sr-only">Mode</legend>
          {(
            [
              ['exam', 'Examen chronométré 1 h 30'],
              ['train', 'Entraînement sans chrono'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="partiel-mode" checked={mode === k} onChange={() => setMode(k)} className="h-4 w-4" />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="mt-3">
          <Btn onClick={() => valid && onStart(seed, mode)} disabled={!valid}>
            Démarrer
          </Btn>
        </div>
      </Card>
      <Card title="Mes tentatives">
        <History h={history} />
      </Card>
    </div>
  )
}

function History({ h }: { h: HistoryEntry[] }) {
  if (h.length === 0) return <p className="text-sm text-muted">Aucune tentative pour l’instant.</p>
  const W = 300
  const H = 100
  const x = (i: number) => (h.length === 1 ? W / 2 : (i * (W - 20)) / (h.length - 1) + 10)
  const y = (n: number) => H - 10 - (n / 20) * (H - 20)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-ink" role="img" aria-label={`Progression des notes : ${h.map((e) => fr(e.note, 3)).join(', ')} sur 20`}>
        <line x1="10" x2={W - 10} y1={y(10)} y2={y(10)} stroke="var(--color-line)" strokeDasharray="4 4" />
        <polyline points={h.map((e, i) => `${x(i)},${y(e.note)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" />
        {h.map((e, i) => (
          <circle key={i} cx={x(i)} cy={y(e.note)} r="3" fill="var(--color-accent)" />
        ))}
      </svg>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-muted">
          <tr>
            <th className="py-1">Date</th>
            <th>Graine</th>
            <th>Mode</th>
            <th>Note</th>
            <th>Parties</th>
          </tr>
        </thead>
        <tbody>
          {[...h].reverse().map((e) => (
            <tr key={e.date} className="border-t border-line">
              <td className="py-1">{new Date(e.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td className="font-mono">{e.seed}</td>
              <td>{e.mode === 'exam' ? 'examen' : 'entr.'}</td>
              <td className="font-semibold">{fr(e.note, 3)}/20</td>
              <td>{e.parts.map((p) => fr(p, 3)).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─────────── Épreuve en cours ─────────── */

function Running({ s, now, update, finish }: { s: PartielSession; now: number; update: (f: (s: PartielSession) => PartielSession) => void; finish: () => void }) {
  const subject = useMemo(() => subjectOf(s.seed), [s.seed])
  const [fascicule, setFascicule] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const setAns = <K extends keyof PartielAnswers>(k: K, patch: Partial<PartielAnswers[K]>) => update((x) => ({ ...x, answers: { ...x.answers, [k]: { ...x.answers[k], ...patch } } }))
  const a = s.answers
  const serieSources = useMemo(() => [subject.serie.source, null] as const, [subject])
  const ping = subject.ping
  const pingSources = useMemo(() => [salleTraffic(s.seed, { kind: 'ping', L: ping.L, from: ping.from, to: ping.to }, true).source, null] as const, [s.seed, ping])

  return (
    <div className="mt-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        <span className="text-sm">
          Graine <span className="font-mono">{s.seed}</span> · {s.mode === 'exam' ? 'examen' : 'entraînement'}
        </span>
        {s.mode === 'exam' && (
          <span className={`font-mono text-sm font-semibold ${remainingS(s, now) < 600 ? 'text-err' : ''}`} role="timer" aria-label="Temps restant">
            ⏱ {clock(remainingS(s, now))}
          </span>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          <Btn onClick={() => setFascicule(!fascicule)} pressed={fascicule}>
            Fascicule
          </Btn>
          {confirm ? (
            <>
              <span className="self-center text-sm">Rendre la copie ?</span>
              <Btn onClick={finish}>Oui, rendre</Btn>
              <Btn onClick={() => setConfirm(false)}>Non</Btn>
            </>
          ) : (
            <Btn onClick={() => setConfirm(true)}>Rendre</Btn>
          )}
        </span>
      </div>
      {fascicule && <Fascicule />}
      <div role="tablist" aria-label="Parties du partiel" className="mt-4 flex flex-wrap gap-1">
        {PARTIES.map((p, i) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={s.tab === i}
            onClick={() => update((x) => switchTab(x, i as PartIndex, Date.now()))}
            className={`min-h-11 rounded-lg px-3 text-sm ring-1 ring-line ${s.tab === i ? 'bg-accent text-on-accent' : ''}`}
          >
            {i + 1}. {p}
          </button>
        ))}
      </div>

      {/* Les trois bancs restent montés : leurs réglages survivent au changement d'onglet */}
      <div hidden={s.tab !== 0}>
        <CoaxBench
          cable={subject.coax.cable}
          seed={s.seed}
          top={
            <Card title="Partie 1 — Câble coaxial (7 pts)">
              <p className="text-sm">
                Câble inconnu enroulé : <b>{subject.coax.cable.N} spires</b> de diamètre <b>{formatSI(subject.coax.cable.D, 'm')}</b>. Déterminez son impédance caractéristique, sa longueur et les coefficients de réflexion en bout ouvert et en court-circuit. Générateur : Zg = 50 Ω ; v = 2·10⁸ m/s.
              </p>
            </Card>
          }
        />
        <Answers title="Réponses — partie 1">
          <Field label="Zc (Ω)" value={a.cable.zc} onChange={(v) => setAns('cable', { zc: v })} />
          <Field label="Longueur l (m)" value={a.cable.l} onChange={(v) => setAns('cable', { l: v })} />
          <Field label="Γ en circuit ouvert" value={a.cable.gammaOpen} onChange={(v) => setAns('cable', { gammaOpen: v })} />
          <Field label="Γ en court-circuit" value={a.cable.gammaShort} onChange={(v) => setAns('cable', { gammaShort: v })} />
          <Select label="Méthode utilisée pour Zc" value={a.cable.methode} onChange={(v) => setAns('cable', { methode: v as PartielAnswers['cable']['methode'] })} options={METHODES} />
        </Answers>
      </div>

      <div hidden={s.tab !== 1}>
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Card title="Partie 2 — Trame série (6 pts)">
            <p className="text-sm">
              La sonde est branchée sur la ligne TXD d’une liaison série asynchrone qui émet un court message en boucle (toutes les ≈ 200 ms). Format des caractères : <b>{subject.serie.enonce.dataBits} bits de données</b>,{' '}
              <b>
                {subject.serie.enonce.stopBits} bit{subject.serie.enonce.stopBits > 1 ? 's' : ''} de stop
              </b>
              , poids faible en premier. Trouvez le débit, le type de parité, la norme électrique et le message.
            </p>
          </Card>
          <ScopeInstrument sources={serieSources} />
        </section>
        <Answers title="Réponses — partie 2">
          <Field label="Débit (bauds)" value={a.serie.baud} onChange={(v) => setAns('serie', { baud: v })} />
          <Select label="Parité" value={a.serie.parity} onChange={(v) => setAns('serie', { parity: v as Parity | '' })} options={(['none', 'even', 'odd'] as const).map((p) => [p, parityFr(p)])} />
          <Select label="Norme" value={a.serie.level} onChange={(v) => setAns('serie', { level: v as Level | '' })} options={(['TTL', 'RS232'] as const).map((l) => [l, levelFr(l)])} />
          <Field label="Message (casse comprise)" value={a.serie.message} onChange={(v) => setAns('serie', { message: v })} mono text />
        </Answers>
      </div>

      <div hidden={s.tab !== 2}>
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Card title="Partie 3 — Ping Ethernet 10Base2 (7 pts)">
            <p className="text-sm">
              Réseau 10Base2 de la salle (coax bouchonné aux deux bouts), avec son trafic de fond. Le poste {ping.from.ip.join('.')} lance <span className="font-mono">ping -l ? -t {ping.to.ip.join('.')}</span>. Retrouvez L, le
              bourrage, la durée d’une trame de requête sur le câble et le 1er octet de la MAC destination.
            </p>
          </Card>
          <ScopeInstrument sources={pingSources} />
        </section>
        <Answers title="Réponses — partie 3">
          <Field label="L (octets) : ping -l L" value={a.ping.L} onChange={(v) => setAns('ping', { L: v })} />
          <Field label="Octets de bourrage" value={a.ping.padding} onChange={(v) => setAns('ping', { padding: v })} />
          <Field label="Durée de la trame sur le câble (µs)" value={a.ping.durationUs} onChange={(v) => setAns('ping', { durationUs: v })} />
          <Field label="1er octet de la MAC destination (hexa)" value={a.ping.macByte} onChange={(v) => setAns('ping', { macByte: v })} mono text />
        </Answers>
      </div>
      <p className="mt-6 text-xs text-muted">Aucune correction pendant l’épreuve. Les réponses sont enregistrées au fil de la saisie.</p>
    </div>
  )
}

function Answers({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-card bg-card p-4 ring-1 ring-line">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({ label, value, onChange, mono, text }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; text?: boolean }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={text ? 'text' : 'decimal'} autoComplete="off" className={`min-h-11 rounded-lg bg-field px-2 ring-1 ring-line ${mono ? 'font-mono' : ''}`} />
    </label>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg bg-field px-2 ring-1 ring-line">
        <option value="">— choisir —</option>
        {options.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

/* ─────────── Résultat ─────────── */

function Result({ s, onNew }: { s: PartielSession; onNew: () => void }) {
  const r = useMemo(() => gradePartiel(subjectOf(s.seed), s.answers), [s])
  const used = ((s.submittedAt ?? s.startAt) - s.startAt) / 1000
  return (
    <div className="mt-6 grid gap-4">
      <div className="rounded-card bg-card p-4 ring-1 ring-line">
        <p className="text-sm text-muted">
          Graine {s.seed} · {s.mode === 'exam' ? 'examen' : 'entraînement'} · durée {clock(used)}
        </p>
        <p className="mt-1 text-3xl font-bold" data-testid="note-partiel">
          {fr(r.note, 3)} / 20
        </p>
        <ul className="mt-2 grid gap-1 text-sm">
          {r.parts.map((p, i) => (
            <li key={p.name}>
              {i + 1}. {p.name} : <b>{fr(p.pts, 3)}</b> / {p.max} · temps passé {minutes(s.partMs[i] ?? 0)}
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Btn onClick={onNew}>Nouveau partiel</Btn>
        </div>
      </div>
      {r.parts.map((p, i) => (
        <section key={p.name} className="rounded-card bg-card p-4 ring-1 ring-line">
          <h2 className="font-semibold">
            {i + 1}. {p.name} — {fr(p.pts, 3)} / {p.max}
          </h2>
          <ul className="mt-2 grid gap-3 text-sm">
            {r.lines
              .filter((l) => l.part === i)
              .map((l) => (
                <li key={l.label} className="border-t border-line pt-2">
                  <p>
                    <span className={l.ok ? 'text-ok' : 'text-err'}>{l.ok ? '✓' : '✗'}</span> <b>{l.label}</b> · vous : <span className="font-mono">{l.given}</span> · attendu : <span className="font-mono">{l.expected}</span> ·{' '}
                    {fr(l.pts, 3)}/{l.max}
                  </p>
                  <p className="mt-1 text-xs text-muted">{l.calcul}</p>
                </li>
              ))}
          </ul>
          <p className="mt-3 rounded-lg bg-card-2 p-2 text-xs">
            <b>Réglages d’oscilloscope conseillés :</b> {p.conseil}
          </p>
        </section>
      ))}
    </div>
  )
}

/* ─────────── Fascicule (rappels de cours, aucune valeur du sujet) ─────────── */

function Fascicule() {
  return (
    <section className="mt-4 grid gap-3 rounded-card bg-card p-4 text-sm ring-1 ring-line" aria-label="Fascicule : rappels de cours">
      <h2 className="font-semibold">Fascicule — rappels de cours</h2>
      <div>
        <h3 className="font-medium">Lignes de transmission</h3>
        <p>Γ = (ZL − Zc)/(ZL + Zc) : ouvert → +1, court-circuit → −1, adapté (ZL = Zc) → 0. À t = 0⁺ la ligne vue de l’entrée vaut Zc : Ei = Eg·Zc/(Zg + Zc) ⇒ Zc = Zg·Ei/(Eg − Ei).</p>
        <p>Retard aller-retour Δt = 2l/v ⇒ l = v·Δt/2. Longueur d’un enroulement : N·π·D. Atténuation A(dB) = 20·log(Ve/Vs), ramenée à 100 m : α = A·100/l. Déphasage φ = 360·f·l/v (mod 360).</p>
      </div>
      <div>
        <h3 className="font-medium">Liaison série asynchrone</h3>
        <p>Repos au 1 logique ; start = 0 ; 7 ou 8 bits de données, poids faible en premier ; parité éventuelle (paire : nombre total de 1 pair ; impaire : impair) ; 1 ou 2 stops à 1. Débit = 1/durée d’un bit.</p>
        <p>TTL : 0 V = 0, 5 V = 1, repos haut. RS-232 / V28 : logique inversée, 1 ≈ −3 à −15 V, 0 ≈ +3 à +15 V, repos négatif.</p>
      </div>
      <div>
        <h3 className="font-medium">Trame Ethernet II</h3>
        <p>Préambule 7 × 55h, SFD D5h, MAC destination (6), MAC source (6), Type (2 : 0800h IPv4, 0806h ARP), données 46 à 1500 octets (bourrage sous 46), FCS CRC-32 (4). 10 Mbit/s : 100 ns par bit, 0,8 µs par octet ; espace inter-trame 9,6 µs.</p>
        <p>Octets émis poids faible en premier. Manchester IEEE 802.3 : 0 = front descendant au milieu du bit, 1 = front montant. 10Base2 : repos 0 V, la carte tire 40 ± 30 mA dans 25 Ω.</p>
      </div>
      <div>
        <h3 className="font-medium">IPv4 et ICMP</h3>
        <p>En-tête IPv4 sans option : 20 octets (45h, TOS, longueur totale, identification, drapeaux/décalage, TTL, protocole 01h = ICMP, somme de contrôle, IP source, IP destination). Fragments de 1480 octets de données au plus.</p>
        <p>ICMP Echo : 8 octets d’en-tête (type 8 requête / 0 réponse, code, somme, identifiant, séquence) puis les données de ping (« abcdef… » sous Windows).</p>
      </div>
      <p className="text-xs text-muted">Barème : câble 7, série 6, ping 7 (sur 20) ; épreuve de {RES3_PARTIEL.dureeS / 60} min ; Zc et l à ±5 %, durées à ±2 %, le reste exact.</p>
    </section>
  )
}
