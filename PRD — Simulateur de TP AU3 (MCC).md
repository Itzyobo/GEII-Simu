# PRD — Simulateur de TP AU3 (MCC)

Nov 11, 2026 · @sidi

## 1. Cadrage

Le simulateur couvre TP1, TP2 et TP4 sur un seul banc virtuel (poste 4, moteur 1, salle B26). Le TP3 est coupé, car il a un autre capteur, une autre mécanique et aucune mesure. Toutes les valeurs du TP4 sont des hypothèses, car ce TP n'a pas encore été fait.

| On garde | Pourquoi |
| --- | --- |
| TP1 : réponse indicielle du MCC en boucle ouverte, identification ordre 1 et ordre 2 (curseurs + abaque) | Mesures réelles disponibles (CR) |
| TP2 : boucle fermée avec régulateur P, K = 3,8 et K = 40 | Mesures réelles disponibles (CR) |
| TP4 partie I : régulateur PI série (R1, R2, C2 sur Z1/Z2), réglage de G1 jusqu'au cahier des charges | Même moteur que TP1/TP2 : le modèle est extrapolé depuis les mesures |
| TP4 partie II, réduite : arrivée d'une bouteille = échelon de couple de charge, sur le moteur du banc ; comparaison P / PI | Couvre les questions sur l'intégrale et le rejet de perturbation |
| GBF TG315, oscilloscope DSOX2004A (curseurs, mesures, moyennage, Stop, export .csv), platine Régulateur analogique | C'est ce qui est noté en manip |
| Identification « moindres carrés » intégrée (remplace main\_ident.m) | Questions Matlab des TP1 et TP2 |
| Câblage par l'étudiant, verrouillage sous tension, « Faire vérifier », mode examen | Demandé |

| On coupe | Raison |
| --- | --- |
| TP3 (antenne, essuie-glace) | Autre capteur (potentiomètre avec angle mort), aucune mesure ; ses attendus sont affichés « non couverts » sur l'accueil |
| TP5 à TP7 | Hors du partiel de la 1re série |
| Câblage libre de type solveur de circuit | Crée des bugs sans rapporter de points : on câble des bornes nommées, contrôlées par une liste de liaisons attendues |
| TP4 II.2 (couleurs des blocs Simulink) et paramètres du moteur de convoyeur | Dépendent de fichiers .slx non fournis |
| Backend, comptes, IA, synchronisation | 100 % front, localStorage |
| Export Word / PDF du CR | Hors périmètre |

Limite assumée : la dérive lente visible en fin de courbe sur les captures (montée lente en TP1, décroissance après le pic à K = 40) n'est pas modélisée. Les TR5% du modèle sont donc 7 à 12 % sous ceux du CR ; l'écart est affiché dans l'application, pas masqué.

## 2. Ce que fait le simulateur, TP par TP

Chaque TP suit l'énoncé dans l'ordre : réglages platine éteinte, câblage, « Faire vérifier », mise sous tension, mesures aux curseurs, questions. Les intitulés des questions sont ceux de docs/enonce.md, mot pour mot.

### TP1 — MCC + dynamo tachymétrique en boucle ouverte

Câblé par l'étudiant : GBF MAIN OUT → entrée ampli de courant ; sortie ampli → borne rouge moteur ; noire → masse ; DT verte → voie 2 ; DT jaune → masse ; GBF → voie 1. Pré-câblé : secteur, alimentation ±12 V de la platine, liaison mécanique moteur–DT.

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| GBF carré 1,3 Hz, 12 Vpp, offset 0 | Voie 1 : créneau ±6,15 V ; voie 2 : m(t) d'amplitude 1,86 V | I.2.1 Q1, Q2 (m(∞), U0, G0) |
| Oscillo DC, trigger front montant voie 1, mode normal, réf. temps à gauche, moyennage 16 | Courbe propre, échelon positif en 1re division | Prérequis de toutes les mesures |
| Curseurs X1/X2, Y1/Y2 sur 0,63·m(∞) puis 0,95·m(∞) | ΔX = τ, puis TR5% | I.2.1 Q3, Q4, G1(p) |
| Curseurs sur 26,4 % et 80,1 % ; abaque interactif t3/t1, ωn·t3 | t1, t3, z, ωn | I.2.2 Q1 à Q4, G2(p) |
| Export .csv puis « Identification moindres carrés » ordre 1, puis ordre 2 | Superposition mesure / modèle, zoom sur le démarrage | I.2.3 Q11, Q12, Q1, Q2, conclusion « ordre le plus probable », « Aurait-on pu le deviner » |

