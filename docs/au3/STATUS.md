# AU3 — suivi

## Étape 1 — socle et instruments (terminée)

**Fait**
- `docs/au3/enonce.md` : énoncé p. 1–34 (méthodes de travail, fiches GBF et oscilloscope, TP1 à TP4) extrait avec `pdftotext -layout`, mise en page seule ; formules en LaTeX ; 82 ancres (questions, câblages, attendus) ; figures notées `[illisible : figure p. N]`. Source : `docs/au3/source/Automatisme_-_TP.pdf`.
- `src/data/reference.au3.ts` (réexporté par `reference.ts`) : objet `AU3` (énoncé, hypothèses, cibles CR du PRD §3.1 avec tolérances `tol`), `AU3_INSTRUMENTS` (calibres, géométrie écran, couleurs).
- Moteur `src/au3/sim/` : `simulate()` pur (PRD §4.1, §4.2), câblage = graphe de bornes nommées, topologie déduite (boucle ouverte, fermée, défaut), défauts : masse moteur absente, DT flottante, ampli oublié (25 mA), DT inversée, court-circuit. PI série via Z1/Z2 (R1 / R2 + C2).
- Instruments `src/au3/instruments/` : GBF (continu, carré, triangle, offset, −20 dB) ; oscilloscope (4 voies, DC/AC, s/div, déclenchement Normal/Auto, référence à gauche, Run/Stop, moyennage 1/4/8/16, curseurs + « suivre signal », Ampl/Max/Min/Cr-cr, .csv DSOX, quantification 8 bits, écrêtage, Autoscale journalisé).
- Établi `/au3/libre` : câbles Bézier colorés, alerte masse non noire, verrouillage sous tension journalisé, « Faire vérifier » obligatoire, préréglage TP1 (6 liaisons). Accueil `/au3` : 17 attendus officiels, TP3 « non couvert ». Pages `/au3/tp1`, `/au3/tp2`, `/au3/tp4` : catalogue « à venir ».
- Schéma de session localStorage versionné (`src/au3/session.ts`) prêt pour le mode examen.

**Contrôle du modèle (sans bruit)** : TP1 Δm = 1,860 V, t1 = 5,21 ms, t3 = 17,9 ms, τ = 12,09 ms ; K = 3,8 : G0b = 0,331, U max = 8,24 V ; K = 40 : G0b = 0,678, D1 = 24,4 %, U max = 9,90 V (PRD §3.3).

**Vérifications** : `npm run build` OK ; `npm test` 642/642 (AU3 : 38) ; `npx oxlint` 0 warning dans AU3 (26 préexistants ENER3/INFO3) ; `npm run check:375` 40 routes OK ; `npm run check:size` budgets respectés ; parcours navigateur (Playwright) : câblage TP1 → vérifier 6/6 → marche → 4 traces, manip sous tension refusée, curseurs, Stop, .csv, aucune erreur console.

**Reste (étape 2)** : page TP1 (questions I.2.1 à I.2.3, abaque, moindres carrés), réponses calculées depuis le modèle.

## Étape 2 — TP1 (terminée)

**PRD** : §4.5 (exception de verrouillage, ampli bloqué) et §3.4 (règle du badge) déjà appliqués mot pour mot dans le fichier.

