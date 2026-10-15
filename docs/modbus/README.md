# TP2 — Liaison série asynchrone / MODBUS

Simulateur du TP2 (énoncé TP-10 à TP-18) et préparation au partiel, sous `/modbus`. 100 % navigateur, rien n'est envoyé ailleurs.

## Lancer et tester

```bash
npm install
npm run dev            # http://localhost:5173/modbus
npm test               # Vitest : modèles UART, bus RS485, esclaves, CRC, partiel, rendu
npm run build          # TypeScript strict + bundle
npm run check:375      # chaque route à 375 px : pas de débordement, pas d'erreur console
npm run sync:prd       # réécrit la liste des hypothèses du PRD (§3) depuis reference.ts
```

`npx playwright install chromium` est nécessaire une fois avant `check:375`.

## Pages

- **Banc** : oscilloscope, deux cartes d'interface, pupitre (OTB, TDS, TQS, THT), deux PC (console SERIE, RealTerm, logiciel JBUS/MODBUS). Partie A (liaison série) ou partie B (réseau Modbus).
- **Questions** : questions de l'énoncé, corrigées par les modèles. **Message codé** : chronogrammes tirés au sort. **Cours** : quiz RS232 / RS485, terminaison, polarisation.
- **Hypothèses** : chaque valeur non sourcée (H1 à H52), sa raison et les questions qui en dépendent.

## Mode partiel

Page **Partiel** : choisir la graine (le même nombre redonne le même sujet), la durée (30 min par défaut) et, en option, la manipulation au banc.

- Pendant l'épreuve, il n'y a ni annotation, ni démonstration, ni ×10, ni correction, sur aucune page.
- « Faire vérifier » ne dit que conforme ou non. Le câblage vaut tous les points au 1er essai réussi, la moitié au 2e, 0 ensuite.
- Chaque manipulation tentée pendant qu'un maître ou un programme émet coûte 0,5 point.
- Le chrono part de l'heure de début enregistrée : un rechargement reprend exactement où on en était.
- À la fin du temps ou sur « Rendre » : note globale, note par attendu, et correction de chaque question, traitée ou non.

## Lever un badge « valeur non vérifiée »

Toutes les constantes sont dans `src/modbus/data/reference.ts`. Une entrée `source: 'hypothèse'` porte un numéro H et affiche le badge partout où elle sert.

- **SERIE_2** : saisir le vrai format (débit, bits, parité, stop) dans la page **Réglages**. Le tirage est remplacé et le badge H3 disparaît de la question 2.2.
- **Autre valeur** (ex. température du THT, H12) : remplacer dans `reference.ts` l'entrée par la valeur mesurée, avec `source: 'CR'` (ou `'photo'`, `'énoncé'`), retirer `hyp`, marquer l'hypothèse `resolue: true` dans `HYPOTHESES`, puis lancer `npm run sync:prd` et `npm test`.
