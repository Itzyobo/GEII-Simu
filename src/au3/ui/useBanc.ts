import { useEffect, useReducer } from 'react'
import { reduire, type Action, type EtatBanc } from '../banc'
import type { MontageId } from '../sim/cablage'
import { chargerSession, sauverSession, sessionNeuve, type EspaceSession, type ModeSession } from '../session'

/** État de l'établi d'une page (banc libre ou TP), conservé dans localStorage après chaque action */
export function useBanc(espace: EspaceSession = 'banc', montage: MontageId = 'tp1', mode: ModeSession = 'libre') {
  const [etat, envoyer] = useReducer((e: EtatBanc, a: { action: Action; instant: number }) => reduire(e, a.action, a.instant), null, (): EtatBanc => {
    const session = (typeof localStorage === 'undefined' ? null : chargerSession(localStorage, mode, espace)) ?? sessionNeuve(mode)
    // Rechargement en entraînement : la platine repart éteinte (on ne rallume pas un banc sans y être) ;
    // en examen, tout l'état est conservé (sous tension compris)
    const platine = mode === 'examen' ? session.platine : { ...session.platine, sousTension: false }
    return { session: { ...session, platine }, montage: session.examen?.tp ?? montage, verdict: null, message: null }
  })
  useEffect(() => sauverSession(localStorage, etat.session, espace), [etat.session, espace])
  const agir = (action: Action) => envoyer({ action, instant: Date.now() })
  return { etat, agir }
}
