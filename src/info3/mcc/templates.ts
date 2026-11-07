/**
 * Outils communs du générateur MCC : gabarits réels (MCC 1.81.7, CRLF → LF), remplacement contrôlé,
 * en-tête de licence Microchip et en-tête « Generated … », format hexadécimal des registres.
 */
import { INFO3 } from '../../data/reference'

export const DIR = INFO3.mcc.dir
const HEX = 16
export const hex2 = (v: number) => `0x${v.toString(HEX).toUpperCase().padStart(2, '0')}`

const RAW = import.meta.glob('./templates/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
export const tpl = (file: string): string => {
  const t = RAW[`./templates/${file}.txt`]
  if (t === undefined) throw new Error(`gabarit MCC absent : ${file}`)
  // Seule normalisation permise : CRLF → LF (dépôt extrait sous Windows)
  return t.replace(/\r\n/g, '\n')
}

/** Remplacement d'un passage du gabarit ; échoue si le passage n'existe pas (gabarit altéré) */
export function replaceOnce(text: string, find: string | RegExp, by: string): string {
  const found = typeof find === 'string' ? text.includes(find) : find.test(text)
  if (!found) throw new Error(`gabarit MCC : passage introuvable (${String(find)})`)
  return text.replace(find, () => by)
}

/** Sortie d'un pilote ajouté au projet (Interrupt Module, timers…) */
export interface DriverOutput {
  /** Fichiers générés, par nom (dans mcc_generated_files) */
  files: Record<string, string>
  /** Lignes #include ajoutées à mcc.h */
  includes: string[]
  /** Appels ajoutés à SYSTEM_Initialize (après OSCILLATOR_Initialize) */
  inits: string[]
}

/** En-tête de licence Microchip, tel qu'il figure dans les fichiers réels */
export function licenseBlock(): string {
  const t = tpl('pin_manager.c')
  const a = t.indexOf('/*\n    (c) 2018')
  const z = t.indexOf('*/', a)
  return t.slice(a, z + 2)
}

/** En-tête « Generated … » au format MCC 1.81 (H34) */
export function generatedHeader(o: { title: string; file: string; summary: string; description: string[]; driver: string }): string {
  return [
    '/**',
    `  @Generated ${o.title}`,
    '',
    '  @Company:',
    '    Microchip Technology Inc.',
    '',
    '  @File Name:',
    `    ${o.file}`,
    '',
    '  @Summary:',
    `    ${o.summary}`,
    '',
    '  @Description:',
    ...o.description.map((d) => `    ${d}`),
    '    Generation Information :',
    '        Product Revision  :  PIC10 / PIC12 / PIC16 / PIC18 MCUs - 1.81.7',
    '        Device            :  PIC16F18875',
    `        Driver Version    :  ${o.driver}`,
    '    The generated drivers are tested against the following:',
    '        Compiler          :  XC8 2.31 and above or later',
    '        MPLAB             :  MPLAB X 5.45',
    '*/',
    '',
    licenseBlock(),
    '',
  ].join('\n')
}