### TP2 — Boucle fermée, régulateur proportionnel

Câblé par l'étudiant : les liaisons 1 à 10 de l'énoncé (consigne, sortie G2 → ampli, ampli → moteur, DT → « Mesure », masses, voies 1 à 4).

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| GBF 2 Hz, 3,2 Vpp ; Affichage G1 = 38, G2 = 10 (K = 3,8) | Mesure sans dépassement, m(∞) ≈ 1,1 V < C0 ≈ 3,26 V ; U (voie 3) max ≈ 8 V ; erreur (voie 4) non nulle | I.1 « ordre de ce système » ; I.1.1 Q1 à Q7, Q10 |
| Calcul théorique à partir des valeurs TP1 de l'étudiant | G0b, zb, ωnb théoriques vs identifiés | I.1.1 Q8, Q9 |
| Identification moindres carrés ordre 2 | zb, ωnb, τ1, τ2 | I.1.2 Q9 à Q12 |
| GBF 0,3 Vpp (atténuation 20 dB) ; G1 = 40, G2 = 100 (K = 40) | Dépassement ≈ 25 %, m(∞) ≈ 0,2 V ; U max ≈ 9,9 V, proche de la saturation à 10,6 V | I.2 « ordre » ; I.2.1 Q1 à Q10, Q12 |
| Identification moindres carrés ordre 2 | Superposition, écarts au démarrage / en régime permanent | I.2.2 Q9 à Q11 ; conclusions 1, 2 et les 3 comparaisons |
| Bouton « Variante » : autre K ou autre amplitude de consigne | Erreur statique dépendant de C0 (frottement sec) ; saturation de U au-delà de ≈ 0,33 Vpp avec K = 40 | Pièges du partiel |

### TP4 — Boucle fermée, régulateur PI série (valeurs non vérifiées)

