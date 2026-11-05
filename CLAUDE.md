# TP-Sim — consignes pour Claude Code

Site React 100 % front (Vite, TypeScript strict, Tailwind, Vitest). Trois modules : ENER3 (`/ener`, `/tp/*`), MODBUS (`/modbus`), INFO3 (`/info3`).
Commandes : `npm test`, `npm run build`, `npx oxlint`, `npm run check:375`.

## INFO3

Simulateur PIC16F18875 / Curiosity HPC. PRD : `PRD — Simulateur INFO3 Curiosity HPC.md`. Ces règles valent pour **toutes** les étapes.

- **Constantes** : toutes les constantes INFO3 vivent dans `src/data/reference.ts` (objet exporté `INFO3`), nulle part ailleurs. Aucun nombre magique dans `src/info3/models/`, `src/info3/vm/`, `src/info3/compiler/` hors indices triviaux (0, 1). Les constantes de syntaxe du langage C (bases 2, 8, 10, 16 des littéraux, codes ASCII des séquences d'échappement) sont des constantes nommées locales, pas des valeurs matérielles.
- **Énoncé** : `docs/info3/enonce.md` = copie mot pour mot de l'énoncé (`docs/enonce.md` est l'énoncé ENER3, ne pas l'écraser). Les questions reprennent ses intitulés exacts ; chaque question a une ancre `<a id="tpN-x-y"></a>` qui sert de clé.
- **Réponses attendues** : calculées depuis les modèles, jamais codées en dur.
- **Hypothèses** : toute valeur inventée est une hypothèse Hx enregistrée dans `INFO3.hypotheses` ; toute question qui en dépend affiche le badge « valeur non vérifiée ».
- **Accueil `/info3`** : suit les points de validation A1–A10 (PRD §3.6), chacun relié aux questions qui le couvrent ; une ligne non couverte reste affichée.
- **Câblage** : l'étudiant ne manipule que ce qu'il manipule en salle (cartes Click sur mikroBUS 1/2, USB noir et blanc, cache LED RGB) ; le reste est dessiné pré-câblé. Verrouillage sous tension (USB noir branché). « Faire vérifier » obligatoire avant la première mise sous tension.
- **Mode examen** : chrono, aucun indice ni Diagnostic ; configuration (cartes + MCC) notée 100 % au 1er essai, 50 % au 2e, 0 ensuite ; pénalité par manipulation sous tension ; questions non traitées affichées avec leur correction ; session conservée après rechargement.
- **Registres d'abord** : le comportement émerge des registres. Aucun `if (tp === ...)` dans les modèles.
- **Tolérances** : ne jamais élargir une tolérance pour faire passer un test. Corriger le modèle ou signaler le conflit.
- **Sources réelles d'abord** : les fichiers produits en TP (`docs/sources/mplab/…`, conservés octet pour octet, CRLF compris) priment sur le cours et sur le PRD. Le générateur MCC part de ces fichiers (`src/info3/mcc/templates/`, CRLF → LF seulement) et ne calcule que ce qui dépend de la configuration.
- **Hypothèses vérifiées ou réfutées** : ne pas les supprimer ; renseigner `statut` (vérifiée, partielle, réfutée) et `preuve` dans `INFO3.hypotheses`.
- **Suivi** : `docs/info3/STATUS.md` est mis à jour à chaque bloc terminé (fait, reste, build, tests, oxlint, 375 px) ; un commit par bloc, le dépôt compile et les tests passent à chaque commit.

### Organisation (étape 1)

- `src/info3/compiler/` : préprocesseur (sur jetons) → lexer → parser à descente récursive + vérification des types → bytecode ; `headers.ts` génère `xc.h` depuis `INFO3.sfr`.
- `src/info3/vm/` : VM à pile, bus SFR, file d'événements, interruptions, pile matérielle.
- `src/info3/models/` : `gpio`, `button`, `prng` (purs, testés sans VM).
- `src/info3/worker/` : protocole typé, `handleMessage` pur, `sim.worker.ts`, `createSimClient()`.
- `src/info3/fixtures/` : MCC TP1 écrit à la main (`mcc-tp1/`), code des CR copié tel quel (`cr/`). Ne jamais corriger le code des CR.
- Page technique : `/info3/dev` (`src/pages/info3/Dev.tsx`), sans lien public.
