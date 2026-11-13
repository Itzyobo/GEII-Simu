/**
 * Conversions d'unités : définitions, pas des valeurs de l'énoncé, du CR ou du modèle.
 * Fichier en liste blanche du test des constantes (src/au3/regles.test.ts).
 */

/** Millisecondes par seconde (horodatages Date.now) */
export const MS_PAR_SECONDE = 1000

/** Facteur d'amplitude d'une atténuation de `db` décibels en tension : 10^(−dB/20) (20 dB → 0,1) */
export const facteurDecibel = (db: number) => 10 ** (-db / 20)
