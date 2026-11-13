# Module AU3 — simulateur MCC + dynamo tachymétrique

Simulateur des TP d'automatique AU3 (IUT GEII) : moteur à courant continu et dynamo tachymétrique, GBF TTi TG315, oscilloscope Keysight DSOX2004A, platine « Régulateur analogique » (poste 4, moteur 1, salle B26). Le PRD (`PRD — Simulateur de TP AU3 (MCC).md`) fait foi ; l'énoncé est copié mot pour mot dans `docs/au3/enonce.md` ; le suivi est dans `docs/au3/STATUS.md`.

## Lancer le module

```sh
npm install
npm run dev        # puis ouvrir /au3
npm test           # tests (dont AU3 : src/au3/**/*.test.ts)
npm run test:perf  # performance de simulate()
npm run build
```

Pages : `/au3` (accueil et attendus officiels), `/au3/libre` (banc libre), `/au3/tp1`, `/au3/tp2`, `/au3/tp4`, `/au3/examen` (mode examen). Le TP3 n'est pas couvert (autre capteur, aucune mesure), ni le II.2 du TP4 (fichiers Simulink non fournis).

## Ce qui fait foi

- Toutes les constantes sont dans `src/data/reference.au3.ts`, avec leur source : `CR` (compte rendu des mesures), `enonce` ou `hypothese`. Aucun nombre de modèle ailleurs (test `src/au3/regles.test.ts`).
- Les réponses attendues sont calculées par le modèle (`src/au3/examen/catalogue.ts`), jamais écrites en dur.
- Une question affiche « valeur non vérifiée » si sa réponse dépend d'une hypothèse et n'est validée par aucun test contre une valeur du CR dans sa tolérance.

## Écarts connus au CR

Le modèle ne reproduit pas la dérive lente visible en fin de courbe sur les captures : les TR5% du modèle sont sous ceux du CR, et l'écart est affiché dans l'application avec le badge.

| Essai | TR5% modèle | CR | Écart |
| --- | --- | --- | --- |
| TP1, boucle ouverte | 30,7 ms | 33 ms | −7 % |
| TP2, K = 3,8 | 15,3 ms | 17 ms | −10 % |
| TP2, K = 40 | 12,3 ms | 13,8 ms | −11 % (m(∞) lu avant stabilisation dans le CR) |

## TP4 : aucune mesure réelle

Le TP4 n'a pas été réalisé : toutes ses valeurs sont prédites par le modèle calé sur TP1/TP2 et portent le badge « valeur non vérifiée ». La partie II est simulée sur le moteur du banc, pas sur celui du convoyeur de l'énoncé.

## Hypothèses (liste générée depuis reference.au3.ts)

Ne pas modifier à la main : `AU3_ECRIRE_README=1 npx vitest run src/au3/examen/readme.test.ts` régénère cette section, et le test échoue si elle n'est plus à jour.

