# PRD — TP-Sim, simulateur de TP ENER3

Oct 4, 2026 · @Youssef

## Cadrage

TP-Sim est un site React, une page par TP, livré en 5 étapes courtes. Les valeurs simulées sont calées sur tes comptes rendus pour rester cohérentes.

**On garde** : les réglages (GBF, switches, couplage, couple, fréquence variateur), un oscilloscope 2 voies crédible, les appareils de mesure, la saisie des relevés avec correction, et un câblage simplifié.

**On coupe** : le câblage libre à la souris, le solveur de circuit, le Web Worker, les comptes utilisateurs, la correction par IA. Ces éléments créent l'essentiel des bugs pour peu de gain en révision.

**Principe de cohérence** : pas de physique « inventée ». Chaque TP a un modèle analytique court (formules du cours) ou une interpolation du tableau de mesures réelles, avec 1 à 2 % de bruit. Toutes les constantes vivent dans un seul fichier `reference.ts`.

**Stack** : Vite + React + TypeScript + Tailwind, Recharts pour les courbes, Vitest pour valider les modèles. Application 100 % front, sans backend ni compte, historique en localStorage.

## Ce que fait le simulateur

Chaque page TP a la même structure : schéma de la platine à gauche, instruments à droite, liste des questions de l'énoncé en bas avec une case de réponse corrigée à ±5 %.

**Câblage simplifié (commun aux 3 TP).** Le schéma SVG affiche 6 à 10 bornes. On clique une borne puis une autre pour poser un fil, le bouton « Faire vérifier » compare aux connexions attendues. Tant que ce n'est pas validé, l'interrupteur de mise sous tension reste grisé. Une modification sous tension coupe tout et affiche un avertissement.

| TP | Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- | --- |
| Moteur pas à pas | Fréquence horloge 10 Hz–10 kHz, mode pas entier / demi / 1/4 (S1–S3), sens DIR | Oscillo : horloge, I\_A, I\_B, tension phase ; moteur animé qui tourne, compte-tours | Q4 à Q12 de l'énoncé |
| Alim à découpage, partie 1 | Fréquence et largeur d'impulsion, ajout de D2 puis du condensateur | Oscillo : i1 (shunt 1 Ω), v1, v2, vs ; saturation visible | Q1 à Q6 |
| Alim à découpage, partie 2 | Tension d'entrée, courant de charge (rhéostat) | Voltmètres et ampèremètres entrée/sortie, oscillo V1/V2 à 150 kHz | Q1 à Q5 |
| Machine asynchrone | Couplage étoile/triangle, couple de charge 0–10 N·m, réseau ou variateur 15–50 Hz | Wattmètre (P, Q, S), Is, V, vitesse, tension couple 0,3 V/N·m, courbes tracées depuis tes relevés | Q1 à Q8 |

**Mode examen.** Un bouton par TP lance un chrono de 30 min, masque les indices et donne une note sur 20 à la fin, avec la liste des réponses fausses.

## Valeurs de référence

Ces constantes vont dans `src/data/reference.ts` dès l'étape 1 et ne doivent jamais être redéfinies ailleurs. Les lignes marquées « hypothèse » ne viennent pas des CR : vérifie-les ou remplace-les avant de développer.

**Alim à découpage**

| Grandeur | Valeur | Source |
| --- | --- | --- |
| E, shunt | 5 V, 1 Ω | Énoncé |
| Lm | 22 mH | CR |
| Vz (zener) | 15,8 V | CR |
| Aire d'impulsion avant saturation | ≈ 880 V·µs mesurée, 1100 V·µs constructeur | CR, énoncé |
| Courant au début de la saturation | ≈ 86 mA | CR |
| Charge Rs, condensateur C | 330 Ω, 10 µF | Énoncé |
| Flyback : Ve, Vs, f découpage | 18–36 V (30 V par défaut), 5 V, 150 kHz | Datasheet, CR |
| Flyback : rendement | 80 % à 0,5 W de sortie, 87 % à 1,3 W, ≈ 89 % à 2,5 W | CR, plafonné au réaliste |
| Alim linéaire équivalente | η = Vs/Ve = 17 % à 30 V | CR |

**Moteur pas à pas**

| Grandeur | Valeur | Source |
| --- | --- | --- |
| Pas par tour | 200 / 400 / 800 | Énoncé |
| Vitesse | N = 60·f / Np (20 Hz pas entier → 6 tr/min ; 180 Hz demi-pas → 27 tr/min) | Énoncé |
| Alimentation, consigne courant | 15 V, 1 A avec hystérésis de 0,1 A | Énoncé |
| Inductance phase | 9,7 mH | CR |
| Résistance phase | 1,5 Ω | Hypothèse |
| Freq2 (passage en mode tension) | ≈ 1400 Hz en pas entier, à obtenir par calage de la f.c.é.m. | CR |
| Décrochage | au-delà de ≈ 2,5 kHz | Hypothèse |
| Périodes d'horloge par période de courant | 4 / 8 / 16 | Cours |
| Déphasage I\_A / I\_B | T/4, signe inversé avec DIR | CR |

**Machine asynchrone (couplage triangle, 400 V, 50 Hz)**

Le modèle interpole ce tableau en fonction du couple, puis ajoute le bruit. Valeurs relues sur ton CR, à corriger si une lecture est fausse.

| Couple (N·m) | N (tr/min) | Is (A) | V (V) | Pa (W) | Qa (var) |
| --- | --- | --- | --- | --- | --- |
| 0 | 1497 | 1,8 | 240 | 199 | 1270 |
| 2,5 | 1483 | 1,9 | 238 | 594 | 1256 |
| 5 | 1467 | 2,4 | 239 | 1060 | 1373 |
| 7,5 | 1452 | 2,9 | 236 | 1538 | 1390 |
| 10 | 1436 | 3,6 | 238 | 2027 | 1489 |

