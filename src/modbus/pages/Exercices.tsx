/** Exercices « message codé » : décoder un chronogramme tiré au sort, puis correction bit par bit. */
import { useState, type ReactNode } from 'react'
import Chronogramme from '../components/Chronogramme'
import UnverifiedBadge from '../components/UnverifiedBadge'
import { checkDebit, checkExact, PARITE_LABEL, parseParite, type Verdict } from '../models/answers'
import { exerciseGenerate, type Difficulte } from '../models/exercise'
import { frameBits } from '../models/uart'

const nouvelleGraine = () => Math.floor(Math.random() * 2 ** 31)
const VIDE = { debit: '', bits: '', parite: '', message: '' }

export default function Exercices() {
  const [difficulte, setDifficulte] = useState<Difficulte>(1)
  const [graine, setGraine] = useState(nouvelleGraine)
  const [rep, setRep] = useState(VIDE)
  const [corrige, setCorrige] = useState(false)
  const ex = exerciseGenerate(graine, difficulte)
  const { liaison, corrige: c } = ex

  const nouveau = (d = difficulte) => {
    setDifficulte(d)
    setGraine(nouvelleGraine())
    setRep(VIDE)
    setCorrige(false)
  }
  const verdicts: Record<keyof typeof VIDE, Verdict> = {
    debit: checkDebit(rep.debit, liaison.baud, ex.tdiv),
    bits: checkExact(rep.bits, String(liaison.dataBits)),
    parite: parseParite(rep.parite) === liaison.parity ? { ok: true, message: 'Juste.' } : { ok: false, message: `Faux : ${PARITE_LABEL[liaison.parity]}.` },
    message: checkExact(rep.message, c.message, (x) => x),
  }
  const champ = (k: keyof typeof VIDE) => ({ value: rep[k], onChange: (e: { target: { value: string } }) => setRep((r) => ({ ...r, [k]: e.target.value })) })
  const input = 'min-h-10 w-full rounded-md bg-card px-2 ring-1 ring-line'

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Message codé</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Chronogramme relevé sur TXD en niveau <b>{ex.level}</b>. Retrouvez le débit, le format et le message ASCII. Les échelles sont imposées ; aucune légende des bits.
        <UnverifiedBadge deps={['exerciceFormats']} />
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Niveau :</span>
        {([1, 2, 3] as const).map((d) => (
          <button key={d} type="button" aria-pressed={difficulte === d} onClick={() => nouveau(d)} className={`min-h-10 rounded-lg px-3 ring-1 ring-line ${difficulte === d ? 'bg-accent text-on-accent' : 'hover:bg-card-2'}`}>
            {d}
          </button>
        ))}
        <button type="button" onClick={() => nouveau()} className="min-h-10 rounded-lg px-3 ring-1 ring-line hover:bg-card-2">
          Nouvel exercice
        </button>
        <span className="text-xs text-muted">graine {graine}</span>
      </div>

      <div className="mt-4">
        <Chronogramme ex={ex} />
      </div>

      <form
        className="mt-4 grid gap-3 rounded-card bg-card p-4 ring-1 ring-line sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          setCorrige(true)
        }}
      >
        <Field label="Débit (bauds) ou durée d’un bit" verdict={corrige ? verdicts.debit : null}>
          <input {...champ('debit')} className={`${input} font-mono`} placeholder="ex. 9600 ou 104 µs" />
        </Field>
        <Field label="Bits de données" verdict={corrige ? verdicts.bits : null}>
          <select {...champ('bits')} className={input}>
            <option value="">—</option>
            <option>7</option>
            <option>8</option>
          </select>
        </Field>
        <Field label="Parité" verdict={corrige ? verdicts.parite : null}>
          <select {...champ('parite')} className={input}>
            <option value="">—</option>
            {Object.values(PARITE_LABEL).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Message (ASCII)" verdict={corrige ? verdicts.message : null}>
          <input {...champ('message')} className={`${input} font-mono`} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-on-accent">
            Corriger
          </button>
        </div>
      </form>

      {corrige && (
        <section className="mt-6" aria-label="Correction détaillée">
          <h2 className="font-semibold">Correction bit par bit</h2>
          <p className="mt-1 text-sm text-muted">
            {liaison.baud} bauds : un bit dure {(1e6 / liaison.baud).toFixed(1).replace('.', ',')} µs, soit {(1 / liaison.baud / ex.tdiv).toFixed(2).replace('.', ',')} div à {(ex.tdiv * 1e6).toFixed(0)} µs/div.
            Format {liaison.dataBits} bits, parité {PARITE_LABEL[liaison.parity]}, {liaison.stopBits} stop : {frameBits(liaison)} bits par caractère. Données LSB d’abord
            {ex.level === 'RS232' ? ' ; en RS232 le niveau est inversé (1 logique = tension négative).' : '.'}
          </p>
          <div className="mt-2 overflow-x-auto rounded-card bg-card ring-1 ring-line">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Start · b0…b{liaison.dataBits - 1} · {liaison.parity === 'none' ? '' : 'parité · '}stop</th>
                  <th className="px-3 py-2">Données MSB → LSB</th>
                  <th className="px-3 py-2">Hexa</th>
                  <th className="px-3 py-2">Caractère</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {c.chars.map((ch, k) => (
                  <tr key={k} className="border-t border-line">
                    <td className="px-3 py-1.5">{ch.bits}</td>
                    <td className="px-3 py-1.5">{ch.byte.toString(2).padStart(liaison.dataBits, '0')}</td>
                    <td className="px-3 py-1.5">{ch.byte.toString(16).toUpperCase().padStart(2, '0')}H</td>
                    <td className="px-3 py-1.5">{ch.char === ' ' ? 'espace' : ch.char}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm">
            Message : <span className="font-mono">« {c.message} »</span>
          </p>
        </section>
      )}
    </main>
  )
}

function Field({ label, verdict, children }: { label: string; verdict: Verdict | null; children: ReactNode }) {
  return (
    <label className="block text-sm">
      {label}
      <div className="mt-1">{children}</div>
      {verdict && (
        <p role="status" className={`mt-1 ${verdict.ok ? 'text-ok' : verdict.partiel ? 'text-warn' : 'text-err'}`}>
          {verdict.message}
        </p>
      )}
    </label>
  )
}
