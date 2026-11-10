# INFO3 — état d'avancement

Mis à jour à chaque bloc terminé. Étape en cours : **6** (TP6 : CAN, joystick, matrice 8x8 / MAX7219). Étape 5 terminée (commit 74db13a), étape 4 (bcbde29), étape 3 (d6e41e4), étape 2 (e91a015).

## Étape 6

| Bloc | État | Contenu |
| --- | --- | --- |
| R | fait | R1 : règle « jamais de git push » dans CLAUDE.md (section INFO3). R2 : TP1 3.6 sans durée imposée : pas constant à ± 1 % entre 100 ms et 2 s (INFO3.tp1.bidirStep), sens selon S1 ; test : CR q3_6 avec __delay_ms(300) validé, 500 ms toujours validé, 2,5 s refusé. R3 : TP2 2.1 garde sa question numérique avec l'étiquette « Question d'entraînement (hors énoncé) » (champ entrainement). R4 : PWM1_LoadDutyValue identique au texte du cours p. 89 fourni (mêmes instructions, ordre et commentaire) — aucun écart ; test à espaces près ; H42 partielle. R5 : professeurs chargés à la demande dans le Worker (worker/grading.ts, import() par TP, worker.format 'es') : Worker 51,9 Ko (63,4 avant), professeurs 2,3 à 3,8 Ko par TP ; verdict envoyé avec le tick suivant |
| B1 | fait | ADCC. SFR ADRESL/H, ADPCH, ADACQ, ADCAP, ADPRE, ADACT, ADCLK (ADCCS), ADREF, ADCON0 (ADON, ADCONT, ADCS, ADFM, ADGO) à ADCON3, ADSTAT (H18) ; test : adresses SFR toutes distinctes. Modèle adcc (src/info3/models/adcc.ts) : 10 bits, code = floor(Vin / (3,3 V / 1024)) saturé, bruit ± 1 LSB à graine fixée, TAD = 2 × (ADCCS + 1) / Fosc ou FRC (H51), conversion = 11,5 TAD + ADACQ × TAD, ADGO remis à 0 et ADIF (PIR1) levé à la fin, alignement ADFM, journal des conversions ; mode de base seulement (H52). Banc : potentiomètre R1 (RA0, glisser circulaire 270°, flèches), joystick (glisser, toucher, flèches, retour au repos au relâcher, Espace = JOY_SW sur RA1) ; repos 498 / 530 (H4), X croît vers la droite, Y vers le bas (H48), butées 0 et 1023 ; message Worker « analog ». MCC : Device Resources › ADC › ADCC, Easy Setup (Enable ADC, Result Alignment, références VDD / VSS, Clock Source FOSC/ADCLK ou FRC, FOSC/2 à FOSC/128, TAD avec alerte sous 1 µs, Acquisition Count, durée de conversion, Enable ADC Interrupt ; libellés H49), ligne ADCC ANx du Grid View (broche en analogique, Custom Name dans Pin Module), adcc.c / adcc.h (adc_result_t, enum adcc_channel_t au format du cours p. 99, voies RD5 = 0x1D et RD6 = 0x1E : H50), ADI (PIE1/PIR1, second niveau) dans l'Interrupt Module. Presets tp61Config, tp62Config. Tests 1 à 7 |

## Étape 5 (terminée)

