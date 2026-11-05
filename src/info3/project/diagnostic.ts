/**
 * Panneau Diagnostic du mode libre : incohérences lues dans les registres et pendant l'exécution.
 * Ne modifie jamais le code. Règles :
 * R1 broche lue (GetValue, PORTxbits) alors qu'elle est en analogique ;
 * R2 écriture sur une broche en entrée ;
 * R3 _XTAL_FREQ différent du Fosc configuré (System Module) ou mesuré dans OSCCON1/OSCFRQ ;
 * R4 carte Click présente mais inutilisée par le projet (ou sur le mauvais mikroBUS).
 */
import { INFO3 } from '../../data/reference'
import { clockCheck, type Project, type SlotId } from './project'

export interface RuntimeDiag {
  analogReads: string[]
  inputWrites: string[]
  /** Fosc décrit par les registres pendant l'exécution — Hz */
  fosc: number | null
}

export interface Finding {
  rule: 'R1' | 'R2' | 'R3' | 'R4'
  text: string
}

const slotLabel = (s: SlotId) => (s === 'mikrobus1' ? 'mikroBUS 1' : 'mikroBUS 2')

export function diagnose(p: Project, rt: RuntimeDiag | null): Finding[] {
  const out: Finding[] = []
  if (rt) {
    for (const pin of rt.analogReads) out.push({ rule: 'R1', text: `${pin} lue en numérique alors que ANS${pin.slice(1)} = 1 (Analog) : la lecture renvoie toujours 0` })
    for (const pin of rt.inputWrites) out.push({ rule: 'R2', text: `Écriture sur ${pin} alors que la broche est en entrée (TRIS${pin.slice(1)} = 1) : le niveau n’est pas imposé` })
  }
  const { xtal, fosc } = clockCheck(p)
  if (xtal !== null && xtal !== fosc) out.push({ rule: 'R3', text: `_XTAL_FREQ = ${xtal} Hz mais Fosc configuré = ${fosc} Hz : les délais seront faux` })
  else if (xtal !== null && rt?.fosc && rt.fosc !== xtal) out.push({ rule: 'R3', text: `_XTAL_FREQ = ${xtal} Hz mais le PIC tourne à ${rt.fosc} Hz (OSCCON1/OSCFRQ) : les délais seront faux` })
  const configured = new Set(p.mcc.pins.map((x) => x.pin))
  for (const slot of Object.keys(p.bench.slots) as SlotId[]) {
    const card = p.bench.slots[slot]
    if (!card) continue
    const info = INFO3.clickBoards[card]
    const pins = INFO3.pins[slot] as Record<string, string>
    const used = Object.entries(pins).some(([k, pin]) => k !== 'source' && configured.has(pin))
    if (info.expectedSlot !== slot) out.push({ rule: 'R4', text: `Carte ${info.name} sur le ${slotLabel(slot)} : elle est prévue sur le ${slotLabel(info.expectedSlot as SlotId)}` })
    else if (!used) out.push({ rule: 'R4', text: `Carte ${info.name} sur le ${slotLabel(slot)} : aucune de ses broches n’est configurée dans MCC` })
  }
  return out
}
