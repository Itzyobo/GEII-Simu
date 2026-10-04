/** Les 3 TP du simulateur (accueil + routes). */
export const TPS = [
  {
    slug: 'pas-a-pas',
    title: 'Moteur pas à pas',
    summary: 'Horloge 10 Hz–10 kHz, pas entier / demi / quart, sens DIR. Courants I_A, I_B à l’oscillo, rotor animé.',
    questions: 'Q4 à Q12',
  },
  {
    slug: 'alim-decoupage',
    title: 'Alim à découpage',
    summary: 'Transformateur d’impulsions (saturation, D2, filtrage) puis flyback 150 kHz : rendement face à une alim linéaire.',
    questions: 'Q1–Q6 et Q1–Q5',
  },
  {
    slug: 'machine-asynchrone',
    title: 'Machine asynchrone',
    summary: 'Couplage étoile / triangle, couple 0–10 N·m, réseau ou variateur 15–50 Hz. Wattmètre P, Q, S et courbes.',
    questions: 'Q1 à Q8',
  },
] as const

export type Tp = (typeof TPS)[number]