| Bloc | État | Contenu |
| --- | --- | --- |
| R1 | fait | Énoncé fourni (racine) déplacé dans docs/info3/enonce.md ; intitulés exacts des questions TP1–TP4 lus par ancre (fin = ancre suivante, filet ou titre), résumés du PRD supprimés (champ resume retiré) ; texte commun du §4 du TP1 (ancre tp1-4) affiché au-dessus de 4.1 à 4.3 ; ancres hors question : tp1-1, tp1-2 (hors simulateur), tp1-4 (texte commun) ; rendu Markdown : tableaux, blocs indentés et clôturés dans les listes, filets, retours à la ligne. F9 réactivé ; tests : chaque question a son ancre, chaque ancre de question d'un TP livré est couverte |
| R2 | fait | TP4 §6 : plus d'appui S1 obligatoire. Fenêtre de 60 s simulées (INFO3.tp4.animationWindowS) ; animation 1 = au moins 16 rotations d'une LED de 0xF0F0 ; animation 2 = suite des états à partir du premier pas qui n'est plus une rotation, périodique (au moins deux cycles), pas uniquement des rotations de 0xF0F0. Si elle ne démarre pas seule, le professeur appuie sur S1 (à 20 s) puis sur S2 (à 40 s) ; le verdict dit comment elle a démarré. Tests : enchaînement sans bouton validé (« sans action »), solution de référence (S1) validée, une seule animation refusée |
| R3 | fait | Assertions de temps réel déplacées, seuils inchangés : src/models/stepper.perf.test.ts (ENER, recalcul < 50 ms), src/info3/fixtures/tp1.perf.test.ts (1 s simulée de q3_4 < 250 ms, 10 s de q3_5 < 300 ms), src/info3/prof/tp4.perf.test.ts (ticks < 50 ms, 60 s à ×10). vite.config.ts exclut **/*.perf.test.ts de npm test ; npm run test:perf (vitest.perf.config.ts) les lance seuls, en série (fileParallelism false, maxWorkers 1) |
| B1 | fait | CCP1 (mode PWM), PWM6, PWM7 sur TMR2. SFR CCPR1L/H, CCP1CON (champs CCP1MODE, CCP1FMT…), CCPTMRS0/1 (CxTSEL, PxTSEL), PWMxDCL/DCH/CON (H18, H44). Modèle pwm (src/info3/models/pwm.ts) : sortie à 1 en début de période, à 0 au seuil (rapport cyclique × incrément / 4), 0 → toujours 0, ≥ 4·(PR2+1) → toujours 1, double tampon (seuil pris au début de la période suivante), polarité, fronts datés ; Timer246 expose sa base de temps (timebase, onChange). VM : mappage PPS de sortie générique (SCK1, SDO1, CCP1 0x09, PWM6 0x0E, PWM7 0x0F), sortie seulement si TRIS = 0. Modèle rgbLed : intensité = rapport cyclique moyen, mélange additif (H17), halo sans le cache ; banc : LED colorée, case « Cache LED RGB » ; Worker : rapport cyclique de RGB_R/G/B par image ; trace des broches bornée (maxPinTrace). Points de test TP10/TP11/TP12 (H45). MCC : Device Resources › CCP › CCP1, PWM › PWM6/PWM7, panneau (Enable PWM, Timer Select, Duty Cycle, Output Polarity / CCPR Alignment, période, fréquence, résolution), lignes CCP1/PWM6OUT/PWM7OUT du Grid View (RD4, RC0, RC1 par défaut), écritures RxyPPS (H44), ccp1.c/.h, pwm6.c/.h, pwm7.c/.h (H42), Notifications [MCC] (TMR2 absent, source ≠ FOSC/4 : H41, broche manquante). Preset tp51PwmConfig. Tests 1, 2, 3, 9, 10 + double tampon, polarité, LFINTOSC, chaîne MCC → VM |
| B2 | fait | EUSART et terminal. SFR RC1REG, TX1REG, SP1BRGL/H, RC1STA, TX1STA (TRMT = 1 au reset), BAUD1CON, RXPPS (H18, H44). Modèle eusart (src/info3/models/eusart.ts) : baud = Fosc / (diviseur × (SPBRG + 1)), trame 8N1 LSB en premier, double tampon TXREG / registre à décalage, TXIF et TRMT calculés, EUSART_Write qui attend TXIF ralentit le programme (≈ 1,04 ms par caractère à 9600 bauds) ; réception par décodeur au baud du PIC, FIFO de 2 octets, RCIF, OERR, FERR. TX sur RC6 par PPS (code 0x10, visible à l'oscilloscope). MCC : Device Resources › EUSART (Enable EUSART / Transmit / Receive, Baud Rate 9600 par défaut H6, 8-bit, Redirect STDIO to USART, Enable EUSART Interrupts), baud réel et erreur, écart > 5 % signalé (panneau et Notifications [MCC]), lignes TX1 / RX1 du Grid View, RXPPS / RC6PPS ; eusart.c / eusart.h sans ou avec interruptions (tampons de 8 octets, TXI et RCI dans l'Interrupt Module), putch → EUSART_Write, getch → EUSART_Read, <stdio.h> inclus si redirection (H43 ; eusart_status_t en champs de bits, pas d'union). Terminal (models/terminal.ts, ui/Terminal.tsx) : port COM seulement avec l'USB blanc (H12), baud et format (8N1, 8E1, 8O1, 7N1, 8N2), \r et \n affichables, horodatage, Effacer, envoi vers RX ; décodage au baud du terminal par rééchantillonnage de la trame réelle (H47). Tests 4, 5, 6, 7 + interruptions, réception, Worker |
| B3 | fait | Page /info3/tp5 (TpPage : analyseur RD4/RC0/RC1/RC6, oscilloscope TP10/TP11, terminal), 4 questions par ancre (tp5-1 à tp5-4) : défis notés (prof/tp5.ts), période PWM relevée à l'oscilloscope (attendue depuis la configuration, ± 0,5 %), prescaler pour ≈ 4 ms (calculé : 16 à 4 MHz, 4 à 1 MHz), QCM PR2 = 0xFF (10 bits) et FOSC/4. Professeur : §1 rouge PWM6 ≥ 99 %, PWM7 = CCP1 = 0 %, terminal « (R,G,B) = (255,0,0) » + fin de ligne ; §2 rgb_color_t et RGBL_SetColor (texte de l'énoncé), appels unitaires (44,117,255) → 176/468/1020, (253,63,146) → 1012/252/584, une ligne par seconde ± 2 %, niveaux R, G, B dans l'ordre, message des 25 % si la couleur n'est pas × 4 ; §3 state_t, IncrementCurrentColor, S2 rouge → vert → bleu → rouge avec une seule LED D5/D4/D3, S1 +16, débordement retour à 0 ou blocage à 255 (H46, choix indiqué) ; §4 DecrementCurrentColor, codeur horaire / anti-horaire, S2, anneau. Faire vérifier TP5 (USB blanc, TMR2 FOSC/4 PR2 = 0xFF, PWM6/PWM7/CCP1 sur RD4/RC0/RC1 et TMR2, EUSART + Redirect STDIO, §3 IOC S1/S2 et LED_D3–D5, §4 Rotary mikroBUS 2, SPI, RST, LATCH, ENCA/ENCB) ; rappels non bloquants : cache absent, USB noir (verrouillage : branché après la vérification). Solutions src/info3/solutions/tp5/q1.c à q4.c. Oscilloscope : période mesurée sur les fronts enregistrés (impulsion de 4 µs à 1023/1024 comprise). Carte TP5 de l'accueil, route /info3/tp5 ; A3 et A9 couverts ; A5 pointe sur tp6-1-1 (ancre réelle). Test 8 + refus, Faire vérifier, questions numériques |
| V | fait | Vérifications finales (ci-dessous) ; état de l'étape consigné ici |

### Résultats de l'étape 5 (HEAD 175b070 vérifié dans un worktree propre, sans le travail ENER3 non commité)

- `npm test` : 20 passages sur 20 sans échec, 535 tests chacun (worktree propre ; 551 dans la copie de travail avec les tests du cours animé ENER3). `npm run test:perf` : 5 passages sur 5, 5 tests (seuils inchangés), en série.
- R3 : avant correction, un test échouait à chaque passage dans un dépôt extrait en CRLF (TP4 Q3 « octets inversés », remplacement de texte sur une solution CRLF) et TP1 q4 dépassait le délai de 5 s sous charge (2,5 s seul) : solutions et énoncé lus en LF, délai de test porté à 60 s. Après : 20/20 (dont des passages sous charge) et 5/5 perf.
- `npm run build` : 0 erreur, 0 warning. oxlint : 23 avertissements à bcbde29 et 23 à HEAD (0 dans src/info3, src/pages/info3, src/data).
- 375 px strict : 24 routes conformes dans le worktree propre (/info3/tp5 comprise), 32 dans la copie de travail (avec /ener/cours).
- Navigateur (Playwright headless, l'extension Chrome n'était pas connectée), /info3/tp5, 0 erreur console :
  1. question 1 entièrement par l'interface : MCC (TMR2 1:16, Timer Period 4,096 ms, CCP1, PWM6, PWM7, EUSART + Redirect STDIO), « Aucune notification », Generate, solution collée dans main.c, USB blanc + cache, Faire vérifier « Configuration conforme pour la question 1 », USB noir, Program : BUILD SUCCESSFUL ;
  2. LED RGB « R 100 %, G 0 %, B 0 % » (rgb(255, 0, 0)), terminal `(R,G,B) = (255,0,0)` puis fin de ligne ;
  3. oscilloscope CH1 = TP10 (RGB_R, RD4), 2 ms/div : période 4,096 ms ;
  4. question 3 (configuration MCC de référence chargée dans le projet, puis Generate, Faire vérifier, Program par l'interface ; appuis propres touches 1 et 2) : départ D5 seule ; S1 × 4 → R 25 % (64) ; S2 → D4 seule, S1 × 2 → G 12 % (32) ;
  5. question 4 (idem, carte Rotary enfichée sur MODULE 2) : codeur +3 crans → G 30 % (80), anneau LED 4 ; −5 crans → G 0 % (bloqué à 0), anneau LED 15.
- Accueil : A3 et A9 couverts (vert) ; A5, A7, A8 partiels (TP6).

| Chunk (gzip, worktree propre) | Étape 5 | Budget |
| --- | --- | --- |
| Bundle initial (index-*.js) | 80,04 Ko (79,96 à l'étape 4) | ≤ base + 3 Ko |
| /info3/tp5 hors éditeur (page, TpPage, Workbench, banc, projet, références, énoncé) | 72,5 Ko | — |
| Worker (compilateur, VM, PWM, EUSART, professeurs TP1–TP5) | 61,7 Ko | — |
| /info3/tp5 hors éditeur, Worker compris | 134,2 Ko | ≤ 150 Ko |
| MCC (à l'ouverture) | 7,1 Ko | — |
| CodeMirror (CodeEditor) | 103,5 Ko | ≤ 120 Ko |

Écarts de l'étape 5 :
- « Faire vérifier : USB noir et blanc branchés » : l'USB noir ne peut pas être branché avant la première vérification (verrouillage du projet) ; il est donc un rappel non bloquant (avec le cache absent), l'USB blanc est exigé.
- Cours (INFO3_Cours.pdf) absent : les corps de PWM1_LoadDutyValue (p. 89) et PWMx_LoadDutyValue (p. 90) sont ceux du driver MCC 1.81, non comparés au cours (H42) ; le test 1 compare le fichier généré à ce texte de référence.
- eusart_status_t généré en champs de bits (le compilateur du simulateur ne gère pas les union) ; <stdio.h> inclus par eusart.h quand STDIO est redirigé (H43).
- Oscilloscope : la période automatique est mesurée sur les fronts enregistrés (sinon l'impulsion de 4 µs d'un rapport cyclique 1023/1024 échappait à l'échantillonnage).
- Énoncé TP1 3.6 : aucune durée de pas dans l'énoncé, le professeur garde 0,5 s (CR) — à trancher.

Reste pour l'étape 6 : TP6 (ADCC, joystick, potentiomètre, printf des valeurs ; carte 8x8 R click, MAX7219, LED8x8.c), questions tp6-1-1 à tp6-4, points A5, A7, A8 à compléter.

## Étape 4 (terminée)

| Bloc | État | Contenu |
| --- | --- | --- |
| B1 | fait | MSSP1 en SPI maître : SFR (SSP1BUF…CON3, champs SSPM/CKP/SSPEN/WCOL), PPS (RxyPPS, SSP1CLKPPS/DATPPS = H38), sorties PPS dans le modèle gpio ; modèle `mssp-spi` (MSB en premier, 8 périodes, SCK au repos = CKP, changement selon CKE, lecture SMP, SSP1IF + BF, WCOL ; modes 1 et 2 sans présentation anticipée = H14) ; temps des périphériques = instant de l'événement (fronts SCK/MOSI datés exactement) ; MCC : Device Resources › MSSP1, Easy Setup (H37), lignes SCK1/SDI1/SDO1 du Grid View, fréquence de SCK ; spi1.c/.h (format H39), PPS et TRIS/ANSEL dans pin_manager.c ; `<stddef.h>`. Tests 1, 3, 4 (et périodes de SCK par la trace) |
| B2 | fait | Modèle `hc595x2` (SER de U2 ← MOSI, Q7S de U3 → MISO, étage 0 = LED 1, décalage au front montant de SCK avec le MOSI d'avant le front, MR = RST actif à 0, front montant de LATCH → sorties ; RST/LATCH en l'air lus à 0 = H36) ; câblage selon le mikroBUS (mikroBUS 1 : RST = RD0, LATCH = RA3 → anneau éteint) ; anneau dessiné sur la carte Rotary, LED 1 en haut puis sens horaire (H10), lueur = fraction du temps allumée (image du Worker) ; presets tp4-1, tp4-2, tp4-5. Tests 5 à 10 |
| B3 | fait | Oscilloscope 2 voies (canvas, src/info3/ui/Oscilloscope.tsx) reprenant `acquire` et `measure` de src/lib/scope.ts : sondes TP17 (SCK), TP16 (MOSI), TP19 (ENC_A), TP20 (ENC_B) ou toute broche ; 200 ns à 1 s/div ; signaux 0 à 3,3 V, fronts de 20 ns (H40) ; déclenchement sur front (voie, sens, niveau, Trig'd / Auto) ; Run/Stop ; curseurs ΔT et 1/ΔT ; période automatique ; décodage SPI (mode au choix, octet au-dessus de la trame). Voies demandées au Worker par instrument (union analyseur + oscilloscope). L'analyseur logique reste disponible. Test 2 (périodes de SCK par l'oscilloscope) et décodage de 0x31 |
| B4 | fait | Page /info3/tp4 (TpPage, analyseur SCK/MOSI/LATCH/RST, oscilloscope TP17/TP16), 6 questions par ancre : défis notés (prof/tp4.ts), période de SCK relevée aux curseurs (attendue calculée depuis la configuration, ± 1 %), QCM MSB en premier, « quel mode SPI » (0 et 3 ; leurres 1 et 2 avec le décalage d'un rang), WriteByte / ExchangeByte ; Faire vérifier TP4 (Rotary sur le mikroBUS 2, MSSP1 et broches SCK1/SDO1/SDI1, RST/LATCH en sortie dès §2, LED + codeur + IOC pour §5) ; solutions de référence src/info3/solutions/tp4/q1.c à q6.c ; question 6 : l'animation 2 démarre après un appui sur S1 (choix du simulateur, énoncé absent) ; carte TP4 de l'accueil ; A6 et A10 couverts. Tests 11 et 12 |
| B5 | fait sauf C1 | Vérifications finales (ci-dessous). Ajouts : temps de retenue du déclenchement de l'oscilloscope (premier front d'une salve, comme un oscilloscope réarmé : la trame 0x31 entière à l'écran) ; sélecteur « Vitesse » (×0,1, ×1, ×10) sous le banc, réappliqué après Program ; Faire vérifier TP4 : codeur et IOC exigés pour la question 5 seulement |

### Résultats de l'étape 4 (HEAD + B5 vérifiés dans un worktree propre, sans le travail ENER3 non commité)

- Tests : 494 réussis, 1 ignoré (F9), 0 échec INFO3. `src/models/stepper.test.ts` (ENER3, non modifié) échoue 2 fois sur 5 passages complets, toujours l'assertion de temps réel « recalcul < 50 ms » (56,2 et 65,5 ms) ; seul : 20/20.
- TypeScript, `npm run build` : 0 erreur, 0 warning. oxlint : 23 avertissements comme à e91a015 et d6e41e4, 0 dans INFO3.
- 375 px strict : 31 routes conformes (/info3/tp4 comprise).
- Navigateur /info3/tp4, 0 erreur console :
  - Q1 (tp4-1, mode 3, Fosc/4) : Generate, Faire vérifier conforme, Program ; oscilloscope TP17/TP16 à 2 µs/div, Stop, curseurs sur deux fronts montants : ΔT = 1 µs (1/ΔT = 1 000 000 Hz), période automatique 1 000 ns, trame décodée 0x31 ;
  - Q2 (mode 0) : LED 1, 5, 6 allumées (plus LED 9, 13, 14 après le 2e envoi, comportement réel de la chaîne) ;
  - Q5 : LED de l'anneau 1 → 2 → 3 → 4 → 5 → 6 → 5 → 4 pour 0, +1…+5, −1, −2 crans ;
  - Q4 et Q6 à ×10 pendant 6 s réelles : 61,1 s et 61,0 s simulées, 0 tâche longue > 50 ms.

| Chunk (gzip, worktree propre) | Étape 4 | Budget |
| --- | --- | --- |
| Bundle initial (index-*.js) | 79,96 Ko (79,93 à l'étape 3) | ≤ base + 3 Ko |
| /info3/tp4 hors éditeur | 54,2 Ko | — |
| Worker (compilateur, VM, MSSP, 74HC595, professeurs TP1–TP4) | 53,0 Ko | — |
| /info3/tp4 hors éditeur, Worker compris | 107,2 Ko | ≤ 150 Ko |
| CodeMirror (CodeEditor) | 103,3 Ko | ≤ 120 Ko |

Point hérité — test ENER `src/models/stepper.test.ts` (non modifié) : seul, 20 réussites sur 20 (6,5 à 7,8 s) ; en parallèle avec les tests INFO3 les plus lourds (`src/models src/info3/models src/info3/mcc`), 15 échecs sur 20, toujours la même assertion « performance : recalcul < 50 ms » (50,6 à 97,6 ms mesurés). Cause : mesure de temps réel (`performance.now()`) sensible à la charge du processeur, pas un défaut du modèle.

C1 : toujours bloquée (docs/sources/INFO3_TP.pdf absent).

## Étape 3 (terminée)

## Étape 3

| Bloc | État | Contenu |
| --- | --- | --- |
| B0 | fait | Grid View au boîtier UQFN40 par défaut (numéros des captures du CR), PDIP40 au menu Package ; lignes OSC/CLKOUT (RA6), GPIO input/output, RESET/MCLR (RE3 verrouillée) ; bleu/vert/orange ; deux fonctions par broche ; « Selected Package : UQFN40 » |
| B1 | fait | IOC : modèle `ioc` (fronts selon IOCxP/IOCxN, ignorés en analogique), IOCIF en lecture seule = OU des IOCxF, colonne IOC de Pin Module (grisée sur le port D), code généré (registres, handlers, PIE0bits.IOCIE, PIN_MANAGER_IOC, ISR/Set/Default) ; format = H34 |
| B2 | fait | Interrupt Module (Interrupt Vector : Order Up/Down, Single ISR per interrupt, table Order/Module/Interrupt/Enabled), interrupt_manager.c/.h (cours p. 39, macros Global/Peripheral Enable/Disable, include dans mcc.h), ordre à plusieurs sources = H30 ; inspecteur d'interruptions (GIE, PEIE, IE, IF, ordre, appels) ; fixtures du CR TP2/TP3 copiées telles quelles ; test 5 (tp2/q1_1 : 20 appuis → 4, rebonds → au moins un +2, GIE commenté → 0 interruption) |
| B3 | fait | TMR2/4/6 : SFR (T2TMR/TMR2, T2PR/PR2, T2CON, T2HLT, T2CLKCON, T2RST, T2INPPS ; champs MODE, RSEL, CKPS, OUTPS, CS dans xc.h), modèle `timer246` événementiel (Roll over, one-shot, monostable sur front de TMRx_ers, fronts ignorés pendant le comptage = H33), panneau MCC aux libellés du CR (Hardware Settings, Timer Clock, Timer Period avec plage et Actual Period, Software Settings ; Monostable → postscaler 1:1), ligne TMR2 T2IN du Grid View (écrit T2INPPS), tmrX.c/.h (cours p. 58, 59, 65 ; fonctions = H32), presets tp3-1A/1B/1C/2 ; H28 partielle, H31–H33 ajoutées. Tests 2, 3, 4, 9 (mesures), 10, 11, 12, 13 |
| B4 | fait | Modèle `ec12d` (30 crans, 15 impulsions par voie, A = B aux crans, A en avance en sens horaire = H9, sans rebond) ; câblage selon le mikroBUS (ENCA → PWM, ENCB → AN, SW → INT = H35 : mikroBUS 2 → RD1, RA2, RB0 ; mikroBUS 1 → RC2, RA1, RD1 et RA2 flottent = H20) ; commandes : molette, flèches, glisser circulaire, rotation continue 1–10 crans/s, SW (anneau de LED éteint) ; analyseur logique 4 voies (broches + ISR, TMRxIF), 1 µs à 1 s/div, curseurs ; solution tp2/q2_4. Tests 7, 8 |
| B5 | fait | Pages /info3/tp2 et /info3/tp3 (page commune TpPage : énoncé, questions, banc, IDE, MCC, analyseur aux voies du TP) ; 9 questions par ancre (TP2 1.1, 1.2, 2.1–2.4 ; TP3 1, 2, 3) en parties : défi noté, QCM à une ou plusieurs réponses, valeurs numériques lues dans tmr2.c, mise en ordre de la chaîne d’appel, liste de contrôle du débogage ; professeur virtuel prof/tp23.ts (refus 1B : « Période : 1 000 ms attendue, 63,5 ms mesurée ») ; Faire vérifier TP2/TP3 (noms, IOC, TMR2 Monostable + T2IN, Rotary sur le mikroBUS 2) ; solutions tp2/q2_4 et tp3/q1 (code du CR + tp3-1C) ; cartes TP2 et TP3 de l’accueil ; A5 à A10 partiels. Tests 9 (refus), 14 |
| B6 | fait sauf C1 | Vérifications finales (ci-dessous) ; case « Rebonds des boutons S1 et S2 (H3) » sous le banc, cochée par défaut (sans elle, les rebonds du TP2 1.1 et l’anti-rebond du TP3 §2 n’étaient pas observables au navigateur) |

C1 (transcription de l'énoncé) : toujours bloquée, docs/sources/INFO3_TP.pdf absent.

### Résultats de l'étape 3 (B6, HEAD vérifié dans un worktree propre, sans le travail ENER3 non commité)

- Tests : 460 réussis, 1 ignoré (F9), 0 échec. Un premier passage a vu échouer `src/models/stepper.test.ts` (ENER3, 7,4 s, sensible à la charge) ; il passe seul et au second passage complet.
- TypeScript et `npm run build` : 0 erreur, 0 warning.
- oxlint : 23 avertissements à e91a015 et 23 à HEAD (même comptage), 0 dans src/info3, src/pages/info3, src/data ; 0 erreur.
- 375 px strict : 30 routes conformes (/info3/tp2 et /info3/tp3 comprises) ; onglets Code, MCC, Banc, Questions de /info3/tp3 sans débordement.
- Navigateur /info3/tp3 (configuration tp3-2, code du CR) : Generate, Faire vérifier conforme (question 2), Program ; 10 appuis sur S2 rebonds activés → D5…D2 0 → 6 (−10 exactement) ; analyseur 20 ms/div : front descendant de RC5 → TMR2IF et ISR à 10 ms. 0 erreur console.
- Navigateur /info3/tp2 (2.3, Rotary sur le mikroBUS 2) : D3 = 1 après 10/10 crans horaires, 0 après 10/10 antihoraires (flèches du bouton). 0 erreur console.

| Chunk (gzip) | Étape 3 | Budget |
| --- | --- | --- |
| Bundle initial (index-*.js, worktree propre) | 79,93 Ko | ≤ base + 3 Ko |
| /info3/tp2 ou /info3/tp3 hors éditeur | 47,4 Ko | — |
| /info3/tp1 hors éditeur | 43,6 Ko | — |
| Worker (compilateur, VM, timers, codeur, professeurs TP1–TP3) | 47,3 Ko | — |
| /info3/tp3 hors éditeur, Worker compris | 94,7 Ko | ≤ 150 Ko |
| CodeMirror (CodeEditor) | 103,3 Ko | ≤ 120 Ko |

## Étape 2 (terminée)

| Bloc | État | Contenu |
| --- | --- | --- |
| R | fait | Fichiers MCC réels (docs/sources/mplab/tp1, MCC 1.81.7) : fixtures et gabarits du générateur ; générateur identique octet pour octet ; Fosc 4 MHz ; `_XTAL_FREQ` dans device_config.h ; préprocesseur (`__XC8_VERSION`, `#pragma config` → VM, `<conio.h>`) ; STVREN ; hypothèses H1/H24 réfutées, H18/H25 partielles, H26 à H29 ajoutées |
| B1 | fait | Worker créé au premier Build/Run (y compris /info3/dev) ; contrôle 375 px strict (« réseau inactif ») restauré sur toutes les routes |
| B2 | fait | Banc SVG (src/info3/board/Board.tsx) : Curiosity HPC, carte fille GEII, LED à lueur = ledDuty (variable CSS), S1/S2 souris/toucher/touches 1 et 2, USB noir et blanc, cartes Click à glisser ou à cliquer, verrouillage sous tension ; monté sur /info3/dev |
| B3 | fait | IDE (src/info3/ide/Ide.tsx) : arborescence Projects, onglets, CodeEditor (chunk séparé) en lecture seule pour mcc_generated_files, Build F11, Make and Program, Debug Ctrl+F5, Continue F5, Step Over F8, Step Into F7, Step Out Ctrl+F7, Pause, Reset, Source › Format, un point d'arrêt dans la marge, Output cliquable, Variables et SFR à l'arrêt, thème clair (sombre en option) |
| B4 | fait | Interface MCC (src/info3/mcc/Mcc.tsx, chunk séparé) : Project Resources (System Module, Pin Module), Device Resources vide, Generate ; System Module (Oscillator Select, HF Internal Clock, Clock Divider, Current System clock, champ grisé 32768 Hz, LVP) ; table Pin Module (Custom Name en rouge si invalide, Analog avec badge H23, IOC grisé « none ») ; Pin Manager: Grid View (cadenas, numéros PDIP40, RE3 entrée seule) |
| B5 | fait | /info3 (A1 à A10 en vert, orange ou rouge, cartes TP1 à TP6, mode libre), /info3/tp1 (énoncé, questions et professeur virtuel, Faire vérifier progressif, banc, IDE, MCC), /info3/libre (projets multiples, export et import JSON, Diagnostic R1 à R4) ; 4 onglets à 375 px |
| B6 | fait sauf C1 | C1 bloqué : PDF de l'énoncé absents, rien d'inventé. C4 : budgets tenus (voir tailles) après remplacement de @codemirror/lang-cpp par un mode C léger (cLanguage.ts). C5 : oxlint 26 avant, 26 après, 0 dans les fichiers INFO3 |

Déjà fait avant R (non commité jusqu'ici) : moteur de l'étape 1 ; modèle MCC, Faire vérifier, verrouillage, professeur virtuel TP1, solutions, persistance, Diagnostic R1 à R4, symboles de l'IDE, protocole du Worker étendu.

## Derniers résultats (bloc B6, après le dernier changement)

- Tests : `npx vitest run` → 415 réussis, 1 ignoré (F9 : énoncé non transcrit), 0 échec.
- TypeScript (`tsc -p tsconfig.app.json`) : 0 erreur.
- Build (`npm run build`) : 0 erreur, 0 warning. Chaque commit vérifié dans un worktree propre (sans le travail ENER3 non commité).
- oxlint : 26 avertissements avant l'étape 2 et 26 après, tous préexistants hors INFO3 ; 0 dans src/info3, src/pages/info3, src/data, scripts/check-375.mjs ; 0 erreur.
- 375 px strict (B5) : 28 routes conformes (/info3, /info3/tp1, /info3/libre, /info3/dev compris).
- Parcours navigateur /info3/tp1 : MCC LED_D2/RA4 + Generate, code 3.3 + Build (BUILD SUCCESSFUL), Faire vérifier, USB noir, Program, D2 à 1 Hz, 3.3 validée (période 1 000 ms), carte refusée sous tension ; 0 erreur console ; 0 tâche longue (> 50 ms) pendant l'exécution à ×1.

### Tailles gzip (C4, `vite build`)

| Chunk | Taille gzip | Budget |
| --- | --- | --- |
| Bundle initial (index-*.js) | 83,75 Ko (base 83,40 Ko : +0,35 Ko) | ≤ base + 3 Ko |
| /info3/tp1 hors éditeur (page, Workbench, banc, projet, références) | 31,3 Ko | — |
| Worker (compilateur, VM, professeur) | 40,5 Ko | — |
| /info3/tp1 hors éditeur, Worker compris | 71,8 Ko | ≤ 150 Ko |
| MCC (Mcc.tsx, à l'ouverture) | 2,8 Ko propre (16,4 Ko avec ses dépendances partagées) | — |
| CodeMirror (CodeEditor, à l'affichage de l'éditeur) | 107,2 Ko (142,5 Ko avec lang-cpp) | ≤ 120 Ko |

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

- `INFO3_Cours.pdf` absent : les extraits du cours cités par la consigne (p. 85 à 110 pour le TP5) ne sont pas vérifiables dans le dépôt ; le code généré qui en dépend porte une hypothèse (H42, H43…).
- Énoncé : transcription fournie par l'utilisateur, copiée dans `docs/info3/enonce.md` à l'étape 5 (R1) ; C1 levée.
- Les fichiers MCC réels ont été trouvés dans `Downloads/TP1.X` (projet MPLAB X) et copiés octet pour octet dans `docs/sources/mplab/tp1/`.
