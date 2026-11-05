# INFO3 — état d'avancement

Mis à jour à chaque bloc terminé. Étape en cours : **2** (banc, IDE, MCC de base, TP1, mode libre v1).

## Étape 2

| Bloc | État | Contenu |
| --- | --- | --- |
| R | fait | Fichiers MCC réels (docs/sources/mplab/tp1, MCC 1.81.7) : fixtures et gabarits du générateur ; générateur identique octet pour octet ; Fosc 4 MHz ; `_XTAL_FREQ` dans device_config.h ; préprocesseur (`__XC8_VERSION`, `#pragma config` → VM, `<conio.h>`) ; STVREN ; hypothèses H1/H24 réfutées, H18/H25 partielles, H26 à H29 ajoutées |
| B1 | fait | Worker créé au premier Build/Run (y compris /info3/dev) ; contrôle 375 px strict (« réseau inactif ») restauré sur toutes les routes |
| B2 | fait | Banc SVG (src/info3/board/Board.tsx) : Curiosity HPC, carte fille GEII, LED à lueur = ledDuty (variable CSS), S1/S2 souris/toucher/touches 1 et 2, USB noir et blanc, cartes Click à glisser ou à cliquer, verrouillage sous tension ; monté sur /info3/dev |
| B3 | fait | IDE (src/info3/ide/Ide.tsx) : arborescence Projects, onglets, CodeEditor (chunk séparé) en lecture seule pour mcc_generated_files, Build F11, Make and Program, Debug Ctrl+F5, Continue F5, Step Over F8, Step Into F7, Step Out Ctrl+F7, Pause, Reset, Source › Format, un point d'arrêt dans la marge, Output cliquable, Variables et SFR à l'arrêt, thème clair (sombre en option) |
| B4 | fait | Interface MCC (src/info3/mcc/Mcc.tsx, chunk séparé) : Project Resources (System Module, Pin Module), Device Resources vide, Generate ; System Module (Oscillator Select, HF Internal Clock, Clock Divider, Current System clock, champ grisé 32768 Hz, LVP) ; table Pin Module (Custom Name en rouge si invalide, Analog avec badge H23, IOC grisé « none ») ; Pin Manager: Grid View (cadenas, numéros PDIP40, RE3 entrée seule) |
| B5 | à faire | Pages /info3, /info3/tp1, /info3/libre |
| B6 | bloqué / à faire | C1 : PDF de l'énoncé absents (docs/sources/INFO3_TP.pdf, INFO3_Cours.pdf) ; C4 tailles gzip ; C5 oxlint |

Déjà fait avant R (non commité jusqu'ici) : moteur de l'étape 1 ; modèle MCC, Faire vérifier, verrouillage, professeur virtuel TP1, solutions, persistance, Diagnostic R1 à R4, symboles de l'IDE, protocole du Worker étendu.

## Derniers résultats (blocs R et B1)

- Tests : `npx vitest run src/info3` → 151 réussis, 1 ignoré (F9 : énoncé non transcrit), 0 échec.
- TypeScript (`tsc -p tsconfig.app.json`) : 0 erreur.
- Build : sans erreur ni warning (commit R vérifié dans un worktree propre : 398 tests, 1 ignoré).
- oxlint (B1) : 26 avertissements, tous préexistants hors INFO3 ; 0 dans src/info3, src/pages/info3, scripts, src/data.
- 375 px strict (B1) : 25 routes conformes, /info3/dev compris.

### Mesures R6 (fixtures du CR avec les fichiers MCC réels, Fosc = 4 MHz)

| Fixture | Mesure | Cible |
| --- | --- | --- |
| q3_3 période de D2 | 1,000016 s | 1,000 s ± 0,5 % |
| q3_5 pas | 1,000027 à 1,000029 s | 1,000 s ± 0,5 % |
| q3_6 pas | 0,500041 s | 0,500 s ± 0,5 % |
| q3_7 pas | 1,000049 s | 1,000 s ± 0,5 % |
| q4 tempos | 1,000236 s ; 2,000396 s ; 0,200108 s | ± 0,5 % |
| F14 surcoût à 200 ms | 0,054 % | < 0,1 % |
| 1 s simulée de q3_4 (Node) | 86 ms | < 250 ms |
| 10 s simulées de q3_5 (Node) | 0,3 ms | < 300 ms |

## Bloquants

- `docs/sources/INFO3_TP.pdf` et `INFO3_Cours.pdf` absents : la transcription mot pour mot de l'énoncé (C1) n'est pas faite ; les intitulés de questions ne sont pas affichés (résumé PRD à la place) et le test F9 est ignoré.
- Les fichiers MCC réels ont été trouvés dans `Downloads/TP1.X` (projet MPLAB X) et copiés octet pour octet dans `docs/sources/mplab/tp1/`.
