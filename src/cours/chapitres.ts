import { lazy } from 'react'

/** Chapitres du cours ENER3, dans l'ordre du diaporama (docs/Énergie - Cours.pdf). */
export const CHAPITRES = [
  {
    slug: 'circuits-magnetiques',
    titre: 'Circuits magnétiques',
    resume: 'Théorème d’Ampère, B(H) et saturation, réluctance et entrefer, loi de Faraday.',
    Page: lazy(() => import('./chapitres/Magnetisme')),
  },
  {
    slug: 'alimentations-decoupage',
    titre: 'Alimentations à découpage',
    resume: 'Linéaire contre découpage, flyback : magnétisation, démagnétisation partielle ou totale.',
    Page: lazy(() => import('./chapitres/Decoupage')),
  },
  {
    slug: 'moteurs-pas-a-pas',
    titre: 'Moteurs pas à pas',
    resume: 'Aimant, réluctance variable, hybride. Pas entier, demi-pas, pont en H, couple et vitesse.',
    Page: lazy(() => import('./chapitres/PasAPas')),
  },
  {
    slug: 'champ-tournant',
    titre: 'Champ tournant',
    resume: 'Trois bobines à 120°, trois courants déphasés : un champ qui tourne à 60·f/p.',
    Page: lazy(() => import('./chapitres/ChampTournant')),
  },
  {
    slug: 'machine-synchrone',
    titre: 'Machine synchrone',
    resume: 'Rotor accroché au champ, angle de charge, décrochage, alternateur et démarrage.',
    Page: lazy(() => import('./chapitres/Synchrone')),
  },
  {
    slug: 'machine-asynchrone',
    titre: 'Machine asynchrone',
    resume: 'Glissement, courbe couple-vitesse, point de fonctionnement, couplage, bilan de puissance.',
    Page: lazy(() => import('./chapitres/Asynchrone')),
  },
  {
    slug: 'variation-de-vitesse',
    titre: 'Onduleurs et variation de vitesse',
    resume: 'Pleine onde contre MLI, structure d’un variateur, loi V/f constant, compensation du glissement.',
    Page: lazy(() => import('./chapitres/Variation')),
  },
] as const

export type Chapitre = (typeof CHAPITRES)[number]
