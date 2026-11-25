/**
 * Réglages de l'oscilloscope : fonctions pures partagées par l'interface (useScope) et le mode démonstration.
 * Une démo qui règle l'oscillo passe exactement par ces fonctions, comme l'utilisateur.
 */
import type { Ch, ChannelSettings, ScopeSettings } from './types'

export const patchSettings = (s: ScopeSettings, p: Partial<ScopeSettings>): ScopeSettings => ({ ...s, ...p })

export function patchChannel(s: ScopeSettings, c: Ch, p: Partial<ChannelSettings>): ScopeSettings {
  const ch = [...s.ch] as ScopeSettings['ch']
  ch[c] = { ...ch[c], ...p }
  return { ...s, ch }
}

export const patchTrig = (s: ScopeSettings, p: Partial<ScopeSettings['trig']>): ScopeSettings => ({ ...s, trig: { ...s.trig, ...p } })

export const patchCursors = (s: ScopeSettings, p: Partial<ScopeSettings['cursors']>): ScopeSettings => ({ ...s, cursors: { ...s.cursors, ...p } })

/** Atténuation de sonde réglée : calibre et niveau de déclenchement suivent (affichage cohérent) */
export function withProbe(s: ScopeSettings, c: Ch, probe: 1 | 10): ScopeSettings {
  const k = probe / s.ch[c].probe
  const next = patchChannel(s, c, { probe, vdiv: s.ch[c].vdiv * k })
  return s.trig.source === c ? patchTrig(next, { level: s.trig.level * k }) : next
}