**Corrections de l'étape 1**
1. Exception au verrouillage : ampli bloqué (variante enseignant, `AMPLI_BLOQUE`), sortie collée à +USAT ou 0 V ; seule la procédure de l'énoncé le débloque (éteindre, entrée ampli à la masse, rallumer, masse → GBF sous tension). Le déplacement masse → GBF MAIN OUT sous tension est accepté sans événement ; toute autre manipulation reste refusée et journalisée. Rallumer pendant la procédure ne redemande pas « Faire vérifier ».
2. Dissymétrie du GBF relié à la platine éteinte : palier bas −20 % (`GBF_DISSYMETRIE`).
3. Animation du moteur = vitesse simulée (`vitesseAffichee`), arrêt sous 1 % de G0r·USAT.
4. `RefListe` + `AU3_LISTES` (calibres V/div et s/div, moyennages, avec source) ; divisions et points en `RefEntry` (`OSC_*`) ; pixels, couleurs, pas des boutons dans `src/au3/miseEnPage.ts` (liste blanche du test des constantes).
5. Strict TS : un `liste[0]` dans `src/au3` fait échouer `npm run build` (TS2322) alors que `tsconfig.app.json` seul l'accepte.
6. Câbles : contournent l'écran et le panneau de commandes de l'oscilloscope (`data-exclusion`) ; sans route possible, ils passent dessous.
7. Performance : `simulate()` 1,54 s au pas de 5 µs (bruit, 2 passes) en 41 à 51 ms (Node, `npm run test:perf`) ; navigateur, 100 ms/div, moyennage 16 : 31 à 38 ms par image (médiane), max 46 ms.

