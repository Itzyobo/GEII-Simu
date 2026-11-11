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