Câblé par l'étudiant : câblage du TP2, plus R1 = 10 kΩ sur Z1, R2 = 27 kΩ en série avec C2 = 330 nF sur Z2. Une erreur de placement (R2 sur Z1, C2 en parallèle) donne un autre régulateur, simulé comme tel.

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| GBF 4,9 Hz, 0,8 Vpp ; G1 = 0,95, G2 = 10 (K ≈ 25,7, Ti ≈ 8,9 ms) | Erreur statique nulle ; U sature à 10,6 V au démarrage ; D1 ≈ 18 % | I Q1 à Q4, Q6, Q7 |
| Diminuer G1 jusqu'à D1 < 5 % | D1 < 5 % vers G1 ≈ 0,6 ; TR5%b ≈ 8 ms | I Q5, Q6, Q7 |
| Scénario « bouteille » : échelon de couple de charge à t = 0,15 s, consigne 1 V | Creux de vitesse puis retour à l'erreur nulle ; U monte et reste plus haut | II.3 c à f, II.4 b et c (sur le moteur du banc) |
| Régulateur P seul (on retire l'intégrateur) | Erreur statique au démarrage et après la bouteille | II.5 d, e ; conclusions |

## 3. Valeurs de référence

Un seul modèle physique (4 paramètres réels) reproduit les 3 essais du CR à ±3 % sur les gains et ±5 % sur les temps lus aux curseurs. Les valeurs du CR sont des valeurs apparentes : elles sont mesurées avec une formule simplifiée (linéaire, sans frottement). Elles servent de cibles de test, pas de paramètres. Toutes ces valeurs vivent dans src/data/reference.ts.

### 3.1 Valeurs apparentes mesurées (cibles de test)

| Grandeur | Valeur | Source |
| --- | --- | --- |
| TP1 : ΔU (crête-à-crête entrée) | 12,3 V | CR |
| TP1 : Δm(∞) | 1,86 V | CR |
| TP1 : G0 apparent | 0,151 | CR |
| TP1 : τ (à 63 %) | 11,8 ms | CR |
| TP1 : t1 (26,4 %) / t3 (80,1 %) | 5,2 ms / 18 ms | CR |
| TP1 : z / ωn (abaque) | 1,22 / 211,5 rad/s | CR |
| TP1 : TR5% | 33 ms | CR (inclut la dérive lente) |
| TP2 K = 3,8 : C0 / Δm(∞) | 3,26 V / 1,1 V | CR |
| TP2 K = 3,8 : G0b | 0,34 | CR |
| TP2 K = 3,8 : t1 / t3 | 3,5 ms / 10 ms | CR |
| TP2 K = 3,8 : zb / ωnb | 0,90 / 274,3 rad/s | CR |
| TP2 K = 3,8 : TR5%b | 17 ms | CR (inclut la dérive lente) |
| TP2 K = 3,8 : U max (voie 3) | 8,04 V | CR (capture) |
| TP2 K = 40 : C0 / Δm(∞) | 0,295 V / 0,20 V | CR |
| TP2 K = 40 : G0b | 0,69 | CR |
| TP2 K = 40 : D1 / m(∞) | 0,25 | CR |
| TP2 K = 40 : temps de pic Tpb/2 | 5,7 ms | CR |
| TP2 K = 40 : zb / ωnb | 0,42 / 607,3 rad/s | CR |
| TP2 K = 40 : TR5%b | 13,8 ms | CR (m(∞) lu avant stabilisation) |
| TP2 K = 40 : U max (voie 3) | 9,54 V | CR (capture) |
| Valeurs Matlab du CR (TP1 : 0,153 / 12,1 ms et 0,152 / 1,26 / 218,4 ; K = 3,8 : 0,34 / 1,01 / 297,6 ; K = 40 : 0,69 / 0,45 / 591,3) | affichées, non testées | CR — à K = 3,8 elles contredisent les curseurs de 10 % |

### 3.2 Paramètres réels du modèle

| Paramètre | Valeur | Source |
| --- | --- | --- |
| Tension de saturation de la sortie G2 | ±10,6 V | énoncé |
| Gain de l'ampli de courant / courant max | 1 / 1 A | énoncé |
| Courant max sortie G2 | 25 mA | énoncé |
| K du régulateur P | Affichage G1 × G2 / 100 | énoncé |
| PI série : K = (R2/R1) · G1 · G2 ; Ti = R2 · C2 | R1 = 10 kΩ, R2 = 27 kΩ, C2 = 330 nF → Ti = 8,91 ms ; K = 25,65 pour G1 = 0,95, G2 = 10 | énoncé |
| Gain statique réel moteur + DT, G0r | 0,1953 | hypothèse (ajustée sur les 3 Δm du CR) |
| Frottement sec équivalent, Uf | 1,388 V | hypothèse (ajustée sur les 3 Δm du CR) |
| Constantes de temps τa / τb | 9,27 ms / 2,53 ms | hypothèse (ajustées sur t1, t3, τ TP1 ; t1, t3 K = 3,8 ; D1, Tpb/2 K = 40) |
| Bruit de mesure DT | σ = 1 % de Δm | hypothèse |
| Ondulation de commutation DT | 1 % de m, fréquence ∝ vitesse | hypothèse |
| Couple de la bouteille (échelon de tension équivalent) | 0,5 V à t = 0,15 s | hypothèse |

Pourquoi deux gains : G0 apparent = G0r · (ΔU − 2Uf) / ΔU. À 12,3 V, cela donne 0,151 (TP1). Les gains en boucle fermée chutent quand la consigne est petite, ce qui explique G0b = 0,69 au lieu de 0,857 à K = 40.

### 3.3 Valeurs prédites par le modèle (critères de test)

| Essai | Grandeur | Modèle | CR | Écart |
| --- | --- | --- | --- | --- |
| TP1 | Δm / τ / t1 / t3 | 1,860 V / 12,15 ms / 5,22 ms / 17,9 ms | 1,86 / 11,8 / 5,2 / 18 | 0 / +3 / 0 / −1 % |
| TP1 | TR5% | 30,7 ms | 33 ms | −7 % (dérive lente) |
| K = 3,8 | G0b / t1 / t3 / U max | 0,331 / 3,58 ms / 10,2 ms / 8,24 V | 0,34 / 3,5 / 10 / 8,04 | −3 / +2 / +2 / +2,5 % |
| K = 3,8 | zb / ωnb | 0,923 / 272 rad/s | 0,90 / 274 | +2,5 / −1 % |
| K = 3,8 | TR5%b | 15,3 ms | 17 ms | −10 % (dérive lente) |
| K = 40 | G0b / D1 / Tpb/2 / U max | 0,678 / 24,3 % / 5,61 ms / 9,90 V | 0,69 / 25 % / 5,7 / 9,54 | −2 / −3 / −2 / +4 % |
| K = 40 | zb / ωnb | 0,41 / 613 rad/s | 0,42 / 607 | −2 / +1 % |
| K = 40 | TR5%b | 12,2 ms | 13,8 ms | −12 % (m(∞) lu trop tôt) |
| TP4 G1 = 0,95 | erreur statique / D1 / TR5%b / U max | 0 % / 18,5 % / 13,8 ms / 10,6 V (saturé) | — | non vérifié |
| TP4 G1 = 0,6 | D1 / TR5%b | 2,3 % / 8,2 ms | — | non vérifié |

L'énoncé annonce zb ≈ 0,7 avec K = 25,8. Le modèle prédit plutôt un dépassement de 18 %, ce que la question I Q5 (« diminuez G1 ») laisse prévoir. À vérifier au TP4.

### 3.4 Liste des hypothèses (badge « valeur non vérifiée »)

1. Structure du modèle : 2 constantes de temps + frottement sec vu comme une tension Uf qui s'oppose au sens de rotation commandé.
2. G0r = 0,1953 et Uf = 1,388 V, ajustés sur le CR.
3. τa = 9,27 ms et τb = 2,53 ms, ajustés sur le CR.
4. Bruit DT 1 % et ondulation de commutation 1 %.
5. Couple de la bouteille : 0,5 V équivalent, appliqué à t = 0,15 s.
6. Comportement du PI en saturation : l'intégrateur continue d'intégrer (pas d'anti-emballement), comme un AOP réel.
7. Toutes les valeurs du TP4 (aucune mesure).
8. TP2 : erreurs de manip (DT inversée, ampli oublié) simulées avec le même modèle, sans mesure réelle.

## 4. Modèles de simulation

Un seul moteur de simulation temporelle pour les 3 TP : une fonction pure simulate(banc, réglages, câblage, graine) qui renvoie les 4 voies de l'oscilloscope échantillonnées. Elle n'a pas d'état caché. Le bruit vient d'un générateur pseudo-aléatoire à graine fixe, pour que les tests soient reproductibles.

### 4.1 Moteur + dynamo tachymétrique (en volts DT)

```latex
u_{eff}(t) = u(t) - U_f \cdot s(t) - u_{bouteille}(t)
```

```latex
\tau_a \frac{dx_1}{dt} = G_{0r} \, u_{eff} - x_1 \qquad \tau_b \frac{dm}{dt} = x_1 - m
```

s(t) = signe du sens de rotation commandé (signe de la consigne, ou de la tension en boucle ouverte). Si |u| < Uf et que le moteur est à l'arrêt, il ne démarre pas (zone morte). Intégration Euler explicite, pas de 5 µs. Le test vérifie qu'un pas de 2,5 µs change les résultats de moins de 0,5 %.

### 4.2 Régulateurs (platine)

```latex
R_P(p) = K \qquad R_{PI}(p) = K \, \frac{1 + T_i p}{T_i p}
```

Sortie G2 bornée à ±10,6 V. L'intégrateur du PI continue pendant la saturation. Borne « Erreur » = c − m. K et Ti sont calculés depuis les réglages (Affichage G1, G2, composants sur Z1/Z2), jamais saisis.

### 4.3 Réponses attendues calculées, jamais codées en dur

- Mesures « curseur » : appliquées à la courbe simulée sans bruit (Δm, τ, t1, t3, TR5%, D1, Tpb/2).
- Abaque : inversion numérique de t3/t1 sur la réponse d'ordre 2 normalisée, puis ωn = (ωn·t3)/t3.
- Formules théoriques TP2 : G0b = KG0/(1+KG0), zb = z/√(1+KG0), ωnb = ωn√(1+KG0), à partir des valeurs TP1 de l'étudiant ou du modèle.
- « Moindres carrés » : Nelder–Mead sur le .csv exporté (ordre 1 : G0, τ ; ordre 2 : G0, z, ωn), comme main\_ident.m.
- Tolérance de correction d'une réponse étudiant : ±5 % (±10 % pour une lecture d'abaque). Une réponse sans unité ou sans justification est signalée.

### 4.4 Bruit et instruments

- Bruit gaussien σ = 1 % de Δm, plus ondulation de commutation de 1 %. Le moyennage par 16 divise le bruit aléatoire par 4.
- L'oscilloscope quantifie sur 8 bits par calibre : un mauvais calibre dégrade donc vraiment la lecture.
- Les mesures auto (Ampl, Max, Cr-cr) et les curseurs lisent la trace affichée, avec le calibre courant.

### 4.5 Erreurs de manipulation reproduites

| Erreur | Effet simulé |
| --- | --- |
| DT inversée (verte/jaune) en boucle fermée | Réaction positive : le moteur part en butée de vitesse dans un sens, U saturé à ±10,6 V — « tourne tout le temps dans le même sens » |
| Sortie G2 branchée directement au moteur (ampli de courant oublié) | Courant limité à 25 mA : le moteur ne démarre pas, U écrêtée |
| Masse moteur (noire) ou DT (jaune) non reliée | Moteur immobile, ou voie 2 flottante (bruit 50 Hz, valeur moyenne nulle) |
| Consigne sur l'entrée « Mesure » (inversion consigne/mesure) | Signe de l'erreur inversé : divergence |
| GBF avec offset non nul | Paliers décalés, frottement dissymétrique : deux demi-périodes différentes |
| GBF trop fort en K = 40 | Saturation de U : réponse en rampe, D1 et TR5% faux |
| Couplage AC sur une voie | Passe-haut ≈ 3,5 Hz : palier qui retombe, m(∞) faux |
| Calibre vertical trop grand / trop petit | Lecture imprécise (quantification) / courbe écrêtée en haut d'écran |
| Base de temps trop courte | Régime permanent hors écran (règle 70 % / 30 % non respectée), m(∞) lu trop tôt |
| Trigger en mode Auto ou seuil hors du signal | Trace qui défile, pas de mesure possible |
| Bouton Autoscale | Autorisé mais compté comme faute (« NE JAMAIS APPUYER SUR AUTOSCALE ») |
| TP4 : R2 sur Z1, ou C2 en parallèle avec R2 | Autre régulateur calculé depuis les impédances réelles : erreur statique non nulle, ou réponse différente |
| Modifier un câble sous tension | Bloqué, avec message ; pénalité en mode examen |

## 5. Direction visuelle

L'écran est un établi de labo vu de face, de nuit : plan de travail gris anthracite, instruments à l'échelle, lumière douce sur la zone de câblage. Aucun élément décoratif qui ne serve pas à la manip.

- **Disposition, fidèle aux photos du CR** : à gauche, le GBF posé sur l'oscilloscope ; au centre, la platine « Régulateur analogique » (poste 4, cadre bois clair, voyant rouge, bornes rouges / vertes / noires / jaunes) ; à droite, le boîtier « MOTEUR 1 » (capot transparent, bornes rouge/noire à gauche, verte/jaune à droite). Les questions sont dans un panneau rétractable à droite.
- **Oscilloscope DSOX2004A** : écran noir, grille 10 × 8 divisions, voies jaune / vert / bleu / rose, bandeau du haut (V/div par voie, s/div, état Arrêter/Run), colonne de droite (Acquisition, Voies, Curseurs ΔX, 1/ΔX, ΔY, Mesures), touches du bas. Police monospace.
- **GBF TG315** : afficheur de fréquence, boutons de forme enfonçables, molettes amplitude et offset, atténuation 20 dB, sortie MAIN OUT 50 Ω.
- **Platine** : molette « Affichage G1 » (00–99), sélecteur G2, supports Z1/Z2 où l'on dépose R1, R2, C2 (TP4), interrupteur avec voyant.
- **Câbles** : courbes de Bézier souples, couleur choisie par l'étudiant ; une masse non noire est signalée (règle de l'énoncé). Sous tension, les bornes sont grisées et un cadenas s'affiche.
- **Couleurs d'interface** : fond #14161a, panneaux #1e2127, texte #e6e6e6, accent ambre #f5a524 pour les actions. Badge « valeur non vérifiée » en orange, sur toute question qui dépend d'une hypothèse.
- **Ce qui n'est pas visible sur les photos** : la face avant de la platine (sérigraphie, position exacte des bornes Z1/Z2, Erreur, ±12 V) et le câblage du TP1. Le schéma suit l'énoncé et le dessin est marqué « disposition approximative » tant qu'une photo de face n'est pas fournie.