Autres constantes : plaque 400/690 V, 3,4/1,97 A, 1,5 kW, 1440 tr/min, cos φ 0,77, p = 2. Rs = 12 Ω à chaud. Étoile sur 400 V à vide : P0 = 49,8 W, I0 = 0,5 A. Capteur de couple 0,3 V/N·m, limite 3 V. Variateur : N ≈ 30·f à vide, U fondamental ≈ 8,1 V/Hz × f (121,8 V à 15 Hz, 302 V à 35 Hz, 409,6 V à 50 Hz).

## Direction visuelle

Objectif : un « établi de labo » sombre et sobre, où les instruments ressemblent à de vrais appareils sans être des copies.

- **Fond** gris anthracite, cartes légèrement plus claires, coins arrondis de 12 px, une seule couleur d'accent (ambre, rappel des alims de labo).
- **Oscilloscope** sur un écran noir avec quadrillage 10 × 8 divisions, CH1 jaune et CH2 cyan comme sur le Tektronix du labo, et des mesures auto en bas d'écran. Les boutons sont de vrais boutons rotatifs (molette souris ou glisser).
- **Multimètre et wattmètre** à afficheur 7 segments vert sur fond sombre.
- **Schéma de platine** en SVG fil fin, bornes rondes colorées (rouge, noir, bleu, jaune, marron), fil posé = courbe de Bézier de la couleur de la borne de départ.
- **Moteurs animés** : rotor du pas à pas qui tourne réellement à la vitesse calculée, cadran de vitesse pour la machine asynchrone.
- **Typo** : Inter pour l'interface, JetBrains Mono pour les valeurs mesurées.

## Modèles de simulation

Chaque modèle est une fonction pure dans `src/models/`, testée seule, sans dépendance à React.

- **Pas à pas.** Séquence des consignes de courant selon le mode (4, 8 ou 16 états). Courant phase intégré avec L·di/dt = V − R·i − e, V = ±15 V, régulation par hystérésis 1 A / 0,9 A. La f.c.é.m. e, proportionnelle à la vitesse, est calée pour que le mode tension apparaisse vers 1400 Hz. DIR inverse le signe du déphasage ±T/4. Décrochage au-delà du seuil de référence.
- **Transfo d'impulsions.** Montée i1 = E·t/Lm, descente i1 = I1max − Vz·t/Lm jusqu'à zéro (égalité des surfaces). Quand l'aire E·t dépasse le seuil, Lm est divisée par 20 et le courant s'emballe. Sortie : redressement par D2, puis filtrage RC dont l'ondulation baisse quand f augmente.
- **Flyback.** Modèle moyen : Vs = 5 V, Is fixé par le rhéostat (0,05 à 0,5 A), rendement interpolé, Ie = Vs·Is / (η·Ve). Formes d'onde V1, V2 à 150 kHz reconstruites avec bruit de commutation. Comparaison avec l'alim linéaire (η = Vs/Ve).
- **Machine asynchrone.** Interpolation linéaire du tableau de référence selon le couple, puis calcul de S, cos φ, g, Ω, Pu et η. En étoile sur 400 V, couple limité à 3 N·m avec alerte de sous-tension. Au-delà de 3 V au capteur ou de 3,4 A, alerte et coupure. Variateur : N ≈ 30·f moins le glissement, U fondamental selon la loi U/f ; lecture RMS faussée de +15 % hors mode harmonique du wattmètre. Rs mesurable à l'ohmmètre seulement hors tension.
- **Bruit.** ±1 à 2 % sur toutes les lectures, pour qu'aucune séance ne donne des valeurs identiques.

## Livraison en 5 étapes

Une étape n'est terminée que si tous ses critères sont vérifiés à l'écran et par les tests automatiques.

| Étape | Livrable | Critères d'acceptation |
| --- | --- | --- |
| 1. Socle | Navigation 3 pages, thème, `reference.ts`, oscilloscope, boutons rotatifs, afficheurs, câblage par clic, cartes de questions | Oscillo stable sur un signal test avec trigger ; câblage faux refusé ; mise sous tension grisée tant que non vérifié |
| 2. Pas à pas | Page complète, questions Q4 à Q12 | 20 Hz pas entier = 6 tr/min ; 180 Hz demi-pas = 27 tr/min ; paliers ±1 A à 200 Hz ; courant triangulaire vers 1400 Hz ; 4/8/16 périodes d'horloge ; L retrouvée entre 9 et 10,5 mH |
| 3. Alim à découpage | 2 onglets (transfo, flyback), questions Q1–Q6 et Q1–Q5 | I1max ≈ 22,7 mA à 100 µs ; t2 − t1 ≈ 32 µs ; saturation au-delà de ≈ 176 µs à 5 V ; η entre 80 et 89 % ; linéaire = 17 % |
| 4. Machine asynchrone | Page complète, tableau de relevés, courbes, séparation des pertes | Cu nominal 9,95 N·m ; 1436 tr/min et 3,6 A à 10 N·m ; g ≈ 4,3 % ; η ≈ 74 % ; U/f ≈ 8 V/Hz ; alerte en étoile sur 400 V ; α ≈ 1,115·10⁻³ W/V² |
| 5. Examen et finitions | Mode examen chronométré, accueil avec progression, affichage iPad paysage | Note sur 20 en fin d'examen ; build et tests sans erreur ; aucune erreur dans la console |