**Page `/au3/tp1`** : questions dans l'ordre de l'énoncé, panneau rétractable à droite (sous l'établi à 375 px), progression dans la session (version 2, clé `au3.session.libre.tp1`). Réponses attendues calculées : algorithme de curseur sur la courbe du modèle sans bruit (`src/au3/tp1/attendus.ts`), abaque calculé (`abaque.ts`), moindres carrés Nelder–Mead (`identification.ts`), correction ±5 % / ±10 %, unité manquante = « incomplète » (`correction.ts`).

**Modèle / CR (12,3 Vpp, 1,3 Hz, sans bruit)** : G0 0,1512 / 0,151 ; τ 12,15 ms / 11,8 ms (+2,9 %) ; t1 5,22 / 5,2 ms ; t3 17,91 / 18 ms ; z 1,217 / 1,22 ; ωn 206,2 / 211,5 rad/s (−2,5 %) ; TR5% 30,7 / 33 ms (−7 %, badge).

**Vérifications** : `npm run build` OK ; `tsc -b` OK ; `npm test` 662/662 (AU3 : 58) ; `npm run test:perf` OK ; oxlint 0 warning dans AU3 ; `check:375` 40 routes ; `check:size` OK ; parcours Playwright complet sans message console. Captures : `docs/au3/captures/`.

**Reste (étape 3)** : page TP2 (10 liaisons, K = 3,8 et K = 40, valeurs théoriques, identification, DT inversée, ampli oublié).

## Étape 3 — TP2 (terminée)

**Corrections de l'étape 2**
1. Rallumage sans « Faire vérifier » : seulement si l'ampli est bloqué et que la seule différence avec la dernière vérification RÉUSSIE est « entrée ampli ↔ masse » à la place de « entrée ampli ↔ source » (`procedureExacte`, `verifieReussiSur`). Le rebranchement sous tension doit rétablir exactement le câblage vérifié (GBF au TP1, sortie G2 au TP2).
2. Badge retiré de I.2.3 Q2 (ordre 2), gardé sur Q12 (ordre 1).
3. Sessions : migrations explicites v1 → v2 → v3 (`MIGRATIONS`, `SESSION_VERSION` = migrations + 1).
4. `npm run test:perf` dans les vérifications.

**Page `/au3/tp2`** : réglages K = 3,8 puis K = 40 (K calculé, jamais saisi), câblage 1 à 6 et 8 à 10, consigne → voie 1 pré-câblée (aucune liaison de l'énoncé), contrôles voie 3 à 5 V/div et masses noires, procédure de déblocage réutilisée, questions I.1 à I.2.2 et conclusions, abaque et moindres carrés réutilisés (`src/au3/tp2/attendus.ts`), formules du dépassement à K = 40 (abaque refusé : « la formule est plus précise »), valeurs théoriques Q8 depuis les réponses TP1 de l'étudiant, Q12 selon le zb du fit, variantes DT inversée / ampli oublié / GBF trop fort / K = 40 sans changer les calibres (câblage réel).

**Modèle / CR (sans bruit)** : K = 3,8 : G0b 0,331 / 0,34 ; t1 3,58 / 3,5 ms ; t3 10,19 / 10 ms ; zb 0,922 / 0,90 ; ωnb 272,5 / 274,3 ; U max 8,24 / 8,04 V ; TR5%b 15,3 / 17 ms (−10 %, badge). K = 40 : G0b 0,678 / 0,69 ; D1/m∞ 0,245 / 0,25 ; Tpb/2 5,62 / 5,7 ms ; zb 0,409 / 0,42 ; ωnb 613 / 607 ; U max 9,90 / 9,54 V ; TR5%b 12,3 / 13,8 ms (−11 %, badge).

**Conflit signalé** : test 15, à 0,4 Vpp la saturation ne change D1/m(∞) que de 3,5 % (seuil demandé 10 %) : `it.fails` dans `tp2.test.ts`.

**Vérifications** : build, `tsc -b`, `npm test` 691 + 1 échec attendu, `npm run test:perf` 6/6, oxlint 0 warning AU3, `check:375` 40 routes, `check:size` OK, parcours Playwright TP2 complet sans message console. Captures 4 à 6 dans `docs/au3/captures/`.

**Reste (étape 4)** : page TP4 (PI série R1/R2/C2, G1, bouteille, P / PI).

## Étape 4 — TP4 (terminée)

**Corrections de l'étape 3**
1. Test 15 réécrit sans `it.fails` : (a) 0,4 Vpp : voie 3 à 10,6 V ±0,5 % pendant ≥ 0,5 ms, D1/m(∞) saturé < linéaire, Tpb/2 saturé > linéaire (deux simulations, avec et sans saturation) ; (b) 3,26 Vpp : D1/m(∞) < 5 %, TR5%b > linéaire à 0,295 Vpp ; (c) 0,295 Vpp : pas de saturation.
2. Variante « GBF trop fort » = amplitude du K = 3,8 non changée (TP2_K38_GBF_VPP, énoncé) ; hypothèse 0,4 V supprimée.
3. I.2.1 Q8 : formule ou abaque (énoncé), tolérance d'abaque ±10 % ; « la formule est plus précise » devient un conseil.

**Régulateur à impédances** (`src/au3/sim/regulateur.ts`) : R(p) = (Z2/Z1)·G1·G2 en polynômes, Z = R, C, série ou parallèle ; forme d'état d'ordre ≤ 2 dans `simulate` ; un seul support garni ou dérivateur pur = hors service. « Faire vérifier » contrôle aussi la nature des composants (`MONTAGES.tp4.impedances`) ; la signature vérifiée inclut Z1/Z2.

**Page `/au3/tp4`** : bandeau « Aucune mesure réelle », composants posés sur la platine, réglages, I Q1 à Q7 (Q5 par balayage de l'Affichage G1), partie II réduite sur le moteur du banc (II.2 non couverte, II.3 à II.5 avec figures, aire de e(t) après la réponse, PI contre P).

**Valeurs prédites (modèle, aucune mesure)** : G1 = 0,95 : erreur 0,0 %, D1/m(∞) 18,6 %, TR5%b 13,8 ms, U max 10,6 V (saturé). G1 = 0,60 : erreur 0,0 %, D1/m(∞) 2,4 %, TR5%b 8,2 ms, U max 10,39 V. Frontière : Affichage 65 (ensemble 10 à 65). Bouteille : écart max 16,6 mV (1,7 %), erreur finale PI 0,0 %, P 22,8 %.

**Vérifications** : build, `tsc -b`, `npm test` 712/712 (aucun `it.fails`), `npm run test:perf` 6/6, oxlint 0 warning AU3, `check:375` 40 routes, `check:size` OK, parcours Playwright TP4 + variantes TP2 sans message console. Captures 7 à 10.

**Reste (étape 5)** : mode examen (chrono, barème câblage, pénalités sous tension, bilan par attendu).