## 6. Livraison en 5 étapes

Stack : Vite + React + TypeScript strict + Tailwind + Recharts + Vitest, 100 % front, état dans localStorage. Chaque étape se termine par un build et des tests sans erreur ni warning, et aucune erreur console dans le navigateur.

| Étape | Livrable | Critères d'acceptation chiffrés |
| --- | --- | --- |
| 1. Socle et instruments | Projet ; reference.ts (toutes les constantes) ; docs/enonce.md (énoncé TP1, TP2, TP3, TP4 mot pour mot) ; moteur de simulation (4.1, 4.2) ; GBF, oscilloscope (calibres, trigger, curseurs, mesures, moyennage, Stop, export .csv), platine ; câblage par bornes nommées, verrouillage sous tension, « Faire vérifier » ; accueil avec les attendus officiels (TP1 : 4, TP2 : 5, TP3 : 4, TP4 : 4) reliés aux questions, lignes non couvertes affichées | Boucle ouverte, créneau 12,3 Vpp 1,3 Hz : Δm = 1,86 V ±3 %. Curseurs : ΔX et ΔY exacts à 1 pixel près, conversion à ±0,5 %. Moyennage 16 : écart-type du bruit divisé par 4 ±10 %. Le pas de 2,5 µs change les sorties de < 0,5 %. Aucun nombre littéral de modèle hors de reference.ts (test par recherche dans le code). Modifier un câble sous tension est refusé. |
| 2. TP1 | Page TP1 : câblage (6 liaisons), réglages, questions I.2.1 à I.2.3 + conclusion, abaque interactif, identification moindres carrés ordre 1 et 2 | G0 = 0,151 ±3 % ; τ = 11,8 ms ±5 % (modèle 12,15) ; t1 = 5,2 ms ±5 % ; t3 = 18 ms ±5 % ; z abaque = 1,22 ±5 % ; ωn abaque = 211,5 rad/s ±5 % ; TR5% du modèle = 30,7 ms ±5 %, affiché avec l'écart connu de −7 % par rapport aux 33 ms du CR ; ajustement ordre 2 sur le .csv sans bruit : retrouve z et ωn du modèle à ±2 % |
| 3. TP2 | Page TP2 : câblage (10 liaisons), K = 3,8 puis K = 40, valeurs théoriques, identification, conclusions ; erreurs de câblage DT inversée et ampli oublié | K = 3,8 : G0b = 0,34 ±3 % ; t1 = 3,5 ms ±5 % ; t3 = 10 ms ±5 % ; zb = 0,90 ±5 % ; ωnb = 274 rad/s ±5 % ; U max = 8,04 V ±5 %. K = 40 : G0b = 0,69 ±3 % ; D1/m(∞) = 0,25 ±10 % ; Tpb/2 = 5,7 ms ±5 % ; zb = 0,42 ±5 % ; ωnb = 607 rad/s ±5 % ; U max = 9,54 V ±5 %. TR5%b du modèle : 15,3 ms et 12,2 ms ±5 %, écarts connus affichés. DT inversée : |
| 4. TP4 | Page TP4 : composants R1/R2/C2 sur Z1/Z2, réglage G1, scénario bouteille, comparaison P / PI ; badge « valeur non vérifiée » sur toutes les questions | Ti calculé = 8,91 ms ±1 % ; K = 25,65 ±1 %. Erreur statique < 0,5 % en fin de demi-période. G1 = 0,95 : U plafonne à 10,6 V, D1 = 18,5 % ±10 %. G1 = 0,6 : D1 < 5 %. Bouteille : erreur statique finale < 0,5 % avec PI, > 5 % avec P seul. R2 et C2 en parallèle : erreur statique > 5 %. |
| 5. Mode examen et finitions | Chrono, sans indices ; notation du câblage (1er essai : tous les points ; 2e : la moitié ; ensuite 0) ; pénalité pour toute manipulation sous tension ; questions non traitées affichées avec leur correction ; session conservée après rechargement ; bilan par attendu officiel | Rechargement en plein examen : chrono, câblage, réponses et nombre d'essais identiques. Barème câblage : 3 cas testés (100 %, 50 %, 0 %). Une tentative sous tension enlève exactement la pénalité définie dans reference.ts. Aucun indice ni badge de correction visible avant la fin. Score total recalculé identique après rechargement. |
