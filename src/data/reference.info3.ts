/**
 * Constantes INFO3 (PIC16F18875 / Curiosity HPC), réexportées par reference.ts : importer depuis `src/data/reference`.
 * Fichier séparé uniquement pour que le bundle initial (ENER3, MODBUS) ne les embarque pas (PRD §5.1).
 */

/* ═══════════════════════ INFO3 — PIC16F18875 / Curiosity HPC ═══════════════════════
 * Toutes les constantes du simulateur INFO3 (PRD « Simulateur INFO3 Curiosity HPC », §3).
 * Sources : « CR » = comptes rendus TP1 à TP3, « énoncé », « cours p. N », « annexe N »,
 * « calcul », « hypothèse » (Hx, inventaire dans INFO3.hypotheses).
 */

/** Définition d'un registre spécial (SFR). `bits[i]` = nom du bit i (null = non implémenté). */
export interface SfrDef {
  /** Adresse dans l'espace de données du PIC16F18875 */
  addr: number
  /** Valeur au reset (POR) */
  reset: number
  /** Noms des bits, du bit 0 au bit 7 */
  bits: readonly (string | null)[]
  /** Source de l'adresse */
  source: string
  /** Hypothèses dont dépend l'entrée (adresse, bits ou valeur au reset) */
  hyp: readonly string[]
  /** Autre nom du registre dans xc.h (TMR2 pour T2TMR, PR2 pour T2PR) */
  alias?: string
  /** Champs de la structure `NOMbits` de xc.h, du bit 0 vers le bit 7 (champs de plusieurs bits : MODE, RSEL…) */
  fields?: readonly { name: string | null; width: number }[]
}

export interface Info3Hypothese {
  id: string
  texte: string
  commentVerifier: string
  /** ouverte (par défaut), vérifiée, partiellement vérifiée ou réfutée */
  statut?: 'ouverte' | 'vérifiée' | 'partielle' | 'réfutée'
  /** Source de la vérification ou de la réfutation */
  preuve?: string
}

/** Noms de bits « préfixe + numéro » (RA0…RA7) ; `n` bits implémentés, le reste à null. */
const sfrBits = (prefix: string, n = 8): (string | null)[] => Array.from({ length: 8 }, (_, i) => (i < n ? `${prefix}${i}` : null))
/** Noms de bits explicites, du bit 0 au bit 7 ('-' = non implémenté). */
const namedBits = (s: string): (string | null)[] => s.split(' ').map((b) => (b === '-' ? null : b))

const SFR_DATASHEET = 'datasheet DS40001802 (H18)'
const sfr = (addr: number, reset: number, bits: (string | null)[], hyp: string[] = ['H18'], source = SFR_DATASHEET): SfrDef => ({ addr, reset, bits, source, hyp })

/** Ports implémentés et leurs bits (RE3 = MCLR, entrée seule). */
const PORTS = ['A', 'B', 'C', 'D', 'E'] as const
const portWidth = (p: (typeof PORTS)[number], kind: 'port' | 'out' | 'wpu') => (p === 'E' ? (kind === 'out' ? 3 : 4) : 8)

/** Adresses des registres de port (PIC16F18875, banque 0 et banque 30) — H18 sauf PORTA (cours p. 19). */
const PORT_ADDR = {
  PORT: { A: 0x00c, B: 0x00d, C: 0x00e, D: 0x00f, E: 0x010 },
  TRIS: { A: 0x011, B: 0x012, C: 0x013, D: 0x014, E: 0x015 },
  LAT: { A: 0x016, B: 0x017, C: 0x018, D: 0x019, E: 0x01a },
  ANSEL: { A: 0xf38, B: 0xf43, C: 0xf4e, D: 0xf59, E: 0xf64 },
  WPU: { A: 0xf39, B: 0xf44, C: 0xf4f, D: 0xf5a, E: 0xf65 },
  ODCON: { A: 0xf3a, B: 0xf45, C: 0xf50, D: 0xf5b, E: 0xf66 },
  SLRCON: { A: 0xf3b, B: 0xf46, C: 0xf51, D: 0xf5c, E: 0xf67 },
  INLVL: { A: 0xf3c, B: 0xf47, C: 0xf52, D: 0xf5d, E: 0xf68 },
} as const

/** Interruption sur changement d'état (IOC) : ports A, B, C et E (RE3 seulement) ; pas d'IOC sur le port D */
const IOC_ADDR = {
  A: { P: 0xf3d, N: 0xf3e, F: 0xf3f },
  B: { P: 0xf48, N: 0xf49, F: 0xf4a },
  C: { P: 0xf53, N: 0xf54, F: 0xf55 },
  E: { P: 0xf69, N: 0xf6a, F: 0xf6b },
} as const

/** MSSP1 (banque 3) : SSP1BUF, ADD, MSK, STAT, CON1, CON2, CON3 consécutifs — H18 */
const MSSP1_ADDR = 0x18c
/** PPS de sortie RxyPPS (banque 30) : RA0PPS, puis 8 registres par port — H38 */
const PPS_OUT_ADDR = { A: 0xf10, B: 0xf18, C: 0xf20, D: 0xf28, E: 0xf30 } as const
/** PPS d'entrée de MSSP1 : SSP1CLKPPS, SSP1DATPPS, SSP1SSPPS — H38 */
const SSP1_PPS_IN_ADDR = 0xec5

/** CCP1 : CCPR1L, CCPR1H, CCP1CON consécutifs (banque 6) ; CCPTMRS0, CCPTMRS1 — H18 */
const CCP1_ADDR = 0x30c
const CCPTMRS_ADDR = 0x31f
/** PWM6, PWM7 : PWMxDCL, PWMxDCH, PWMxCON consécutifs (banque 12) — H18 */
const PWM_ADDR = { 6: 0x617, 7: 0x61b } as const
/** EUSART : RC1REG, TX1REG, SP1BRGL, SP1BRGH, RC1STA, TX1STA, BAUD1CON (banque 2) — H18 */
const EUSART_ADDR = 0x119
/** RXPPS (entrée RX de l'EUSART) — H44 */
const RX_PPS_ADDR = 0xecb
/** ADCC : résultat et voie (banque 1), réglages (banque 2) — H18 */
const ADC_RES_ADDR = 0x09b
const ADC_CFG_ADDR = 0x10c

/** Timers 2, 4, 6 : adresse de TMRx (PRx, TxCON, TxHLT, TxCLKCON, TxRST suivent) — H18 */
const TIMER_ADDR = { 2: 0x28c, 4: 0x292, 6: 0x298 } as const
/** Entrée externe (T2IN…) : registres PPS d'entrée — H18 */
const TIMER_PPS_ADDR = { 2: 0xe9c, 4: 0xe9d, 6: 0xe9e } as const

