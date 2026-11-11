/**
 * Projets de départ du mode libre : configuration MCC seule de chaque TP (main.c par défaut du premier Generate),
 * un projet vide (MCC par défaut) et un projet vide « registres seuls » (sans MCC).
 */
import { defaultMccConfig, type MccConfig } from '../mcc/config'
import { tp1Config, tp23Config, tp32Config, tp45Config, tp54Config, tp64Config } from '../mcc/presets'
import { blankProject, REGISTERS_MAIN, runGenerate, type Project } from './project'

export interface Starter {
  id: string
  label: string
  /** Configuration MCC ; absente = registres seuls */
  mcc: (() => MccConfig) | null
}

export const STARTERS: Starter[] = [
  { id: 'tp1', label: 'TP1 — ports parallèles', mcc: tp1Config },
  { id: 'tp2', label: 'TP2 — IOC et codeur', mcc: tp23Config },
  { id: 'tp3', label: 'TP3 — Timer 2', mcc: tp32Config },
  { id: 'tp4', label: 'TP4 — SPI et anneau', mcc: () => tp45Config(0) },
  { id: 'tp5', label: 'TP5 — PWM, UART, LED RGB', mcc: tp54Config },
  { id: 'tp6', label: 'TP6 — CAN et matrice 8x8', mcc: tp64Config },
  { id: 'vide', label: 'Projet vide', mcc: defaultMccConfig },
  { id: 'registres', label: 'Projet vide, registres seuls', mcc: null },
]

export function starterProject(s: Starter, id: string): Project {
  const base = blankProject('libre', s.label, id)
  if (!s.mcc) return { ...base, files: { 'main.c': REGISTERS_MAIN }, generated: {}, registersOnly: true }
  return runGenerate({ ...base, mcc: s.mcc() }).project
}
