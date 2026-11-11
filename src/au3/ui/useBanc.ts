import { useEffect, useReducer } from 'react'
import { reduire, type Action, type EtatBanc } from '../banc'
import { chargerSession, sauverSession, sessionNeuve } from '../session'

/** État de l'établi (banc libre), conservé dans localStorage après chaque action */
export function useBanc() {
  const [etat, envoyer] = useReducer((e: EtatBanc, a: { action: Action; instant: number }) => reduire(e, a.action, a.instant), null, (): EtatBanc => {
    const session = (typeof localStorage === 'undefined' ? null : chargerSession(localStorage, 'libre')) ?? sessionNeuve('libre')
    // Rechargement : la platine repart éteinte (on ne rallume pas un banc sans y être)
    return { session: { ...session, platine: { ...session.platine, sousTension: false } }, montage: 'tp1', verdict: null, message: null }
  })
  useEffect(() => sauverSession(localStorage, etat.session), [etat.session])
  const agir = (action: Action) => envoyer({ action, instant: Date.now() })
  return { etat, agir }
}