function buildSfrs(): Record<string, SfrDef> {
  const out: Record<string, SfrDef> = {}
  for (const p of PORTS) {
    const portSrc = p === 'A' ? 'cours p. 19' : SFR_DATASHEET
    out[`PORT${p}`] = sfr(PORT_ADDR.PORT[p], 0, sfrBits(`R${p}`, portWidth(p, 'port')), p === 'A' ? ['H19'] : ['H18', 'H19'], portSrc)
    // Reset : TRISx = 0xFF, TRISE = 0x07 ; ANSELx = 0xFF, ANSELE = 0x07 ; LATx = 0 (consigne de l'étape 1)
    out[`TRIS${p}`] = sfr(PORT_ADDR.TRIS[p], p === 'E' ? 0x07 : 0xff, sfrBits(`TRIS${p}`, portWidth(p, 'out')))
    out[`LAT${p}`] = sfr(PORT_ADDR.LAT[p], 0, sfrBits(`LAT${p}`, portWidth(p, 'out')))
    out[`ANSEL${p}`] = sfr(PORT_ADDR.ANSEL[p], p === 'E' ? 0x07 : 0xff, sfrBits(`ANS${p}`, portWidth(p, 'out')))
    out[`WPU${p}`] = sfr(PORT_ADDR.WPU[p], 0, sfrBits(`WPU${p}`, portWidth(p, 'wpu')), ['H18', 'H19'])
    out[`ODCON${p}`] = sfr(PORT_ADDR.ODCON[p], 0, sfrBits(`ODC${p}`, portWidth(p, 'out')), ['H18', 'H19'])
    // Écrits par pin_manager.c (fichiers MCC TP1) : 0xFF, 0x07 pour le port E ; sans effet sur le modèle gpio
    out[`SLRCON${p}`] = sfr(PORT_ADDR.SLRCON[p], p === 'E' ? 0x07 : 0xff, sfrBits(`SLR${p}`, portWidth(p, 'out')), ['H18'])
    out[`INLVL${p}`] = sfr(PORT_ADDR.INLVL[p], p === 'E' ? 0x07 : 0xff, sfrBits(`INLVL${p}`, portWidth(p, 'out')), ['H18'])
  }
  for (const [p, a] of Object.entries(IOC_ADDR)) {
    // RE3 seulement sur le port E
    const bits = (prefix: string) => (p === 'E' ? namedBits(`- - - ${prefix}3 - - - -`) : sfrBits(prefix))
    for (const k of ['P', 'N', 'F'] as const) out[`IOC${p}${k}`] = sfr(a[k], 0, bits(`IOC${p}${k}`), ['H18', 'H19'])
  }
  out.STATUS = sfr(0x003, 0x18, namedBits('C DC Z nPD nTO - - -'), ['H18', 'H19'])
  out.INTCON = sfr(0x00b, 0x01, namedBits('INTEDG - - - - - PEIE GIE'), ['H18', 'H19'])
  // PIR0…PIR8 et PIE0…PIE8 (banque 14)
  const irqBits = [
    'INT - - - IOC TMR0 - -',
    'AD ADT - - - - CSW OSF',
    'C1 C2 - - - - ZCD -',
    'SSP1 BCL1 SSP2 BCL2 TX RC - -',
    'TMR1 TMR2 TMR3 TMR4 TMR5 TMR6 - -',
    'TMR1G TMR3G TMR5G - CLC1 CLC2 CLC3 CLC4',
    'CCP1 CCP2 CCP3 CCP4 CCP5 - - -',
    'CWG1 CWG2 CWG3 - NCO1 NVM CRC SCAN',
    'SMT1 SMT1PRA SMT1PWA SMT2 SMT2PRA SMT2PWA - -',
  ]
  const PIR0_ADDR = 0x70c
  const PIE0_ADDR = 0x716
  irqBits.forEach((names, n) => {
    const base = names.split(' ')
    // Interruption externe : INTF / INTE (et non INTIF / INTIE)
    const flag = (b: string, suffix: 'F' | 'E') => (b === '-' ? null : b === 'INT' ? `INT${suffix}` : `${b}I${suffix}`)
    out[`PIR${n}`] = sfr(PIR0_ADDR + n, 0, base.map((b) => flag(b, 'F')), ['H18', 'H19'])
    out[`PIE${n}`] = sfr(PIE0_ADDR + n, 0, base.map((b) => flag(b, 'E')), ['H18', 'H19'])
  })
  out.PCON0 = sfr(0x813, 0x00, namedBits('nBOR nPOR nRI nRMCLR nRWDT - STKUNF STKOVF'), ['H18', 'H19'])
  // Oscillateur (banque 17) : valeurs au reset cohérentes avec H1 (HFINTOSC 4 MHz / 4)
  out.OSCCON1 = sfr(0x88d, 0x62, namedBits('NDIV0 NDIV1 NDIV2 NDIV3 NOSC0 NOSC1 NOSC2 -'), ['H1', 'H18', 'H19'])
  out.OSCCON2 = sfr(0x88e, 0x62, namedBits('CDIV0 CDIV1 CDIV2 CDIV3 COSC0 COSC1 COSC2 -'), ['H1', 'H18', 'H19'])
  out.OSCCON3 = sfr(0x88f, 0x00, namedBits('- - - PLLR ORDY NOSCR SOSCPWR CSWHOLD'), ['H18', 'H19'])
  out.OSCSTAT = sfr(0x890, 0x00, namedBits('PLLR - ADOR SOR LFOR MFOR HFOR EXTOR'), ['H18', 'H19'])
  out.OSCEN = sfr(0x891, 0x00, namedBits('- - ADOEN SOSCEN LFOEN MFOEN HFOEN EXTOEN'), ['H18', 'H19'])
  out.OSCTUNE = sfr(0x892, 0x00, namedBits('HFTUN0 HFTUN1 HFTUN2 HFTUN3 HFTUN4 HFTUN5 - -'), ['H18', 'H19'])
  out.OSCFRQ = sfr(0x893, 0x02, namedBits('HFFRQ0 HFFRQ1 HFFRQ2 - - - - -'), ['H1', 'H18', 'H19'])
  // Désactivation des modules (banque 15) : registres mémorisés, bits non nommés
  const PMD0_ADDR = 0x796
  for (let n = 0; n <= 5; n++) out[`PMD${n}`] = sfr(PMD0_ADDR + n, 0x00, sfrBits('', 0), ['H18', 'H19'])
  // Timers 2, 4, 6 (banque 5) : TMR, PR, CON, HLT, CLKCON, RST consécutifs ; entrée externe par PPS (TxINPPS)
  for (const [n, base] of Object.entries(TIMER_ADDR)) {
    const t = `T${n}`
    const f = (...xs: [string | null, number][]) => xs.map(([name, width]) => ({ name, width }))
    out[`${t}TMR`] = { ...sfr(base, 0, sfrBits('', 0), ['H18', 'H19']), alias: `TMR${n}` }
    out[`${t}PR`] = { ...sfr(base + 1, 0xff, sfrBits('', 0), ['H18', 'H19']), alias: `PR${n}` }
    out[`${t}CON`] = { ...sfr(base + 2, 0, namedBits(`${t}OUTPS0 ${t}OUTPS1 ${t}OUTPS2 ${t}OUTPS3 ${t}CKPS0 ${t}CKPS1 ${t}CKPS2 TMR${n}ON`), ['H18', 'H19']), fields: f(['OUTPS', 4], ['CKPS', 3], [`TMR${n}ON`, 1]) }
    out[`${t}HLT`] = { ...sfr(base + 3, 0, namedBits(`${t}MODE0 ${t}MODE1 ${t}MODE2 ${t}MODE3 ${t}MODE4 ${t}CKSYNC ${t}CKPOL ${t}PSYNC`), ['H18', 'H19']), fields: f(['MODE', 5], ['CKSYNC', 1], ['CKPOL', 1], ['PSYNC', 1]) }
    out[`${t}CLKCON`] = { ...sfr(base + 4, 0, namedBits(`${t}CS0 ${t}CS1 ${t}CS2 ${t}CS3 - - - -`), ['H18', 'H19']), fields: f(['CS', 4], [null, 4]) }
    out[`${t}RST`] = { ...sfr(base + 5, 0, namedBits(`${t}RSEL0 ${t}RSEL1 ${t}RSEL2 ${t}RSEL3 - - - -`), ['H18', 'H19']), fields: f(['RSEL', 4], [null, 4]) }
    out[`${t}INPPS`] = sfr(TIMER_PPS_ADDR[Number(n) as keyof typeof TIMER_PPS_ADDR], 0, namedBits(`${t}INPPS0 ${t}INPPS1 ${t}INPPS2 ${t}INPPS3 ${t}INPPS4 - - -`), ['H18', 'H19'])
  }
  // MSSP1 (SPI) : SSP1STAT SMP<7> CKE<6> … BF<0> ; SSP1CON1 WCOL<7> SSPOV<6> SSPEN<5> CKP<4> SSPM<3:0>
  const f = (...xs: [string | null, number][]) => xs.map(([name, width]) => ({ name, width }))
  out.SSP1BUF = sfr(MSSP1_ADDR, 0, sfrBits('', 0), ['H18', 'H19'])
  out.SSP1ADD = sfr(MSSP1_ADDR + 1, 0, sfrBits('', 0), ['H18', 'H19'])
  out.SSP1MSK = sfr(MSSP1_ADDR + 2, 0xff, sfrBits('', 0), ['H18', 'H19'])
  out.SSP1STAT = sfr(MSSP1_ADDR + 3, 0, namedBits('BF UA R_nW S P D_nA CKE SMP'), ['H18', 'H19'])
  out.SSP1CON1 = { ...sfr(MSSP1_ADDR + 4, 0, namedBits('SSPM0 SSPM1 SSPM2 SSPM3 CKP SSPEN SSPOV WCOL'), ['H18', 'H19']), fields: f(['SSPM', 4], ['CKP', 1], ['SSPEN', 1], ['SSPOV', 1], ['WCOL', 1]) }
  out.SSP1CON2 = sfr(MSSP1_ADDR + 5, 0, namedBits('SEN RSEN PEN RCEN ACKEN ACKDT ACKSTAT GCEN'), ['H18', 'H19'])
  out.SSP1CON3 = sfr(MSSP1_ADDR + 6, 0, namedBits('DHEN AHEN SBCDE SDAHT BOEN SCIE PCIE ACKTIM'), ['H18', 'H19'])
  ;['SSP1CLKPPS', 'SSP1DATPPS', 'SSP1SSPPS'].forEach((name, i) => (out[name] = sfr(SSP1_PPS_IN_ADDR + i, 0, namedBits(`${name}0 ${name}1 ${name}2 ${name}3 ${name}4 - - -`), ['H38', 'H19'])))
  // CCP1 (banque 6) : CCPR1L, CCPR1H, CCP1CON (EN<7>, OUT<5>, FMT<4>, MODE<3:0>) ; sélection du timer CCPTMRS0/1
  out.CCPR1L = sfr(CCP1_ADDR, 0, sfrBits('', 0), ['H18', 'H19'])
  out.CCPR1H = sfr(CCP1_ADDR + 1, 0, sfrBits('', 0), ['H18', 'H19'])
  out.CCP1CON = { ...sfr(CCP1_ADDR + 2, 0, namedBits('CCP1MODE0 CCP1MODE1 CCP1MODE2 CCP1MODE3 CCP1FMT CCP1OUT - CCP1EN'), ['H18', 'H19']), fields: f(['CCP1MODE', 4], ['CCP1FMT', 1], ['CCP1OUT', 1], [null, 1], ['CCP1EN', 1]) }
  // Timer de chaque module : 01 = Timer2, 10 = Timer4, 11 = Timer6 (CxTSEL, PxTSEL)
  out.CCPTMRS0 = { ...sfr(CCPTMRS_ADDR, 0x55, namedBits('C1TSEL0 C1TSEL1 C2TSEL0 C2TSEL1 C3TSEL0 C3TSEL1 C4TSEL0 C4TSEL1'), ['H18', 'H19']), fields: f(['C1TSEL', 2], ['C2TSEL', 2], ['C3TSEL', 2], ['C4TSEL', 2]) }
  out.CCPTMRS1 = { ...sfr(CCPTMRS_ADDR + 1, 0x15, namedBits('C5TSEL0 C5TSEL1 P6TSEL0 P6TSEL1 P7TSEL0 P7TSEL1 - -'), ['H18', 'H19']), fields: f(['C5TSEL', 2], ['P6TSEL', 2], ['P7TSEL', 2], [null, 2]) }
  // PWM6 et PWM7 (banque 12) : PWMxDCL (DC<1:0> en bits 7:6), PWMxDCH (DC<9:2>), PWMxCON (EN<7>, OUT<5>, POL<4>)
  for (const [n, base] of Object.entries(PWM_ADDR)) {
    out[`PWM${n}DCL`] = { ...sfr(base, 0, namedBits(`- - - - - - PWM${n}DC0 PWM${n}DC1`), ['H18', 'H19']), fields: f([null, 6], [`PWM${n}DC`, 2]) }
    out[`PWM${n}DCH`] = sfr(base + 1, 0, sfrBits('', 0), ['H18', 'H19'])
    out[`PWM${n}CON`] = sfr(base + 2, 0, namedBits(`- - - - PWM${n}POL PWM${n}OUT - PWM${n}EN`), ['H18', 'H19'])
  }
  // EUSART (banque 2) : RC1REG, TX1REG, SP1BRGL, SP1BRGH, RC1STA, TX1STA, BAUD1CON consécutifs ; TRMT = 1 au reset
  const E = EUSART_ADDR
  out.RC1REG = { ...sfr(E, 0, sfrBits('', 0), ['H18', 'H19']), alias: 'RCREG' }
  out.TX1REG = { ...sfr(E + 1, 0, sfrBits('', 0), ['H18', 'H19']), alias: 'TXREG' }
  out.SP1BRGL = { ...sfr(E + 2, 0, sfrBits('', 0), ['H18', 'H19']), alias: 'SPBRGL' }
  out.SP1BRGH = { ...sfr(E + 3, 0, sfrBits('', 0), ['H18', 'H19']), alias: 'SPBRGH' }
  out.RC1STA = { ...sfr(E + 4, 0, namedBits('RX9D OERR FERR ADDEN CREN SREN RX9 SPEN'), ['H18', 'H19']), alias: 'RCSTA' }
  out.TX1STA = { ...sfr(E + 5, 0x02, namedBits('TX9D TRMT BRGH SENDB SYNC TXEN TX9 CSRC'), ['H18', 'H19']), alias: 'TXSTA' }
  out.BAUD1CON = { ...sfr(E + 6, 0, namedBits('ABDEN WUE - BRG16 SCKP - RCIDL ABDOVF'), ['H18', 'H19']), alias: 'BAUDCON' }
  // Entrée RX de l'EUSART par PPS (RXPPS) — H44
  out.RXPPS = sfr(RX_PPS_ADDR, 0, namedBits('RXPPS0 RXPPS1 RXPPS2 RXPPS3 RXPPS4 - - -'), ['H44', 'H19'])
  // ADCC (cours p. 92 à 100) : ADRESL, ADRESH, ADPCH ; ADACQ, ADCAP, ADPRE ; ADACT, ADCLK, ADREF, ADCON0 à ADCON3, ADSTAT
  const R = ADC_RES_ADDR
  out.ADRESL = sfr(R, 0, sfrBits('', 0), ['H18', 'H19'])
  out.ADRESH = sfr(R + 1, 0, sfrBits('', 0), ['H18', 'H19'])
  out.ADPCH = sfr(R + 3, 0, namedBits('ADPCH0 ADPCH1 ADPCH2 ADPCH3 ADPCH4 ADPCH5 - -'), ['H18', 'H19'])
  const C = ADC_CFG_ADDR
  out.ADACQ = sfr(C, 0, sfrBits('', 0), ['H18', 'H19'])
  out.ADCAP = sfr(C + 1, 0, namedBits('ADCAP0 ADCAP1 ADCAP2 ADCAP3 ADCAP4 - - -'), ['H18', 'H19'])
  out.ADPRE = sfr(C + 2, 0, sfrBits('', 0), ['H18', 'H19'])
  out.ADACT = sfr(C + 4, 0, namedBits('ADACT0 ADACT1 ADACT2 ADACT3 ADACT4 - - -'), ['H18', 'H19'])
  out.ADCLK = { ...sfr(C + 5, 0, namedBits('ADCCS0 ADCCS1 ADCCS2 ADCCS3 ADCCS4 ADCCS5 - -'), ['H18', 'H19']), fields: f(['ADCCS', 6], [null, 2]) }
  out.ADREF = { ...sfr(C + 6, 0, namedBits('ADPREF0 ADPREF1 - - ADNREF - - -'), ['H18', 'H19']), fields: f(['ADPREF', 2], [null, 2], ['ADNREF', 1], [null, 3]) }
  out.ADCON0 = sfr(C + 7, 0, namedBits('ADGO - ADFM - ADCS - ADCONT ADON'), ['H18', 'H19'])
  out.ADCON1 = sfr(C + 8, 0, namedBits('ADDSEN - - - - ADGPOL ADIPEN ADPPOL'), ['H18', 'H19'])
  out.ADCON2 = sfr(C + 9, 0, sfrBits('', 0), ['H18', 'H19'])
  out.ADCON3 = sfr(C + 10, 0, sfrBits('', 0), ['H18', 'H19'])
  out.ADSTAT = sfr(C + 11, 0, sfrBits('', 0), ['H18', 'H19'])
  for (const p of PORTS) {
    const n = p === 'E' ? 3 : 8
    for (let b = 0; b < n; b++) out[`R${p}${b}PPS`] = sfr(PPS_OUT_ADDR[p] + b, 0, namedBits(`R${p}${b}PPS0 R${p}${b}PPS1 R${p}${b}PPS2 R${p}${b}PPS3 R${p}${b}PPS4 R${p}${b}PPS5 - -`), ['H38', 'H19'])
  }
  return out
}