<!-- hypotheses:debut -->
- `AFFICHAGE_G1_MAX` = 99 — Affichage G1 à 2 chiffres supposé (00 à 99) : l’énoncé n’en cite que des valeurs (38, 40, 70, 95)
- `G2_X1` = 1 — Position ×1 du sélecteur G2 supposée : l’énoncé ne cite que 10 et 100
- `OSC_DIV_X` = 10 div — Divisions horizontales du DSOX2004A (non données par l’énoncé)
- `OSC_DIV_Y` = 8 div — Divisions verticales : plage de quantification (non données par l’énoncé)
- `OSC_POINTS` = 2000 points — Points d’un enregistrement .csv
- `TOL_MESURE` = 0.05 — PRD §4.3 : tolérance d’une mesure de l’étudiant (±5 %)
- `TOL_ABAQUE` = 0.1 — PRD §4.3 : tolérance d’une lecture d’abaque (±10 %)
- `ITERATIONS_DICHOTOMIE` = 60 — Inversion numérique de l’abaque (précision 2⁻⁶⁰ de l’intervalle)
- `IDENT_ITER_MAX` = 4000 — Nelder–Mead : itérations maximales par passe
- `IDENT_TOL` = 1e-12 — Nelder–Mead : arrêt quand l’écart relatif du critère sur le simplexe passe sous ce seuil
- `IDENT_PAS_INITIAL` = 0.2 — Nelder–Mead : taille du simplexe initial (paramètres en logarithme)
- `IDENT_PASSES` = 3 — Nelder–Mead relancé depuis le meilleur point (évite un simplexe dégénéré)
- `SUPERPOSITION_MAX` = 0.01 — Modèle « superposé » à la mesure si moins de 1 % de la variance de la mesure reste inexpliquée
- `RAPPORT_NEGLIGEABLE` = 5 — TP2 I.1.2 Q12 : une constante de temps est négligeable si τmax/τmin ≥ 5 (règle usuelle, non donnée par l’énoncé)
- `TANGENTE_FENETRE` = 0.05 — Pente de la mesure au démarrage : régression sur t ≤ 5 % de τ
- `DUREE_EXAMEN_MANIP` = 2700 s — 45 min : le partiel partage 1 h 15 avec un QCM
- `POINTS_QUESTION` = 1 point — Barème : chaque question notée sur 1 point, partagé entre ses champs
- `POINTS_CABLAGE` = 4 points — Barème : câblage d’un TP ; 1er « Faire vérifier » réussi = 100 %
- `COEF_DEUXIEME_ESSAI` = 0.5 — Barème : câblage réussi au 2e essai = 50 %, ensuite 0
- `POINTS_PAR_CHAMP` = 1 part — Une question vaut POINTS_QUESTION, partagé à parts égales entre ses n champs : un champ juste rapporte POINTS_QUESTION/n, incomplet COEF_INCOMPLET × POINTS_QUESTION/n, faux ou vide 0
- `COEF_INCOMPLET` = 0.5 — Barème : réponse juste mais sans unité ou sans justification
- `PENALITE_SOUS_TENSION` = 0.5 point — Barème : par tentative refusée de manipulation sous tension (câble ou composant)
- `PENALITE_AUTOSCALE` = 0.25 point — Barème : par appui sur Autoscale (« NE JAMAIS APPUYER SUR AUTOSCALE »)
- `INCIDENT_UN_SUR` = 3 — Examen : incident « ampli bloqué » tiré 1 fois sur 3 par la graine
- `TP4_ERREUR_MAX` = 0.005 — « Sans erreur statique » (énoncé) mesuré à 0,5 % près (PRD §6, étape 4)
- `TP4_II_DUREE` = 0.3 s — II : durée simulée (démarrage, puis bouteille à 0,15 s)
- `G0R` = 0.1953 — H2 : gain statique réel moteur + DT, ajusté sur les 3 Δm du CR
- `UF` = 1.388 V — H1/H2 : frottement sec vu comme une tension opposée au sens commandé
- `TAU_A` = 0.00927 s — H3 : constante de temps lente
- `TAU_B` = 0.00253 s — H3 : constante de temps rapide
- `BRUIT_DT` = 0.01 — H4 : σ du bruit gaussien de la DT, relatif à Δm
- `ONDULATION_DT` = 0.01 — H4 : ondulation de commutation, relative à m
- `ONDULATION_HZ_PAR_V` = 200 Hz/V — H4 : fréquence de l’ondulation proportionnelle à la vitesse (valeur inventée)
- `BOUTEILLE` = 0.5 V — H5 : couple de la bouteille, échelon de tension équivalent
- `COUPURE_AC_OSCILLO` = 3.5 Hz — Couplage AC : passe-haut du 1er ordre
- `PAS_EULER` = 0.000005 s — Pas d’intégration Euler explicite
- `QUANTIF_OSCILLO_BITS` = 8 bit — Quantification sur la plage affichée (8 divisions)
- `R_INDUIT` = 12 Ω — Résistance vue par la source qui alimente le moteur ; avec 25 mA (G2) le moteur reçoit 0.3 V < Uf : il ne démarre pas
- `SECTEUR_HZ` = 50 Hz — Voie flottante : bruit 50 Hz de valeur moyenne nulle
- `FLOTTANT_AMPLITUDE` = 0.2 V — Amplitude crête du 50 Hz capté par une entrée en l’air
- `GBF_VPP_MAX` = 20 V — Amplitude maximale du TG315 (non donnée par l’énoncé)
- `GBF_OFFSET_MAX` = 10 V — Offset maximal du TG315 (non donné par l’énoncé)
- `GBF_FREQ_MIN` = 0.1 Hz
- `GBF_FREQ_MAX` = 100 Hz — Bornée pour le simulateur : « quelques Hertz maximum » en B26
- `GBF_DISSYMETRIE` = 0.2 — TP1 p. 6 : carré « pas symétrique » quand la platine est éteinte ; palier bas réduit de 20 % (valeur inventée)
- `AMPLI_BLOQUE` = 1 — TP1 p. 6, remarque : ampli de courant bloqué, sortie collée à +USAT ou 0 V quelle que soit l’entrée ; seule la procédure de l’énoncé le débloque
- `VITESSE_ARRET` = 0.01 — Animation : moteur dessiné à l’arrêt sous 1 % de la pleine échelle G0r·USAT
- `PERIODES_CHAUFFE` = 1 période — Périodes du GBF simulées avant la recherche du déclenchement (régime périodique établi)
<!-- hypotheses:fin -->