export const INFO3 = {
  /** Brochage de la carte Curiosity HPC et des cartes filles (PRD §3.1) */
  pins: {
    leds: [
      { name: 'D2', pin: 'RA4', activeLevel: 1, source: 'annexe 1, CR TP1' },
      { name: 'D3', pin: 'RA5', activeLevel: 1, source: 'annexe 1, CR TP1' },
      { name: 'D4', pin: 'RA6', activeLevel: 1, source: 'annexe 1, CR TP1' },
      { name: 'D5', pin: 'RA7', activeLevel: 1, source: 'annexe 1, CR TP1' },
    ],
    /** Boutons : 0 = appuyé, tirage 10 kΩ + 1 kΩ série (niveau 1 relâché, imposé par la carte) */
    buttons: [
      { name: 'S1', pin: 'RB4', activeLevel: 0, source: 'annexe 1, CR TP3' },
      { name: 'S2', pin: 'RC5', activeLevel: 0, source: 'annexe 1, CR TP3' },
    ],
    pot: { pin: 'RA0', source: 'annexe 1' },
    joystick: { horz: 'RD5', vert: 'RD6', sw: 'RA1', swActiveLevel: 0, source: 'annexe 2' },
    rgb: { r: 'RD4', g: 'RC0', b: 'RC1', activeLevel: 1, source: 'annexe 2' },
    uart: { tx: 'RC6', rx: 'RC7', source: 'annexe 2' },
    mikrobus1: { AN: 'RA1', RST: 'RD0', CS: 'RA3', SCK: 'RB1', MISO: 'RB2', MOSI: 'RB3', PWM: 'RC2', INT: 'RB5', RX: 'RC7', TX: 'RC6', SCL: 'RC3', SDA: 'RC4', source: 'annexe 1' },
    mikrobus2: { AN: 'RA2', RST: 'RD2', CS: 'RD3', SCK: 'RB1', MISO: 'RB2', MOSI: 'RB3', PWM: 'RD1', INT: 'RB0', RX: 'RC0', TX: 'RC1', SCL: 'RC3', SDA: 'RC4', source: 'annexe 1, cours p. 78' },
    rotary: { slot: 'mikrobus2', ENCB: 'RA2', ENCA: 'RD1', SW: 'RB0', RST: 'RD2', LATCH: 'RD3', source: 'cours p. 34 et 78, annexe 3' },
    matrix8x8: { slot: 'mikrobus1', CS: 'RA3', CLK: 'RB1', DIN: 'RB3', source: 'annexe 5, annexe 2' },
  },
  /** Horloges (PRD §3.2) */
  clock: {
    /** Fosc après OSCILLATOR_Initialize — Hz (4 MHz : HFINTOSC 4 MHz, NDIV 1) — fichiers MCC TP1 (H1 réfutée) */
    foscDefault: 4e6,
    /** Cycles d'horloge par cycle instruction (Tcy = 4 / Fosc) — cours */
    foscPerTcy: 4,
    /** LFINTOSC — Hz (31 kHz) — CR TP3 */
    lfintosc: 31e3,
    /** Champ « Clock Frequency » grisé de MCC — Hz — affichage seul, jamais utilisé (CR TP3, cours p. 64) */
    mccGreyedClockField: 32768,
    /** Fréquences HFINTOSC — MHz, dans l'ordre des codes HFFRQ (000 = 1 MHz … 110 = 32 MHz) — H18 */
    hfintoscMHz: [1, 2, 4, 8, 12, 16, 32],
    /** Codes NOSC<2:0> d'OSCCON1 — H18 */
    nosc: { HFINTOSC: 0b110, LFINTOSC: 0b101 },
    /** Diviseur maximal (NDIV = log2 du diviseur, 0 à 9) */
    maxDivider: 512,
    /**
     * Base de temps de la VM — Hz : PPCM de toutes les fréquences Fcy possibles
     * (HFINTOSC 1 à 32 MHz et LFINTOSC 31 kHz, divisées par 1 à 512, puis par 4), pour que chaque Tcy dure
     * un nombre entier de « ticks » (744 MHz → 1 MHz : 2976 ticks par Tcy ; 32 MHz : 93 ; 31 kHz : 96 000).
     */
    timeBaseHz: 744e6,
    hyp: ['H1'],
  },
  /** MCC Classic (étape 2) */
  mcc: {
    /** Valeurs par défaut du System Module : HFINTOSC 4 MHz / 1 = 4 MHz, LVP coché — fichiers MCC TP1 */
    defaultSystem: { oscillator: 'HFINTOSC', hfMHz: 4, divider: 1, lvp: true },
    /** Une nouvelle entrée GPIO a « Analog » coché, une sortie non (H23) */
    analogDefault: { input: true, output: false },
    /** Ports affichés dans le Pin Manager : Grid View (RE3 = MCLR, entrée seule) */
    gridPorts: { A: 8, B: 8, C: 8, D: 8, E: 4 },
    /** Broche d'entrée seule (MCLR) */
    inputOnly: ['RE3'],
    /** Boîtier sélectionné par défaut dans le Pin Manager : Grid View (captures du CR) */
    defaultPackage: 'UQFN40',
    /** Numéros de broche par boîtier : UQFN40 relevé sur les captures du CR ; PDIP40 du datasheet (H18) */
    packages: {
      UQFN40: {
        RA0: 17, RA1: 18, RA2: 19, RA3: 20, RA4: 21, RA5: 22, RA6: 29, RA7: 28,
        RB0: 8, RB1: 9, RB2: 10, RB3: 11, RB4: 12, RB5: 13, RB6: 14, RB7: 15,
        RC0: 30, RC1: 31, RC2: 32, RC3: 33, RC4: 38, RC5: 39, RC6: 40, RC7: 1,
        RD0: 34, RD1: 35, RD2: 36, RD3: 37, RD4: 2, RD5: 3, RD6: 4, RD7: 5,
        RE0: 23, RE1: 24, RE2: 25, RE3: 16,
      } as Record<string, number>,
      PDIP40: {
        RE3: 1, RA0: 2, RA1: 3, RA2: 4, RA3: 5, RA4: 6, RA5: 7, RE0: 8, RE1: 9, RE2: 10, RA7: 13, RA6: 14,
        RC0: 15, RC1: 16, RC2: 17, RC3: 18, RD0: 19, RD1: 20, RD2: 21, RD3: 22, RC4: 23, RC5: 24, RC6: 25, RC7: 26,
        RD4: 27, RD5: 28, RD6: 29, RD7: 30, RB0: 33, RB1: 34, RB2: 35, RB3: 36, RB4: 37, RB5: 38, RB6: 39, RB7: 40,
      } as Record<string, number>,
    },
    /** Lignes fixes du Grid View : sortie d'horloge (RA6 seulement) et MCLR (RE3, verrouillée) */
    clkoutPin: 'RA6',
    mclrPin: 'RE3',
    /** Dossier des fichiers générés */
    dir: 'mcc_generated_files',
    hyp: ['H18', 'H23', 'H25', 'H26'],
  },
  /** Cartes Click enfichables sur les mikroBUS (inertes à l'étape 2) */
  clickBoards: {
    rotary: { name: 'ROTARY O click', expectedSlot: 'mikrobus2', pinsKey: 'rotary' },
    matrix8x8: { name: '8x8 R click', expectedSlot: 'mikrobus1', pinsKey: 'matrix8x8' },
  },
  /** TP1 : valeurs du cahier des charges utilisées par le professeur virtuel */
  tp1: {
    /** Tolérance relative des défis de temps (PRD §3.5) */
    tolerance: 0.005,
    /** 3.3 : demi-période du clignotement de D2 — s (500 ms) */
    blinkHalfPeriodS: 0.5,
    /** 3.4 : délai maximal entre S1 et D2 — s (1 ms) */
    followMaxS: 1e-3,
    /** 3.5 : durée d'un pas du chenillard — s */
    chaserStepS: 1,
    /** 3.6 : pas du chenillard bidirectionnel : libre (énoncé muet), constant à ± 1 % entre 100 ms et 2 s — s */
    bidirStep: { min: 0.1, max: 2, tolerance: 0.01 },
    /** 3.6 / 3.7 : motif initial et largeur du motif — bits */
    pattern: 0b0110,
    patternBits: 4,
    /** §4 : tempos du cycle S2 (initiale, puis après 1, 2, 3 appuis) — s */
    tempoCycleS: [0.5, 1, 2, 0.5],
    /** §4.3 : délai maximal pour le clignotement d'acquittement — s */
    ackWithinS: 1,
    /** Noms MCC attendus : LED_D2…LED_D5, BP_S1, BP_S2 (CR TP1) */
    namePrefix: { led: 'LED_', button: 'BP_' },
    source: 'consigne étape 2 (énoncé TP1 §3–4, à recouper avec docs/info3/enonce.md)',
  },
  /** Unités de temps (conversion des intrinsèques __delay_ms / __delay_us) */
  units: { msPerS: 1e3, usPerS: 1e6 },
  /** Langage C de XC8 v2 pour PIC16 (PRD §4.1) */
  c: {
    bitsPerByte: 8,
    sizes: { char: 1, short: 2, int: 2, long: 4, float: 4, double: 4, pointer: 2 },
    /** char non signé par défaut, comme XC8 */
    charSigned: false,
    /** Précision par défaut de %f */
    printfFloatPrecision: 6,
    /** Taille du tampon de mise en forme de printf — octets (limite du simulateur) */
    printfBufferSize: 128,
    /** Valeur de __XC8_VERSION (XC8 v2.31 du projet TP1) — H27 */
    xc8Version: 2310,
    /** Profondeur maximale d'#include imbriqués (limite du simulateur) */
    maxIncludeDepth: 32,
  },
  /** Cœur et coûts d'exécution (PRD §4.2) */
  cpu: {
    /** Pile matérielle — niveaux, ISR comprise — datasheet / cours */
    hwStackDepth: 16,
    /**
     * Coût en Tcy par catégorie d'opération du bytecode — H2 affinée
     * (moyenne ≈ 4 Tcy par instruction C élémentaire).
     */
    cost: { simple: 1, op16: 2, op32: 4, float: 4, call: 2, ret: 2, sfr: 1, jump: 2 },
    /** Latence d'entrée en interruption — Tcy (3 à 5) — PRD §4.2 */
    interruptLatencyTcy: { min: 3, max: 5 },
    hyp: ['H2'],
  },
  /** Sources d'interruption : GIE ET (IE·IF en PIE0/PIR0, ou PEIE ET IE·IF en PIE1…8/PIR1…8) */
  interrupts: {
    gie: { sfr: 'INTCON', bit: 'GIE' },
    peie: { sfr: 'INTCON', bit: 'PEIE' },
    firstLevel: [['PIE0', 'PIR0']],
    peripheral: [['PIE1', 'PIR1'], ['PIE2', 'PIR2'], ['PIE3', 'PIR3'], ['PIE4', 'PIR4'], ['PIE5', 'PIR5'], ['PIE6', 'PIR6'], ['PIE7', 'PIR7'], ['PIE8', 'PIR8']],
    stackOverflow: { sfr: 'PCON0', bit: 'STKOVF' },
    stackUnderflow: { sfr: 'PCON0', bit: 'STKUNF' },
    /** IOCIF (PIR0) : lecture seule, OU de tous les IOCxF (datasheet DS40001802) */
    iocSummary: { sfr: 'PIR0', bit: 'IOCIF' },
    /** Ports dotés de l'IOC (pas d'IOC sur le port D) */
    iocPorts: ['A', 'B', 'C', 'E'],
  },
  /** Timers 2, 4, 6 (TMR2/4/6) : MCC (captures du CR TP3) et modèle timer246 */
  timers: {
    ids: [2, 4, 6],
    /** Compteur 8 bits : TMRx revient à 0 au cycle qui suit TMRx = PRx */
    counterRange: 256,
    /** Clock Source de MCC → TxCLKCON.CS (FOSC/4 = 0x01 cours p. 58 ; LFINTOSC = 0x04 cours p. 65 ; autres codes H18) */
    clockSources: [
      { label: 'FOSC/4', cs: 0x01 },
      { label: 'FOSC', cs: 0x02 },
      { label: 'HFINTOSC', cs: 0x03 },
      { label: 'LFINTOSC', cs: 0x04 },
      { label: 'MFINTOSC', cs: 0x05 },
    ],
    /** MFINTOSC — Hz (500 kHz) — datasheet (H18) */
    mfintosc: 500e3,
    /** Prescaler 1:1 à 1:128 (CKPS = log2), postscaler 1:1 à 1:16 (OUTPS = valeur − 1) */
    prescalerMaxLog2: 7,
    postscalerMax: 16,
    /**
     * Control Mode et Start/Reset Option de MCC → TxHLT.MODE (cours p. 58 : Roll over 0x00 ; p. 65 : Monostable
     * front montant 0x11 ; front descendant 0x12 = H31 ; deux fronts 0x13). `{ers}` = TMR2_ers, TMR4_ers…
     */
    modes: [
      { control: 'Roll over pulse', start: 'Software control', mode: 0x00 },
      { control: 'One shot', start: 'Software control', mode: 0x08 },
      { control: 'One shot', start: 'Starts on rising edge on {ers}', mode: 0x09 },
      { control: 'One shot', start: 'Starts on falling edge on {ers}', mode: 0x0a },
      { control: 'One shot', start: 'Starts on any edge on {ers}', mode: 0x0b },
      { control: 'Monostable', start: 'Starts on rising edge on {ers}', mode: 0x11 },
      { control: 'Monostable', start: 'Starts on falling edge on {ers}', mode: 0x12 },
      { control: 'Monostable', start: 'Starts on any edge on {ers}', mode: 0x13 },
    ],
    /** Front de démarrage par MODE<1:0> en one-shot et monostable : 1 montant, 2 descendant, 3 les deux */
    edgeBits: { rising: 1, falling: 2 },
    /** Familles de MODE<4:3> : 00 roll over, 01 one shot, 10 monostable */
    modeFamily: { shift: 3, rollOver: 0, oneShot: 1, monostable: 2 },
    /** Ext Reset Source → TxRST.RSEL (seule l'entrée par broche est simulée) */
    ersSources: [{ label: 'T{n}CKIPPS pin', rsel: 0 }],
    /** Ports proposés pour l'entrée TxIN dans le Grid View (T2IN sur A et C : captures du CR ; T4IN, T6IN : H18) */
    ersPorts: { 2: ['A', 'C'], 4: ['B', 'C'], 6: ['B', 'D'] },
    /** Réglages d'un timer ajouté depuis Device Resources (valeurs initiales du simulateur) */
    mccDefault: { enabled: true, controlMode: 'Roll over pulse', startOption: 'Software control', ersSource: 'T{n}CKIPPS pin', clockSource: 'FOSC/4', clockSync: false, polarity: 'Rising Edge', prescaler: 1, prescalerSync: false, postscaler: 1, periodS: 100e-6, interrupt: false },
    polarities: ['Rising Edge', 'Falling Edge'],
    /** Arrondi des durées affichées par MCC : la nanoseconde (64.516 us, 16.516129 ms : captures du CR) */
    mccPeriodResolutionS: 1e-9,
    /** Registre PPS d'entrée : port << 3 | bit (RC5 → 0x15) */
    ppsPortShift: 3,
    /** Interruption de période : PIR4.TMRxIF, PIE4.TMRxIE */
    irq: { flag: 'PIR4', enable: 'PIE4' },
    hyp: ['H18', 'H31', 'H32', 'H33'],
  },
  /** MSSP1 en SPI maître (cours p. 71 à 74) */
  spi: {
    /** Mode SPI → CKP, CKE (CPHA = complément de CKE) */
    modes: [
      { mode: 0, ckp: 0, cke: 1 },
      { mode: 1, ckp: 0, cke: 0 },
      { mode: 2, ckp: 1, cke: 1 },
      { mode: 3, ckp: 1, cke: 0 },
    ],
    /** Clock Source → SSPM<3:0> ; période de SCK en Tcy (ADD : SSP1ADD + 1 ; TMR2 : 2 périodes de TMR2) */
    clockSources: [
      { label: 'FOSC/4', sspm: 0b0000, tcy: 1 },
      { label: 'FOSC/16', sspm: 0b0001, tcy: 4 },
      { label: 'FOSC/64', sspm: 0b0010, tcy: 16 },
      { label: 'T2_match_PR2/2', sspm: 0b0011, tcy: 0 },
      { label: 'FOSC/4_SSPxADD', sspm: 0b1010, tcy: 0 },
    ],
    sampleOptions: ['Middle', 'End'],
    /** Codes PPS de sortie (H38) */
    ppsOut: { SCK1: 0x14, SDO1: 0x15 },
    /** Ports proposés pour SCK1, SDI1, SDO1 dans le Grid View (H38) */
    ppsPorts: ['B', 'C'],
    /** Broches par défaut (annexe 1 : bus SPI des deux mikroBUS) */
    defaultPins: { SCK1: 'RB1', SDI1: 'RB2', SDO1: 'RB3' },
    /** Réglages d'un MSSP1 ajouté (horloge par défaut Fosc/4 : H7) */
    mccDefault: { mode: 0, sample: 'Middle', clockSource: 'FOSC/4', divider: 0 },
    irq: { flag: 'PIR3', bit: 'SSP1IF' },
    hyp: ['H7', 'H14', 'H37', 'H38', 'H39'],
  },
  /** PWM du TP5 : CCP1 en mode PWM, PWM6 et PWM7, base de temps TMR2 (cours p. 85 à 90) */
  pwm: {
    /** Modules : nom MCC, registres, sélection du timer (CCPTMRSx.champ) et code PPS de sortie (H44) */
    modules: [
      { id: 'CCP1', kind: 'ccp', tsel: { sfr: 'CCPTMRS0', field: 'C1TSEL', shift: 0 }, ppsOut: 0x09 },
      { id: 'PWM6', kind: 'pwm', tsel: { sfr: 'CCPTMRS1', field: 'P6TSEL', shift: 2 }, ppsOut: 0x0e },
      { id: 'PWM7', kind: 'pwm', tsel: { sfr: 'CCPTMRS1', field: 'P7TSEL', shift: 4 }, ppsOut: 0x0f },
    ],
    /** Code CxTSEL / PxTSEL → timer (01 = TMR2, 10 = TMR4, 11 = TMR6) */
    timerSelect: { 1: 2, 2: 4, 3: 6 } as Record<number, number>,
    tselMask: 0b11,
    /** Mode PWM de CCP1CON.MODE (MCC écrit CCP1CON = 0x8F : EN, MODE = 1111) */
    ccpPwmMode: 0b1111,
    /** Bits du rapport cyclique, et facteur entre la base 10 bits et TMR2 (2 bits de plus : 4 × (PR2 + 1)) */
    dutyBits: 10,
    dutyPerCount: 4,
    /** Source d'horloge imposée par le cours (p. 85) pour le timer de la PWM ; sinon notification MCC (H41) */
    requiredClock: 'FOSC/4',
    /** En dessous de cette période, les fronts ne sont plus émis un à un (limite du simulateur) : niveau moyen seul — s */
    minEdgePeriodS: 10e-6,
    /** Broches de la LED RGB par module (TP5 : PWM6 → R, PWM7 → G, CCP1 → B, énoncé §1 ; annexe 2) */
    defaultPins: { PWM6: 'RD4', PWM7: 'RC0', CCP1: 'RC1' } as Record<string, string>,
    /** Ports proposés dans le Grid View pour les sorties CCP1/PWM6/PWM7 (H44) */
    ppsPorts: ['A', 'B', 'C', 'D'],
    /** Réglages d'un module ajouté : Timer2, rapport cyclique initial 0 (MCC : Duty Cycle 0 %) */
    mccDefault: { timer: 'TMR2', dutyCycle: 0, polarity: 'active_hi', enabled: true },
    hyp: ['H18', 'H41', 'H42', 'H44'],
  },
  /** LED RGB de la carte fille (annexe 2) : anode commune, broche à 1 = couleur allumée (transistor PDTC114) */
  rgb: {
    /** Couleur affichée = rapports cycliques pondérés, sans calibration (H17) ; teinte de chaque puce */
    /** Noms des voies dans les images du Worker (mêmes noms que les points de test) */
    signals: { r: 'RGB_R', g: 'RGB_G', b: 'RGB_B' },
    tints: { r: [255, 0, 0], g: [0, 255, 0], b: [0, 0, 255] } as Record<'r' | 'g' | 'b', [number, number, number]>,
    /** Sans le cache : halo d'éblouissement si l'intensité totale dépasse ce seuil (0 à 3) */
    glareThreshold: 0.15,
    /** Intensité totale à partir de laquelle le halo est maximal */
    glareFull: 1.5,
    hyp: ['H12', 'H17'],
  },
  /** ADCC 10 bits (cours p. 92 à 100) */
  adcc: {
    bits: 10,
    /** VREF+ = VDD = 3,3 V (H5), VREF- = VSS */
    vref: 3.3,
    /** Durée d'une conversion = 11,5 TAD + acquisition (ADACQ × TAD) — cours p. 98 */
    conversionTad: 11.5,
    /** TAD minimal (cours p. 98) — s */
    minTadS: 1e-6,
    /** TAD de l'oscillateur FRC (ADCS = 1) — s — H51 */
    frcTadS: 2e-6,
    /** Clock Source FOSC/ADCLK : TAD = 2 × (ADCCS + 1) / Fosc ; diviseurs proposés par MCC */
    dividers: [2, 4, 8, 16, 32, 64, 128],
    /** Bruit de conversion : ± 1 LSB, aléa à graine fixée */
    noiseLsb: 1,
    seed: 6,
    /** Code de voie ADPCH : port × 8 + bit (ANA0 = 0x00 … RD5 = 0x1D, RD6 = 0x1E — H50) ; voies internes (cours p. 99) */
    portStride: 8,
    internal: [
      { name: 'channel_VSS', ch: 0x3c },
      { name: 'channel_Temp', ch: 0x3d },
      { name: 'channel_DAC1', ch: 0x3e },
      { name: 'channel_FVR_buf1', ch: 0x3f },
    ],
    /** Voies du TP6 et noms MCC (énoncé, annexes 1 et 2) */
    tpChannels: [
      { name: 'POT', pin: 'RA0' },
      { name: 'JOY_HORZ', pin: 'RD5' },
      { name: 'JOY_VERT', pin: 'RD6' },
    ],
    /** Réglages d'un ADCC ajouté (FOSC/4 → TAD = 1 µs à 4 MHz) */
    mccDefault: { enabled: true, alignment: 'right', clockSource: 'FOSC/ADCLK', divider: 4, acquisition: 0, interrupt: false },
    irq: { flag: 'PIR1', bit: 'ADIF', enable: 'PIE1' },
    hyp: ['H5', 'H18', 'H49', 'H50', 'H51', 'H52'],
  },
  /** Potentiomètre R1 de la Curiosity (RA0) et joystick de la carte fille (RD5, RD6, SW sur RA1) */
  analog: {
    /** Joystick au repos, valeurs brutes (H4) ; butées 0 et 1023 ; X croît vers la droite, Y vers le BAS (H48) */
    joyRest: { x: 498, y: 530 },
    joyYDown: true,
    /** Pas du clavier (flèches) — fraction de la course */
    joyKeyStep: 1,
    /** Potentiomètre au démarrage — fraction de la course */
    potStart: 0.5,
    hyp: ['H4', 'H48'],
  },
  /** EUSART (cours p. 104 à 110) et terminal du PC */
  eusart: {
    /** Baud = Fosc / (diviseur × (SPBRG + 1)) ; diviseur selon BRG16 et BRGH (cours p. 107 et 108) */
    divider: { brg16brgh: 4, one: 16, none: 64 },
    /** 8N1 : 1 bit de start, 8 bits de données (LSB en premier), 1 bit de stop */
    dataBits: 8,
    stopBits: 1,
    /** Bauds proposés (MCC et terminal) */
    bauds: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200],
    /** Écart toléré entre baud demandé et baud réel, et entre émetteur et récepteur (cours p. 107) */
    maxErrorRatio: 0.05,
    /** FIFO de réception de l'EUSART (2 octets, cours p. 105) */
    rxFifo: 2,
    /** Tampons logiciels de eusart.c avec interruptions (MCC 1.81, H43) */
    swBufferSize: 8,
    /** Broches de la carte fille et codes PPS (TX = 0x10 ; RXPPS = port << 3 | bit) — H44 */
    defaultPins: { TX1: 'RC6', RX1: 'RC7' },
    ppsOutTx: 0x10,
    ppsPorts: ['B', 'C'],
    /** Réglages d'un EUSART ajouté (9600 bauds : H6) */
    mccDefault: { baud: 9600, enable: true, transmit: true, receive: true, redirectStdio: false, interrupts: false },
    irq: { flag: 'PIR3', tx: 'TXIF', rx: 'RCIF', enable: 'PIE3' },
    hyp: ['H6', 'H18', 'H43', 'H44'],
  },
  /** Terminal série du PC (port COM virtuel de l'USB blanc, H12) */
  terminal: {
    formats: [
      { id: '8N1', dataBits: 8, parity: 'none', stopBits: 1 },
      { id: '8E1', dataBits: 8, parity: 'even', stopBits: 1 },
      { id: '8O1', dataBits: 8, parity: 'odd', stopBits: 1 },
      { id: '7N1', dataBits: 7, parity: 'none', stopBits: 1 },
      { id: '8N2', dataBits: 8, parity: 'none', stopBits: 2 },
    ],
    defaultBaud: 9600,
    defaultFormat: '8N1',
    /** Caractères conservés à l'écran (limite du simulateur) */
    maxChars: 20000,
    /** Instant d'échantillonnage dans un bit (milieu) */
    samplePoint: 0.5,
    hyp: ['H12', 'H47'],
  },
  /** TP5 : cahier des charges utilisé par le professeur virtuel (consigne étape 5) */
  tp5: {
    /** §1 : période de la PWM « environ 4 ms » (prescaler à choisir) ; écart toléré pour « environ » */
    periodS: 4e-3,
    periodAbout: 0.1,
    /** Mesure à l'oscilloscope : écart relatif toléré */
    scopeTolerance: 0.005,
    /** §1 : rouge = PWM6 ≥ 99 %, PWM7 = CCP1 = 0 % ; texte attendu au terminal */
    redMinDuty: 0.99,
    redLine: '(R,G,B) = (255,0,0)',
    /** §2 : couleurs de l'énoncé (R, G, B) */
    colors: [[255, 0, 0], [44, 117, 255], [253, 63, 146]] as [number, number, number][],
    /** §2 : couleur 8 bits → 10 bits (× 4, décalage de 2) */
    colorShift: 2,
    /** §2 : une ligne par seconde, ± 2 % */
    lineIntervalS: 1,
    lineTolerance: 0.02,
    /** §2 : rapport cyclique maximal sans conversion (255 / 1023 ≈ 25 %) */
    unconvertedMaxDuty: 0.25,
    /** §3 : pas d'incrément (énoncé : « par pas de 16 ») et LED de chaque état (D5 rouge, D4 vert, D3 bleu) */
    step: 16,
    stateLeds: ['D5', 'D4', 'D3'],
    /** §4 : crans tournés dans chaque sens */
    encoderDetents: 4,
    source: 'énoncé TP5 et consigne étape 5 (pas de CR du TP5)',
  },
  /** MAX7219 de la carte 8x8 R click (annexe 6) et câblage sur le mikroBUS (annexe 5) */
  max7219: {
    digits: 8,
    frameBits: 16,
    addressBits: 4,
    reg: { noop: 0x00, digit0: 0x01, decode: 0x09, intensity: 0x0a, scanLimit: 0x0b, shutdown: 0x0c, test: 0x0f },
    /** Police Code B (table 5) : 0 à 9, -, E, H, L, P, blanc ; bits DP A B C D E F G = 7 … 0 */
    codeB: [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b, 0x01, 0x4f, 0x37, 0x0e, 0x67, 0x00],
    /** Intensité : (2n+1)/32 ; Display Test : 31/32 sur 8 digits */
    intensitySteps: 32,
    testIntensity: 31 / 32,
    /** Signaux du mikroBUS reliés au MAX7219 : LOAD ← CS, CLK ← SCK, DIN ← MOSI (annexe 5) */
    wiring: { LOAD: 'CS', CLK: 'SCK', DIN: 'MOSI' },
    hyp: ['H11', 'H53'],
  },
  /** TP6 : cahier des charges utilisé par le professeur virtuel (énoncé TP6 et consigne étape 6) */
  tp6: {
    /** §2 : une conversion X toutes les 10 ms (± 1 %), Y lancée dans l’IT de fin de X (« enchainer dès la fin », énoncé), affichage toutes les 1 s (± 2 %) */
    acqPeriodS: 0.01,
    acqTolerance: 0.01,
    printPeriodS: 1,
    printTolerance: 0.02,
    source: 'énoncé TP6 et consigne étape 6 (pas de CR du TP6)',
  },
  /** Mode examen (/info3/examen) : barème = H54 sauf durée par défaut et pénalité (consigne étape 7, PRD §7) */
  exam: {
    /** Durée par défaut — min (consigne : 1 h 30) */
    defaultMinutes: 90,
    /** Nombre de questions tirées (consigne : 3 à 5) */
    questions: { min: 3, max: 5 },
    /** Part de la configuration (Faire vérifier) dans les points d'une question — H54 */
    configShare: 0.25,
    /** Pénalité par manipulation sous tension — points (consigne : 2, barème à confirmer) */
    penaltyPerLiveManip: 2,
    /** Note maximale */
    scale: 20,
    /** Défis exclus du tirage : aucune solution de référence validée (TP1 4.3, bonus) */
    excluded: ['tp1-4-3'],
    /** Pages du cours citées à la correction, par TP (références déjà utilisées par les modèles et MCC) */
    coursePages: { 1: 'cours p. 9 à 22', 2: 'cours p. 36 à 40', 3: 'cours p. 58 à 65', 4: 'cours p. 71 à 82', 5: 'cours p. 85 à 110', 6: 'cours p. 92 à 100' } as Record<number, string>,
    hyp: ['H54'],
  },
  /** Chaîne de deux 74HC595 de la carte Rotary : 16 LED (annexe 3, cours p. 81 et 82) */
  ring: {
    leds: 16,
    /** Signaux du mikroBUS : RST → MR (actif à 0), CS → RCLK (LATCH) ; SDI → SER de U2, Q7S de U3 → SDO */
    wiring: { MR: 'RST', LATCH: 'CS', SER: 'MOSI', SRCLK: 'SCK', Q7S: 'MISO' },
    hyp: ['H10', 'H14', 'H36'],
  },
  /** Codeur EC12D de la carte ROTARY O click (CR TP2) */
  rotary: {
    /** Crans par tour et impulsions par tour et par voie (CR TP2 §2.1) */
    detentsPerTurn: 30,
    pulsesPerTurn: 15,
    /** Entre deux crans, la seconde voie bascule après la première — s (H35) */
    phaseDelayS: 2e-3,
    /** Rotation continue proposée — crans/s */
    spinRate: { min: 1, max: 10 },
    /** Signaux du mikroBUS reliés au codeur (annexe 3 : ENCA → PWM, ENCB → AN, SW → INT) — H35 */
    wiring: { ENCA: 'PWM', ENCB: 'AN', SW: 'INT' },
    /** SW : tirage 10 kΩ vers la masse, 1 = appuyé */
    swActiveLevel: 1,
    hyp: ['H9', 'H35'],
  },
  /** Analyseur logique du banc */
  analyzer: {
    channels: 4,
    /** Bases de temps — s/div (1 µs à 1 s, suite 1-2-5) */
    timebases: [1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1],
    divisions: 10,
    /** Changements conservés par voie (limite du simulateur) */
    maxChanges: 20000,
    /** Pseudo-voies : CPU dans l'ISR, drapeaux d'interruption des timers */
    probes: ['ISR', 'TMR2IF', 'TMR4IF', 'TMR6IF'],
  },
  /** Oscilloscope 2 voies (PRD §3.3) : sondes sur les points de test de la carte fille ou sur une broche */
  scope: {
    channels: 2,
    /** Bases de temps — s/div (200 ns à 1 s, suite 1-2-5) */
    timebases: [2e-7, 5e-7, 1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1],
    divisions: 10,
    verticalDivisions: 8,
    /** Signaux logiques : 0 à VDD (H5), temps de montée et de descente (H40) — V, s */
    vHigh: 3.3,
    riseTime: 20e-9,
    /** Niveau de déclenchement par défaut — V */
    triggerLevel: 1.65,
    /** Points de test de la carte fille GEII (PRD §3.3) */
    testPoints: [
      { tp: 'TP17', signal: 'SCK', pin: 'RB1' },
      { tp: 'TP16', signal: 'MOSI', pin: 'RB3' },
      { tp: 'TP19', signal: 'ENC_A', pin: 'RD1' },
      { tp: 'TP20', signal: 'ENC_B', pin: 'RA2' },
      { tp: 'TP10', signal: 'RGB_R', pin: 'RD4' },
      { tp: 'TP11', signal: 'RGB_G', pin: 'RC0' },
      { tp: 'TP12', signal: 'RGB_B', pin: 'RC1' },
    ],
    hyp: ['H5', 'H40', 'H45'],
  },
  /** TP4 : cahier des charges utilisé par le professeur virtuel (consigne étape 4) */
  tp4: {
    /** §1 : octet 0b00110001, toutes les 100 ms ± 1 %, mode SPI 3 */
    byte: 0x31,
    byteIntervalS: 0.1,
    byteTolerance: 0.01,
    q1Mode: 3,
    /** §1 : période de SCK relevée aux curseurs, comparée à celle de la configuration (± 1 %) */
    sckTolerance: 0.01,
    /** §2 : modes qui conviennent au 74HC595 (lecture au front montant) */
    goodModes: [0, 3],
    /** §3 : appels unitaires de led_ring_display16 */
    displayCases: [0x0001, 0x8000, 0x00ff, 0xa5a5],
    /** §4 : un pas du chenillard — s (± 0,5 %) */
    chaseStepS: 1,
    chaseTolerance: 0.005,
    /** §5 : crans tournés (dont un retour en arrière) */
    encoderDetents: 40,
    encoderBack: 15,
    /** §6 : motif de la première animation */
    animation: 0xf0f0,
    /**
     * §6 : fenêtre d'observation — s simulées. La seconde animation peut démarrer seule (enchaînement) ;
     * sinon le professeur appuie sur S1, puis sur S2 (énoncé : déclenchement non précisé), appui de 300 ms
     */
    animationWindowS: 60,
    animationStimuli: ['S1', 'S2'],
    pressMs: 300,
    source: 'consigne étape 4 (pas de CR du TP4)',
  },
  /** TP3 : cahier des charges utilisé par le professeur virtuel */
  tp3: {
    /** §1 : période du clignotement attendue — s (1 s ± 1 %) */
    blinkPeriodS: 1,
    blinkTolerance: 0.01,
    /** §2 : délai d'anti-rebond (Timer Period) — s (10 ms ± 0,5 %) */
    debounceS: 0.01,
    debounceTolerance: 0.005,
    source: 'consigne étape 3 (CR TP3)',
  },
  /** Machine virtuelle (PRD §4.2 et §5) */
  vm: {
    /** Tranche d'exécution maximale dans le Worker — ms simulées */
    sliceMs: 2,
    /** Tranche d'exécution maximale — opérations */
    sliceOps: 50_000,
    /** Images envoyées par le Worker au plus — par seconde */
    frameRateHz: 30,
    /** Image sans changement visible : affichage rafraîchi au plus toutes les idleRefreshS secondes simulées */
    idleRefreshS: 0.1,
    /** Vitesses de simulation proposées */
    speeds: [0.1, 1, 10],
    /** Opérations au plus pour un pas à pas avant abandon */
    stepMaxOps: 5_000_000,
    /** Budget de calcul réel par tick du Worker — ms */
    tickBudgetMs: 12,
    /** Intervalle entre deux ticks du Worker — ms réelles */
    tickIntervalMs: 10,
    /** Espace de données simulé : SFR sous sfrLimit, variables globales, puis pile des variables locales */
    memory: { size: 0x10000, sfrLimit: 0x1000, globalsBase: 0x2000, stackBase: 0x6000 },
    /** Profondeur de la pile d'évaluation du bytecode (limite du simulateur) */
    operandStackSize: 4096,
    /** Tolérance numérique sur les instants calculés en ticks (périphériques à horloge non entière) */
    tickEpsilon: 1e-6,
    /** Changements de broche gardés dans la trace de la VM du Worker (la PWM en produit ~1 500 par seconde) — limite du simulateur */
    maxPinTrace: 200_000,
    /** Graine par défaut du générateur des rebonds (H3) */
    defaultSeed: 1,
  },
  /** Rebonds des boutons S1 et S2 — H3 */
  button: {
    /** Probabilité qu'une transition rebondisse */
    bounceProbability: 0.3,
    /** Nombre de rebonds (un rebond = un retour bref au niveau précédent) */
    bounceCount: { min: 1, max: 4 },
    /** Durée totale des rebonds — s (0,3 à 3 ms) */
    bounceDuration: { min: 0.3e-3, max: 3e-3 },
    /** Largeur minimale d'un palier de rebond — s (20 µs) */
    minBounceWidth: 20e-6,
    hyp: ['H3'],
  },
  /** Broches d'entrée non pilotées et sans WPU : niveau lu — H20 */
  floatingInputLevel: 0,
  /** Registres spéciaux (PORTA = 0x00C sourcé cours p. 19 ; le reste H18 ; reset hors TRIS/ANSEL/LAT = H19) */
  sfr: /* @__PURE__ */ buildSfrs(),
  /** Inventaire des hypothèses (PRD §3.8, plus celles ajoutées à l'étape 1) */
  hypotheses: [
    { id: 'H1', texte: 'Fosc par défaut = HFINTOSC 4 MHz divisé par 4', commentVerifier: 'System Module au prochain TP', statut: 'réfutée', preuve: 'fichiers MCC TP1 (docs/sources/mplab/tp1/mcc.c) : NOSC HFINTOSC, NDIV 1, HFFRQ 4_MHz → Fosc = 4 MHz' },
    { id: 'H2', texte: 'Une instruction C élémentaire coûte 4 Tcy en moyenne (table de coûts par catégorie d’opération du bytecode)', commentVerifier: 'ordre de grandeur, sans impact sur les réponses' },
    { id: 'H3', texte: '30 % des appuis rebondissent : 1 à 4 rebonds sur 0,3 à 3 ms (palier minimal 20 µs)', commentVerifier: 'oscilloscope sur TP17 et S1 en TP' },
    { id: 'H4', texte: 'Joystick au repos : X = 498, Y = 530 (brut)', commentVerifier: 'relever les valeurs au TP6' },
    { id: 'H5', texte: 'VDD = 3,3 V (cavalier J12)', commentVerifier: 'cavalier J12' },
    { id: 'H6', texte: 'UART 9600 bauds 8N1', commentVerifier: 'réglage MCC au TP5' },
    { id: 'H7', texte: 'Horloge SPI par défaut Fosc/4', commentVerifier: 'réglage MCC au TP4' },
    { id: 'H8', texte: 'Prescaler PWM 1:4', commentVerifier: 'réglage MCC au TP5', statut: 'partielle', preuve: 'Fosc = 4 MHz (fichiers MCC TP1, H1 réfutée) : « environ 4 ms » avec PR2 = 0xFF donne 1:16 (4,096 ms) ; 1:4 ne convient qu’à Fosc = 1 MHz' },
    { id: 'H9', texte: 'Sens horaire = ENCA en avance sur ENCB (d’après le chronogramme du CR TP2)', commentVerifier: 'annexe 4' },
    { id: 'H10', texte: 'LED 1 de l’anneau en haut, numérotation dans le sens horaire', commentVerifier: 'photo de la carte Rotary' },
    { id: 'H11', texte: 'Matrice : DIG0 = colonne de droite, segment DP = ligne du haut ; détail des registres MAX7219 (annexe 6 non exploitée)', commentVerifier: 'annexe 6', statut: 'vérifiée', preuve: 'annexe 5 (schéma 8x8 R click) : DIG7 à gauche … DIG0 à droite, SEGDP en haut puis SEGA … SEGG en bas ; annexe 6, table 6 : D7 = DP … D0 = G' },
    { id: 'H12', texte: 'Sans USB blanc, printf n’affiche rien ; LED RGB alimentée par le 5 V de l’USB noir', commentVerifier: 'TP5' },
    { id: 'H13', texte: 'Débogueur à l’arrêt : temps figé, un appui pendant l’arrêt mémorise un seul flag IOC', commentVerifier: 'TP3 §3' },
    { id: 'H14', texte: 'SPI en mode 1 ou 2 avec le 74HC595 : motif décalé d’un rang. Modèle : dans ces modes MOSI change au front montant où le 74HC595 décale (y compris le premier bit, sans présentation anticipée en mode 2) et le 74HC595 lit le bit précédent', commentVerifier: 'TP4 2 (anneau avec chaque mode)' },
    { id: 'H15', texte: 'Messages d’erreur imitant XC8 (texte approché)', commentVerifier: 'MPLAB X' },
    { id: 'H16', texte: 'Apparence et couleurs de la carte Curiosity et des cartes Click', commentVerifier: 'photos du banc' },
    { id: 'H17', texte: 'Couleur affichée de la LED RGB = rapports cycliques pondérés, sans calibration colorimétrique', commentVerifier: 'TP5' },
    { id: 'H18', texte: 'Adresses SFR (et noms de bits hors PORTx/LATx/TRISx/ANSELx/WPUx/ODCONx) du datasheet DS40001802 non vérifiées ; seule PORTA = 0x00C est sourcée (cours p. 19)', commentVerifier: 'datasheet PIC16F18875 (DS40001802), tableau « Special Function Register Summary »', statut: 'partielle', preuve: 'codage d’OSCCON1 (NOSC<6:4> = 110 HFINTOSC, NDIV<3:0>) et d’OSCFRQ (HFFRQ 010 = 4 MHz) confirmé par mcc.c (OSCCON1 = 0x60, OSCFRQ = 0x02) ; adresses toujours non vérifiées' },
    { id: 'H19', texte: 'Valeurs au reset des SFR autres que TRISx, ANSELx et LATx (WPUx = ODCONx = PIRx = PIEx = 0, INTCON = 0x01, STATUS = 0x18, PCON0 = 0x00, OSCCON1 = 0x62, OSCFRQ = 0x02)', commentVerifier: 'datasheet DS40001802, colonne « Value on POR, BOR »' },
    { id: 'H20', texte: 'Une entrée numérique flottante (non pilotée, sans WPU) est lue à 0', commentVerifier: 'sans objet sur la carte (toutes les entrées utilisées sont tirées) ; oscilloscope sur une broche libre' },
    { id: 'H21', texte: 'Division entière par zéro : quotient 0 et reste = dividende (routine de la bibliothèque XC8 supposée)', commentVerifier: 'programme de test dans MPLAB X, débogueur' },
    { id: 'H23', texte: 'Dans Pin Module, « Analog » est coché par défaut pour une entrée GPIO et décoché pour une sortie', commentVerifier: 'MCC Classic au prochain TP (à vérifier en priorité : c’est ce qui rend possible le piège ANSEL)' },
    { id: 'H24', texte: 'pin_manager.c généré sans les blocs SLRCONx et INLVLx (non couverts par le cours p. 22)', commentVerifier: 'pin_manager.c généré par MCC en salle', statut: 'réfutée', preuve: 'docs/sources/mplab/tp1/pin_manager.c : SLRCONx = 0xFF et INLVLx = 0xFF (0x07 pour E) toujours écrits' },
    { id: 'H25', texte: 'Contenu de device_config.c (bits de configuration #pragma config) : celui du projet TP1 réel ; seul LVP suit la case du System Module', commentVerifier: 'device_config.c d’un projet où d’autres bits seraient modifiés', statut: 'partielle', preuve: 'docs/sources/mplab/tp1/device_config.c (MCC 1.81.7)' },
    { id: 'H26', texte: 'Ordre des registres dans pin_manager.c identique pour tous les projets : LAT E,D,A,B,C ; TRIS E,A,B,C,D ; ANSEL D,C,B,E,A ; WPU D,E,B,A,C ; ODCON E,A,B,C,D ; SLRCON et INLVL A→E', commentVerifier: 'pin_manager.c d’un autre projet MCC (TP2 à TP6)', preuve: 'relevé sur docs/sources/mplab/tp1/pin_manager.c' },
    { id: 'H27', texte: '__XC8_VERSION prédéfini à 2310 (XC8 v2.31 du projet TP1)', commentVerifier: 'version du compilateur des postes de TP (Project Properties)' },
    { id: 'H28', texte: 'Timer2 du TP3 : source LFINTOSC, T2PR = 0x1E, prescaler × postscaler = 1024', commentVerifier: 'capture MCC du TP3 (Timer2)', statut: 'partielle', preuve: 'consigne étape 3 (CR TP3) : T2PR = 0x1E avec FOSC/4 en §1B ; LFINTOSC, 1:128, 1:1, PR2 = 241 en §1C' },
    { id: 'H34', texte: 'Format du code généré pour l’IOC, interrupt_manager et TMR2/4/6 (commentaires, lignes vides, ordre des fonctions) reconstitué d’après MCC 1.81 : seules les lignes citées par la consigne (cours p. 38 à 40, 58, 59, 65) sont garanties', commentVerifier: 'cours p. 38 à 40, 58, 59, 65 ou fichiers générés en TP2 et TP3' },
    { id: 'H30', texte: 'interrupt_manager avec plusieurs sources : les sources de premier niveau (IOC, PIE0) sont testées d’abord, puis « else if(INTCONbits.PEIE == 1) » avec les périphériques dans l’ordre de la table Interrupt Vector ; inverser la table inverse l’ordre dans le fichier', commentVerifier: 'interrupt_manager.c généré en TP3 §2 (TMR2 ordre 1, IOCI ordre 2)' },
    { id: 'H31', texte: 'Monostable « Starts on falling edge on TMR2_ers » : T2HLT = 0x12 (MODE = 10010) ; « any edge » : 0x13 ; adresses de TMR2/4/6 et de T2INPPS, codes CS autres que FOSC/4 et LFINTOSC d’après le datasheet', commentVerifier: 'tmr2.c généré en TP3 §2 ; datasheet DS40001802 « Timer2 Operating Modes »' },
    { id: 'H32', texte: 'Fonctions de tmrX.c (Start/StartTimer, Stop/StopTimer, Counter8BitGet/ReadTimer, Counter8BitSet/WriteTimer, Period8BitSet/LoadPeriodRegister, HasPeriodElapsed sans interruption) reconstituées au format MCC 1.81 ; seuls les noms et rôles sont garantis (ModeSet et ExtResetSourceSet non générés)', commentVerifier: 'tmr2.c / tmr4.c générés en TP3' },
    { id: 'H33', texte: 'Monostable et one-shot : un front sur TMRx_ers pendant le comptage est ignoré ; le timer s’arrête à TMRx = 0 et lève TMRxIF à la première égalité TMRx = PRx (one-shot : TMRxON repasse à 0), puis attend le front suivant', commentVerifier: 'oscilloscope sur RC5 et une LED basculée dans IT_Timer2 (TP3 §2)' },
    { id: 'H35', texte: 'ROTARY O click : ENCA sur PWM, ENCB sur AN, SW sur INT du mikroBUS (mikroBUS 2 : RD1, RA2, RB0) ; entre deux crans la seconde voie bascule 2 ms après la première ; sorties franches, sans rebond', commentVerifier: 'annexe 3 et oscilloscope sur ENCA / ENCB en TP2' },
    { id: 'H36', texte: 'Entrées MR (RST) et RCLK (LATCH) des 74HC595 en l’air (broche du PIC en entrée) : lues à 0, donc registre vidé et anneau éteint tant que RST n’est pas une sortie à 1', commentVerifier: 'annexe 3 (résistances de tirage de la carte Rotary)' },
    { id: 'H37', texte: 'Libellés de l’Easy Setup MSSP1 (Serial Protocol, Mode, SPI Mode, Input Data Sampled at, Clock Source, Clock Divider) et valeurs proposées', commentVerifier: 'capture MCC du TP4' },
    { id: 'H38', texte: 'PPS : adresses RxyPPS (0xF10…) et SSP1CLKPPS/SSP1DATPPS (0xEC5…), codes de sortie SCK1 = 0x14 et SDO1 = 0x15, MSSP1 sur les ports B et C', commentVerifier: 'pin_manager.c généré en TP4 ; datasheet DS40001802, « PPS »' },
    { id: 'H39', texte: 'Format de spi1.c / spi1.h (table spi1_configuration, SPI1_Open, ExchangeByte attend SSP1IF) reconstitué d’après le driver MCC « SPI » ; seuls signatures et rôles (cours p. 74) sont garantis', commentVerifier: 'spi1.c généré en TP4' },
    { id: 'H40', texte: 'Oscilloscope : signaux logiques 0 à 3,3 V, temps de montée et de descente de 20 ns', commentVerifier: 'oscilloscope sur TP16 et TP17 en TP4' },
    { id: 'H29', texte: 'Avec STVREN = OFF, un débordement de pile met STKOVF à 1 sans reset et l’appel se poursuit normalement (la corruption des adresses de retour n’est pas simulée)', commentVerifier: 'datasheet DS40001802, « Stack Overflow/Underflow Reset »' },
    { id: 'H41', texte: 'PWM avec un TMR2 dont la source n’est pas FOSC/4 (contraire au cours p. 85) : le modèle utilise l’horloge réellement choisie, période = (PR2 + 1) × prescaler / Fclk et seuil = rapport cyclique / 4 incréments ; MCC affiche une notification', commentVerifier: 'TMR2 en LFINTOSC avec PWM6 en TP5, oscilloscope sur TP10' },
    { id: 'H42', texte: 'Format de ccp1.c, pwm6.c, pwm7.c et de leurs .h (commentaires, ordre, PWMx_Initialize) reconstitué d’après MCC 1.81 ; corps de PWM1_LoadDutyValue (cours p. 89) et PWMx_LoadDutyValue (cours p. 90) écrits d’après le driver MCC, cours absent du dépôt', commentVerifier: 'cours p. 89 et 90, fichiers générés en TP5', statut: 'partielle', preuve: 'corps de PWM1_LoadDutyValue identique au cours p. 89 (texte fourni par l’utilisateur, étape 6 R4) ; PWMx_LoadDutyValue (p. 90) et le reste du format non vérifiés' },
    { id: 'H43', texte: 'Format de eusart.c / eusart.h (variante sans et avec interruptions, tampons de 8 octets) et des fonctions putch / getch de la redirection STDIO reconstitué d’après MCC 1.81 ; seules la liste et le rôle des fonctions (cours p. 110) sont garantis', commentVerifier: 'eusart.c généré en TP5 (« Redirect STDIO to USART »)' },
    { id: 'H44', texte: 'PPS du TP5 : codes de sortie CCP1 = 0x09, PWM6 = 0x0E, PWM7 = 0x0F, TX = 0x10 ; RXPPS à 0xECB ; adresses de CCP1, CCPTMRS0/1, PWM6/7 et de l’EUSART d’après le datasheet', commentVerifier: 'pin_manager.c généré en TP5 ; datasheet DS40001802, « PPS »' },
    { id: 'H45', texte: 'Points de test de la LED RGB : TP10 = RGB_R (RD4), TP11 = RGB_G (RC0), TP12 = RGB_B (RC1)', commentVerifier: 'sérigraphie de la carte fille GEII (annexe 2)' },
    { id: 'H46', texte: 'TP5 §3 : au-delà de 255, l’incrément de 16 peut revenir à 0 (débordement d’un uint8_t) ou rester bloqué à 255 ; l’énoncé ne tranche pas, les deux sont acceptés', commentVerifier: 'question à l’enseignant' },
    { id: 'H47', texte: 'Terminal : chaque trame est rééchantillonnée au milieu des bits du baud du terminal, à partir du front descendant du start ; un octet mal encadré (stop à 0, parité fausse) est affiché quand même, comme un terminal sans contrôle d’erreur', commentVerifier: 'terminal à 19 200 bauds face à un PIC à 9600 bauds en TP5' },
    { id: 'H48', texte: 'Joystick : la valeur brute de X augmente vers la droite et celle de Y vers le BAS (Joy_Cal_Y doit inverser l’axe) ; butées 0 et 1023', commentVerifier: 'relever les valeurs brutes au TP6 en poussant le joystick en haut' },
    { id: 'H49', texte: 'Libellés de l’Easy Setup ADCC de MCC (Enable ADC, Result Alignment, Positive / Negative Reference, Clock Source, Clock, TAD, Acquisition Count, Enable ADC Interrupt) et format de adcc.c / adcc.h reconstitués d’après MCC 1.81', commentVerifier: 'capture MCC et adcc.c du TP6' },
    { id: 'H50', texte: 'Codes ADPCH des voies : port × 8 + bit (RA0 = 0x00, RD5 = 0x1D, RD6 = 0x1E) ; adresses des registres ADCC d’après le datasheet', commentVerifier: 'adcc.h généré au TP6 (enum adcc_channel_t)' },
    { id: 'H51', texte: 'TAD de l’oscillateur FRC = 2 µs', commentVerifier: 'datasheet DS40001802, « ADC Clock Period (TAD) »' },
    { id: 'H52', texte: 'ADCC simulé en mode de base : échantillonnage au lancement (ADGO = 1), pas de déclenchement automatique (ADACT), de mode continu ni de calcul (filtre, moyenne, seuils)', commentVerifier: 'sans objet au TP6 (conversions lancées par logiciel)' },
    { id: 'H53', texte: 'MAX7219 simulé : DOUT non relié au PIC (le MISO du bus SPI reste à la carte Rotary) ; contenu des registres de digits à la mise sous tension = 0 (annexe 6 muette) ; balayage non simulé (lueur = intensité / nombre de digits balayés)', commentVerifier: 'annexe 6 ; oscilloscope sur DOUT' },
    { id: 'H54', texte: 'Barème du mode examen : chaque question vaut 20 / n points, dont 25 % pour la configuration (Faire vérifier : 100 % au 1er essai, 50 % au 2e, 0 ensuite) et 75 % pour le défi du professeur virtuel ; 2 points retirés par manipulation sous tension ; note plancher 0', commentVerifier: 'barème à confirmer avec l’enseignant' },
    { id: 'H22', texte: 'main() qui retourne, ou appel d’un pointeur de fonction nul : le programme s’arrête (message dans Output) au lieu du saut au vecteur de reset', commentVerifier: 'XC8 User’s Guide, « main function » ; débogueur' },
  ] as const satisfies readonly Info3Hypothese[],
} as const

/** Hypothèse INFO3 par identifiant */
export const info3Hypothese = (id: string): Info3Hypothese | undefined => INFO3.hypotheses.find((h) => h.id === id)
