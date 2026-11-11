# PRD — Simulateur INFO3 Curiosity HPC

Nov 5, 2026 · @Youssef

## Décisions de départ

Le simulateur INFO3 devient le module `/info3` de TP-Sim. Il contient une carte Curiosity HPC virtuelle, un IDE façon MPLAB X avec un MCC restreint, un interpréteur C, les TP1 à TP6 et un mode libre hors TP. Il est livré en 7 étapes.

| Sujet | Décision | Pourquoi |
| --- | --- | --- |
| Exécution du code | Un sous-ensemble de C interprété dans le navigateur, dans un Web Worker | XC8 ne tourne pas dans un navigateur. Le simulateur GEII de l'an dernier (PIC16F1789) oblige à compiler un .elf dans MPLAB X |
| Code MCC | « Generate » écrit du vrai C (`pin_manager.c`, `tmr2.c`…), exécuté par le même interpréteur | Une seule source de vérité, les registres. Les erreurs de configuration (ANSEL, PEIE, mode SPI) se manifestent d'elles-mêmes, sans règle écrite à la main |
| Périmètre MCC | Seulement les 11 modules utilisés en TP, avec les intitulés MCC Classic | Recopier le reste ne rapporte aucun point et multiplie les bugs |
| Découpage | 7 étapes au lieu de 5 | 6 TP plus un socle lourd : en 5 étapes, les rapports de Claude Code deviendraient impossibles à vérifier |
| Attendus | Les points « Faire valider » et « Faire vérifier » de l'énoncé, plus le compte rendu de la page 4 | Aucune grille officielle n'a été fournie |
| Mode libre | Projet vierge, toutes les ressources, aucune question, garde-fous actifs | S'entraîner hors des TP |
| Intégration | Route `/info3` chargée à la demande. Réutilise `src/lib` (notation, examen, progression, oscilloscope) | Ne change pas le poids d'ENER3 ni de MODBUS |

## 1. Cadrage

On garde tout ce que l'étudiant touche en séance : le code C, les menus MCC, la carte et les cartes filles, le débogueur, l'oscilloscope et le terminal. On coupe tout ce qui ne rapporte aucun point et crée des bugs.

| On garde | On coupe |
| --- | --- |
| Carte Curiosity HPC : LED D2 à D5, S1, S2, potentiomètre, mikroBUS 1 et 2, 2 prises USB | Exécution au cycle près, jeu d'instructions, assembleur, désassemblage |
| Carte fille GEII (joystick, LED RGB), Rotary O click (EC12D + anneau de 16 LED), 8x8 R click (MAX7219) | Compilation réelle avec XC8, chargement de .elf |
| Éditeur C multi-fichiers (`main.c`, `LED8x8.c/.h`), Build, « Make and Program Device », fenêtre Output | Le C complet : `malloc`, unions, `goto`, varargs utilisateur, plusieurs unités de compilation réelles |
| MCC Classic : System Module, Pin Manager (Grid View et table Pin Module), Interrupt Module, TMR2/4/6, MSSP1 en SPI, CCP1 en PWM, PWM6/7, ADCC, EUSART | Les autres modules MCC (CLC, NCO, CWG, DAC, comparateurs, I2C, DMA), MCC Melody, bits de configuration, PPS modifiable |
| Débogueur « on hardware » : **un seul point d'arrêt**, pas à pas, variables, registres | Watchdog, SLEEP, EEPROM, Flash, consommation électrique |
| Oscilloscope 2 voies (SCK et MOSI, PWM, rebonds), terminal série (`printf`) | Backend, comptes, IA, synchronisation cloud |
| Questions de l'énoncé, mode examen, **mode libre** hors TP | Éditeur Monaco (2 à 3 Mo), remplacé par CodeMirror 6 chargé à la demande |

Les limites du C accepté sont détaillées en section 4. Tout code hors de ce périmètre affiche une erreur de compilation claire, avec numéro de ligne, comme XC8. Il ne doit jamais échouer sans rien dire.

## 2. Ce que fait le simulateur

L'étudiant refait chaque TP comme en salle. Il configure dans MCC, clique sur Generate, écrit `main.c`, lance « Make and Program Device » et observe la carte. Une question est validée par un banc de test automatique, le « professeur virtuel », qui rejoue un scénario de stimuli et compare au comportement attendu, calculé par les modèles.

### Socle commun à tous les TP

- **Banc** : carte Curiosity HPC vue de dessus, carte fille GEII toujours en place, deux emplacements mikroBUS, deux prises USB (noire : programmation et alimentation ; blanche : USB-UART de la carte fille).
- **IDE** : arborescence du projet, onglets `main.c` et fichiers ajoutés, fichiers MCC en lecture seule, boutons Build, Make and Program Device, Debug Main Project, Pause, Step Over, Step Into, Continue, Reset. En bas : fenêtres Output, Terminal série, Variables, SFR.
- **MCC** : Project Resources, Device Resources, Pin Manager (Grid View et table Pin Module), panneaux Easy Setup et Registers, bouton Generate. Generate écrit `mcc.h`, `mcc.c`, `pin_manager.c/.h`, `interrupt_manager.c/.h`, `tmr2.c`… à partir de la configuration.
- **Instruments** : oscilloscope 2 voies avec sondes à placer sur les points de test de la carte fille (TP16 MOSI, TP17 SCK, TP10 à TP12 RGB, TP19 et TP20 ENC\_A et ENC\_B), terminal série, inspecteur d'interruptions (GIE, PEIE, IE, IF par source).
- **Manipulations physiques** : brancher les USB, enficher une carte Click sur un mikroBUS, poser le cache sur la LED RGB, appuyer sur S1 et S2 (clic court, maintien, appui « propre » sans rebond en mode libre seulement), tourner l'encodeur cran par cran ou en continu, bouger le joystick, tourner le potentiomètre.
- **Verrouillage sous tension** : avec l'USB noir branché, impossible d'enficher ou de retirer une carte Click. Une tentative est refusée, et comptée en pénalité en mode examen.
- **Faire vérifier** : obligatoire avant la première mise sous tension de chaque TP. Le professeur virtuel contrôle les cartes Click et leur emplacement, les USB et la configuration MCC (broches, noms, IOC, périphériques). Un échec liste ce qui ne va pas (sauf en examen, où seul le nombre d'erreurs s'affiche).

### Mode libre encadré

Mode libre = projet vierge, hors de tout TP : toutes les ressources MCC, toutes les cartes Click, tous les instruments, aucune question ni note. Il est accessible depuis l'accueil de `/info3`. « Encadré » signifie trois choses :

1. Les mêmes règles physiques s'appliquent : verrouillage sous tension et erreurs reproduites.
2. Un panneau **Diagnostic** signale les incohérences lisibles dans les registres, sans corriger le code. Exemples : « IOC configuré sur RB4 mais GIE = 0 », « TMR2IE = 1 mais PEIE = 0 », « RB4 lue en numérique avec ANSB4 = 1 », « carte Rotary sur le mikroBUS 1 ».
3. Il propose 6 projets de départ (un par TP, configuration MCC seulement) et un projet vide. Plusieurs projets sont sauvegardés, avec export et import JSON.

### TP1 — Ports parallèles

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| System Module (horloge), Pin Module : RA4 en sortie nommée LED\_D2, puis RA4 à RA7 et RB4, RC5 en entrée (BP\_S1, BP\_S2), colonne Analog | LED D2 à D5, chronogramme des broches RA4 à RA7, contenu de `pin_manager.c` (TRISA, ANSELA…) | 3.1 broche de D2 ; 3.2 configuration et analyse de `pin_manager.h/.c` ; 3.3 clignotement 500 ms ; 3.4 D2 suit S1, justification ANSELx et TRISx |
| Code : variable `Chenille`, masque `PORTA = (PORTA & 0x0F) \| (Chenille << 4)` | Chenillard 1 LED vers la gauche, 1 s par pas | 3.5 chenillard 4 bits (« Faire valider ») |
| Fonctions `Decale_Droite`, `Decale_Gauche`, puis `Rotate_Right_4Bits(uint8_t *)`, `Rotate_Left_4Bits(uint8_t *)` | Sens qui suit S1 maintenu ou relâché | 3.6 bidirectionnel ; 3.7 pointeurs, variable locale `Motif` |
| Cahier des charges §4 : saisie du motif bit par bit (S1 bascule, S2 valide), tempo 500 ms, 1 s ou 2 s par S2, `n × __delay_ms(100)` | Saisie D2 → D5, décalage, changement de tempo mesuré à l'oscilloscope | 4.1 architecture ; 4.2 code ; 4.3 clignotements bonus (« Faire valider ») |

### TP2 — Interruptions IOC et encodeur

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| IOC « negative » sur RB4 et RC5, `IOCBF4_SetInterruptHandler`, `IOCCF5_SetInterruptHandler`, ligne `INTERRUPT_GlobalInterruptEnable()` à décommenter | Compteur 4 bits sur D5 à D2, sauts de 2 dus aux rebonds de S1 | 1.1 compteur, « quelle(s) ligne(s) décommenter » ; 1.2 cheminement `INTERRUPT_InterruptManager` → `PIN_MANAGER_IOC` → `IOCBF4_ISR` → handler |
| Carte Rotary sur le mikroBUS 2, ENCA (RD1) et ENCB (RA2) en entrée | ENCA sur D3, ENCB sur D2, positions stables 00 et 11 | 2.1 datasheet EC12D ; 2.2 recopie sans IOC |
| IOC « any » sur RA2 (pas d'IOC sur le port D) | D3 = sens de rotation, D2 suit ENCB | 2.3 sens CW ou ACW ; 2.4 compteur incrémenté ou décrémenté par l'encodeur |

### TP3 — Timer 2

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| TMR2 « Roll over pulse », source, prescaler, postscaler, période, « Enable Timer Interrupt », PEIE | Alternance des motifs 0011 et 1100 sur D5 à D2 ; période réelle mesurée (et non la période souhaitée) | 1 interruption périodique 1 s |
| TMR2 en Monostable, Ext Reset Source = broche RC5, « Starts on falling edge », LFINTOSC, période 10 ms | S1 saute parfois de 2, S2 jamais ; chronogramme BP\_S2 + IT Timer2 | 2 anti-rebond 10 ms sur S2 |
| Débogueur : un seul point d'arrêt, placé dans l'ISR IOC puis dans l'ISR Timer2 | Arrêt sur la ligne, variable `cpt`, registres | 3 test en debug (annexe 7) |

### TP4 — SPI et anneau de 16 LED

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| MSSP1 en SPI Master, mode 0 à 3 (CKP, CKE), horloge Fosc/4, /16, /64, TMR2/2 ou SSPADD, `SPI1_Open`, `SPI1_WriteByte` | SCK et MOSI à l'oscilloscope, période de SCK mesurée avec les curseurs, octet 0b00110001 envoyé toutes les 100 ms | 1 période SCK conforme ; ordre d'envoi des bits (MSB en premier) |
| Rotary sur le mikroBUS 2 : RST = RD2, LATCH = RD3, `SPI1_ExchangeByte` | Motif 00110001 sur les LED 1 à 8 de l'anneau | 2 « quel devra être le mode de la SPI » |
| `led_ring_clear()`, `led_ring_display16(uint16_t)` : deux octets puis un front sur LATCH | 16 LED mises à jour en même temps | 3 fonctions et motifs de test |
| `__delay_ms(1000)` | 1 LED qui tourne de la 1 à la 16 | 4 chenillard |
| Encodeur du TP2 + anneau | La LED de l'anneau suit le codeur, compteur 4 bits sur D5 à D2 | 5 suivi de position |
| Animation | 0xF0F0 qui tourne en boucle, puis une animation au choix | 6 animations |

### TP5 — PWM, UART et LED RGB

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| TMR2 source Fosc/4, PR2 = 0xFF, période d'environ 4 ms ; PWM6 → R (RD4), PWM7 → G (RC0), CCP1 → B (RC1) ; EUSART avec « Redirect STDIO to USART » ; 2 USB branchés ; cache sur la LED | Couleur de la LED, 3 signaux PWM à l'oscilloscope (TP10 à TP12), terminal `(R,G,B) = (255,0,0)` | 1 rouge + affichage |
| `typedef struct rgb_color_t`, `RGBL_SetColor` (rapport cyclique sur 10 bits) | Rouge, bleu électrique (44, 117, 255), fuchsia (253, 63, 146), la structure affichée chaque seconde | 2 struct et couleurs |
| IOC sur S1 et S2, `enum state_t {SET_RED, SET_GREEN, SET_BLUE}`, LED D5, D4, D3 = état | S2 change d'état, S1 incrémente de 16 | 3 machine à états, `IncrementCurrentColor` |
| Encodeur + SPI anneau, `DecrementCurrentColor` | La couleur suit l'encodeur | 4 ensemble (« Faire vérifier le bon fonctionnement ») |

### TP6 — CAN, joystick et matrice 8x8

| Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- |
| ADCC : POT (RA0), JOY\_HORZ (RD5), JOY\_VERT (RD6), VREF = VDD, TAD > 1 µs, alignement à droite ; EUSART + printf | Valeurs brutes et en %, joystick au repos décentré | 1.1 « Que constatez-vous ? » ; 1.2 calibration ; 1.3 `Joy_Cal_X`, `Joy_Cal_Y` |
| ADCC sous interruption + TMR2 à 10 ms, `ADCC_StartConversion`, `ADCC_GetConversionResult`, section critique | X puis Y toutes les 10 ms, affichage chaque seconde ; valeur incohérente sans section critique | 2 CAN sous interruption |
| 8x8 R sur le mikroBUS 1 (CS = RA3), bibliothèque `LED8x8.c/.h` : `LED8x8_Write`, `LED8x8_Initialize`, `LED8x8_Clear`, `blank_100ms` | Colonnes puis lignes toutes les 200 ms, diagonale 5 fois, motif `Tab[8]`, motif personnel | 3 MAX7219 |
| Seuils sur -512 à +511 vers des positions de -3 à 3 | Carré de 2x2 LED qui suit le joystick | 4 joystick + matrice |

### Accueil `/info3`

Il n'y a pas d'attendus officiels. L'accueil liste donc les 10 points de validation A1 à A10 de l'énoncé et du compte rendu (section 3.6), chacun relié aux questions qui le couvrent. Une ligne non couverte reste affichée en rouge.

## 3. Valeurs de référence

Toutes ces valeurs vivent dans `src/data/reference.ts` et nulle part ailleurs. Sources : « CR » pour tes comptes rendus TP1 à TP3, « énoncé », « cours » (avec la page), « annexe » (schémas du fascicule TP), « calcul » (déduit d'une formule et d'une valeur sourcée), « hypothèse » (inventaire en 3.8).

### 3.1 Brochage

| Signal | Broche PIC | Niveau actif et câblage | Source |
| --- | --- | --- | --- |
| LED D2, D3, D4, D5 | RA4, RA5, RA6, RA7 | 1 = allumée, 1 kΩ | annexe 1, CR TP1 |
| S1 / S2 | RB4 / RC5 | 0 = appuyé, tirage 10 kΩ + 1 kΩ série | annexe 1, CR TP3 |
| Potentiomètre POT | RA0 | 0 à VDD, 1 kΩ série | annexe 1 |
| JOY\_HORZ / JOY\_VERT / JOY\_SW | RD5 / RD6 / RA1 | SW : 0 = appuyé, tirage 10 kΩ | annexe 2 |
| RGB\_R / RGB\_G / RGB\_B | RD4 / RC0 / RC1 | 1 = allumée (transistor PDTC114, LED à anode commune sur +5 V) ; R4 220 Ω, R3 75 Ω, R2 680 Ω | annexe 2 |
| UART TX / RX | RC6 / RC7 | vers le FTDI232RL (USB blanc) | annexe 2 |
| mikroBUS 1 | AN RA1, RST RD0, CS RA3, SCK RB1, MISO RB2, MOSI RB3, PWM RC2, INT RB5, RX RC7, TX RC6, SCL RC3, SDA RC4 | bus SPI partagé avec le mikroBUS 2 | annexe 1 |
| mikroBUS 2 | AN RA2, RST RD2, CS RD3, SCK RB1, MISO RB2, MOSI RB3, PWM RD1, INT RB0, RX RC0, TX RC1, SCL RC3, SDA RC4 | — | annexe 1, cours p. 78 |
| Rotary sur mikroBUS 2 | ENCB = RA2, ENCA = RD1, SW = RB0 (rappel au 0 V 10 kΩ sur la carte fille), RST 74HC595 = RD2, LATCH = RD3 | ENCA sur le port D : **pas d'IOC possible** | cours p. 34 et 78, annexe 3 |
| 8x8 R sur mikroBUS 1 | CS (LOAD) = RA3, CLK = RB1, DIN = RB3 | — | annexe 5, annexe 2 |

### 3.2 Horloges

| Grandeur | Valeur | Source |
| --- | --- | --- |
| Fosc par défaut | 4 MHz (HFINTOSC 4 MHz, diviseur 1 ; Tcy = 1 µs) | fichiers MCC réels du TP1 : OSCCON1 = 0x60, OSCFRQ = 0x02, \_XTAL\_FREQ = 4000000 (H1 réfutée ; le CR TP3 suppose 1 MHz, à vérifier sur le projet TP3) |
| LFINTOSC | 31 kHz | CR TP3 : la plage MCC 64,516 µs à 16,516 ms vaut exactement 2/31 kHz et 512/31 kHz |
| Champ « Clock Frequency » grisé dans MCC | 32,768 kHz affiché mais non utilisé | CR TP3, cours p. 64 (« piège à éviter ») |
| `_XTAL_FREQ` | égal à Fosc, régénéré par Generate | cours p. 16 |
| `__delay_ms(n)` | n doit être une constante, sinon erreur de compilation | cours p. 16, énoncé TP1 §4 |

### 3.3 Formules des modèles

```latex
T_{TMR2} = \frac{(PR2+1)\cdot N_{pre}\cdot N_{post}}{f_{clk,TMR2}}
```

```latex
T_{PWM} = \frac{(PR2+1)\cdot 4 \cdot N_{pre}}{F_{osc}} \qquad \alpha = \frac{DC_{10\,bits}}{4\,(PR2+1)}
```

```latex
f_{SCK} \in \left\{\frac{F_{osc}}{4},\frac{F_{osc}}{16},\frac{F_{osc}}{64},\frac{F_{osc}}{4\,(SSPADD+1)}\right\} \qquad baud = \frac{F_{osc}}{4\,(SPBRG+1)}\ (BRG16 = BRGH = 1) \qquad q = \frac{V_{REF}}{1024}
```

### 3.4 Valeurs de référence calculées

| Grandeur | Valeur | Source |
| --- | --- | --- |
| TMR2 1 s, Fosc/4 = 250 kHz, 1:128, 1:16 | PR2 = 121 → 0,99942 s | calcul |
| TMR2 avec le PR2 = 122 du CR | 1,00762 s | CR + calcul |
| Monostable du CR : LFINTOSC, 1:2, 1:1 | PR2 = 154 → 10,000 ms | CR (capture MCC) + calcul |
| Monostable du calcul à la main du CR : Fosc/4, 1:16, PR2 = 156 | 10,048 ms | CR + calcul |
| PWM TP5 : Fosc 1 MHz, PR2 = 255 | 1:4 → 4,096 ms (244 Hz) | énoncé (« environ 4 ms ») + calcul ; prescaler = H8 |
| Rapport cyclique pour une couleur 255 | 255 << 2 = 1020 → 99,6 % | énoncé + calcul |
| SCK en Fosc/4 | 250 kHz, période 4 µs | cours p. 73-74 + calcul |
| UART 9600 bauds, Fosc 1 MHz | SPBRG = 25 → 9615 bauds (+0,16 %) | calcul ; 9600 = H6 |
| Quantum du CAN, VREF = VDD = 3,3 V | 3,22 mV | cours p. 97 + calcul ; VDD = H5 |
| EC12D | 15 impulsions et 30 crans par tour ; positions stables A = B | CR TP2, annexe 4 |
| Rebonds | durée inférieure à 10 ms | énoncé TP3 |
| Chaîne des 74HC595 | SDI → U2 (LED 1 à 8, Q0 = LED 1) → Q7S → U3 (LED 9 à 16) → SDO ; MSB en premier, verrouillage sur front de LATCH | annexe 3, cours p. 81 |
| MAX7219 | trame 16 bits MSB en premier, verrouillage au front montant de LOAD ; registres 0x01-0x08 = DIG0-DIG7, 0x09 décodage, 0x0A intensité, 0x0B scan limit, 0x0C shutdown, 0x0F test ; au démarrage en mode shutdown | annexe 5 ; détail des registres = H11 |

**Correction après les fichiers MCC réels du TP1 (Fosc = 4 MHz).** Les lignes ci-dessus calculées à 1 MHz restent valables comme cas de test à Fosc = 1 MHz. Pour le réglage par défaut de 4 MHz :

| Grandeur | Valeur à Fosc = 4 MHz | Source |
| --- | --- | --- |
| TMR2 en Fosc/4 | période maximale 256 × 128 × 16 µs = 524 ms : 1 s est impossible, il faut LFINTOSC ou MFINTOSC | calcul |
| TMR2 du TP3 avec T2PR = 0x1E | au plus 63,5 ms (31 × 128 × 16 µs) : la capture du CR montre T2CLKCON = 0x01, donc Fosc/4, et 1 s est impossible. Correct : LFINTOSC, 1:128, 1:1, T2PR = 241 → 0,99923 s (comme l'exemple TMR4 du cours p. 65) | CR (capture tmr2.c) + calcul |
| PWM TP5, PR2 = 255 | 1:16 → 4,096 ms | calcul |
| SCK en Fosc/4 | 1 MHz, période 1 µs | calcul |
| UART 9600 bauds, BRG16 = BRGH = 1 | SPBRG = 103 → 9615 bauds (+0,16 %), identique au cours p. 108 | cours + calcul |

### 3.5 Comportements tirés de tes CR (fixtures de test)

Ton propre code des CR est copié dans `src/info3/fixtures/cr/`. Il doit compiler et donner exactement ces résultats, erreurs comprises.

| Fixture | Résultat attendu | Tolérance | Source |
| --- | --- | --- | --- |
| TP1 3.3 `LED_D2_Toggle` + `__delay_ms(500)` | D2 de période 1,000 s | ± 0,5 % | CR |
| TP1 3.5 chenillard | D2 → D3 → D4 → D5 → D2, 1 pas par 1,000 s | ± 0,5 % | CR |
| TP1 3.7 | S1 relâché : décalage vers la gauche, alors que la fonction appelée s'appelle `Decale_Droite` | exact | CR |
| TP1 §4 `Tempo[3] = {2, 10, 20}` | 200 ms, 1 s, 2 s ; tempo après la saisie = 1 s si S2 est encore appuyé au 4e bit | ± 0,5 % | CR + analyse |
| TP2 1.1 compteur IOC | Appui sur S1 avec rebonds : +2 au lieu de +1 (graine fixée pour le test) | exact | CR TP3 (« saut de 2 LEDS ») |
| TP3 1 avec PR2 = 122 | période 1,00762 s | ± 0,1 % | CR + calcul |
| TP3 1 avec T2PR = 0x1E de la capture | période 0,254 s | ± 0,1 % | CR + calcul |
| TP3 2 anti-rebond | S2 : exactement –1 par appui sur 100 appuis avec rebonds | exact | CR |

### 3.6 Points de validation (à la place des attendus officiels)

| # | Point | Questions qui le couvrent |
| --- | --- | --- |
| A1 | TP1 3.5 « Faire valider par l'enseignant » | TP1 3.5 |
| A2 | TP1 §4.3 « Faire valider par l'enseignant » | TP1 4.1, 4.2, 4.3 |
| A3 | TP5 §4 « Faire vérifier le bon fonctionnement de l'ensemble » | TP5 4 |
| A4 | CR : code archivé et commenté | tous les défis de code |
| A5 | CR : captures MCC commentées | TP3 1 et 2, TP4 1, TP5 1, TP6 1 (justifier chaque réglage) |
| A6 | CR : registres de configuration générés | TP1 3.2 et 3.4 (ANSELx, TRISx), TP3 1 (T2CON, T2PR), TP4 1 (SSP1CON1) |
| A7 | CR : fonctions générées | TP2 1.2, TP4 2 (`WriteByte` contre `ExchangeByte`), TP6 2 (bloquant contre non bloquant) |
| A8 | CR : tests effectués et leur issue | TP2 1.1, TP3 2, TP4 1, TP6 1.1 |
| A9 | Séance : structure du programme | TP1 4.1 (organigramme), TP5 3 (machine à états) |
| A10 | Séance : chronogrammes archivés | TP2 2.2 et 2.3, TP3 2, TP4 1 |

### 3.7 Valeur apparente et paramètre réel

| Ce que l'étudiant voit (apparent) | Ce que le modèle utilise (réel) |
| --- | --- |
| « Timer Period : 1 s » saisi dans MCC | « Actual Period » calculé avec PR2+1 |
| « Clock Frequency 32,768 kHz » grisé | LFINTOSC = 31 kHz |
| Joystick « à 0 » après calibration | valeur brute au repos (H4), différente de 512 |
| Couleur « 255 = 100 % » | 1020 / 1024 = 99,6 % |
| Nombre de rebonds comptés au point d'arrêt | nombre réel de fronts, visible à l'oscilloscope |
| « SCK = 250 kHz » | 8 fronts à 4 µs, puis un silence entre deux octets |
| Période « 500 ms » d'un `__delay_ms(500)` | 500 ms + temps d'exécution du code de la boucle (H2) |

### 3.8 Hypothèses (toutes affichent le badge « valeur non vérifiée »)

| Id | Hypothèse | Pour la vérifier |
| --- | --- | --- |
| H1 | Fosc par défaut = HFINTOSC 4 MHz divisé par 4 | System Module au prochain TP |
| H2 | Une instruction C élémentaire coûte 4 Tcy en moyenne | ordre de grandeur, sans impact sur les réponses |
| H3 | 30 % des appuis rebondissent : 1 à 4 rebonds sur 0,3 à 3 ms | oscilloscope sur TP17 et S1 en TP |
| H4 | Joystick au repos : X = 498, Y = 530 (brut) | relever les valeurs au TP6 |
| H5 | VDD = 3,3 V (cavalier J12) | cavalier J12 |
| H6 | UART 9600 bauds 8N1 | réglage MCC au TP5 |
| H7 | Horloge SPI par défaut Fosc/4 | réglage MCC au TP4 |
| H8 | Prescaler PWM 1:4 | réglage MCC au TP5 |
| H9 | Sens horaire = ENCA en avance sur ENCB (d'après le chronogramme du CR TP2) | annexe 4 |
| H10 | LED 1 de l'anneau en haut, numérotation dans le sens horaire | photo de la carte Rotary |
| H11 | Matrice : DIG0 = colonne de droite, segment DP = ligne du haut ; détail des registres MAX7219 (annexe 6 non exploitée) | annexe 6 |
| H12 | Sans USB blanc, `printf` n'affiche rien ; LED RGB alimentée par le 5 V de l'USB noir | TP5 |
| H13 | Débogueur à l'arrêt : temps figé, un appui pendant l'arrêt mémorise un seul flag IOC | TP3 §3 |
| H14 | SPI en mode 1 ou 2 avec le 74HC595 : motif décalé d'un rang | TP4 2 |
| H15 | Messages d'erreur imitant XC8 (texte approché) | MPLAB X |
| H16 | Apparence et couleurs de la carte Curiosity et des cartes Click | photos du banc |
| H17 | Couleur affichée de la LED RGB = rapports cycliques pondérés, sans calibration colorimétrique | TP5 |

Ajoutées après l'étape 1 : **H18** adresses SFR du datasheet hors PORTA = 0x00C ; **H19** valeurs au reset autres que TRISx, ANSELx et LATx ; **H20** entrée flottante sans pull-up lue à 0 ; **H21** division entière par zéro : quotient 0, reste = dividende ; **H22** un `main()` qui se termine arrête le programme ; **H23** dans Pin Module, « Analog » est coché par défaut pour une entrée GPIO et décoché pour une sortie (à vérifier en priorité : c'est ce qui rend possible le piège ANSEL).

Après les fichiers MCC réels du TP1 (MCC 1.81.7, XC8 2.31, MPLAB X 5.45) : **H1 réfutée** (Fosc = 4 MHz) ; **H24 réfutée** (SLRCONx et INLVLx sont générés) ; **H18 en partie vérifiée** (codage d'OSCCON1 et d'OSCFRQ). Nouvelles : **H26** l'ordre des registres dans `pin_manager.c` (LATE, LATD, LATA…) est le même pour tous les projets ; **H27** `__XC8_VERSION` = 2310 ; **H28** Timer2 du TP3 sur LFINTOSC avec T2PR = 0x1E.

Après relecture des captures du CR TP3 : **H28 réfutée** (T2CLKCON = 0x01, Fosc/4). Fait vérifié : le Pin Manager de MCC est en boîtier **UQFN40** (RA0 → broche 17…) avec les lignes OSC CLKOUT, Pin Module GPIO input/output, RESET MCLR et TMR2 T2IN. Nouvelles : **H30** structure d'`interrupt_manager.c` quand IOC et TMR2 coexistent (le cours ne montre que chacun seul) ; **H31** T2HLT = 0x12 pour « Starts on falling edge » ; **H32** parties de `tmr2.c` absentes du cours (fonctions Start, Stop, Read…).

## 4. Modèles de simulation

Tout part des registres. Le code C (le tien et celui généré par MCC) écrit dans des SFR simulés, et les périphériques réagissent à ces SFR. Aucun comportement n'est codé en dur pour un TP : une erreur de configuration produit le même symptôme qu'en salle, parce que le registre fautif est le même.

### 4.1 Le compilateur C

Il suit XC8 v2 là où les TP en dépendent. La chaîne est : préprocesseur → analyse lexicale → analyseur syntaxique à descente récursive → vérification des types → bytecode. Elle est écrite en TypeScript, sans dépendance.

- **Préprocesseur** : `#include` (fichiers du projet, fichiers MCC, plus `xc.h`, `stdint.h`, `stdbool.h` et `stdio.h` fournis), `#define` objet et fonction, `#ifndef`/`#endif`, `#if 0`.
- **Types** : `char` (non signé par défaut, comme XC8), `int` sur **16 bits**, `long` sur 32 bits, `uint8_t` à `int32_t`, `bool`, `float` sur 32 bits, `void`, `struct`, `typedef`, `enum`, champs de bits, tableaux à 1 et 2 dimensions, pointeurs (y compris vers struct et vers fonction), `const`, `volatile`, `static`, `extern`.
- **Instructions** : toutes les expressions (opérateur ternaire, cast, `sizeof`), `if`, `while`, `do`, `for`, `switch`, `break`, `continue`, `return`, prototypes, plusieurs fichiers `.c` liés ensemble.
- **Spécifique PIC** : `__interrupt()`, `__delay_ms()` et `__delay_us()` avec une constante obligatoire, `NOP()`, `printf` (`%d %u %x %X %c %s %ld %lu %f %%`, largeur de champ) redirigé vers l'EUSART.
- **Refusé, avec un message clair** : `malloc`, `goto`, unions, fonctions variadiques écrites par l'étudiant. `float` ou `printf` dans une ISR : warning, comme le recommande le cours p. 36.
- **Messages** : au format `main.c:12:5: error: ...` de XC8 v2 (front-end Clang), texte approché (H15). Erreurs de liaison incluses : « définition multiple », « non défini ».

### 4.2 La machine virtuelle et le temps

- **Bytecode à pile**, chaque opération avec un coût en Tcy (H2). Le temps simulé avance à chaque opération ; `__delay_ms(n)` avance exactement n ms.
- **SFR mémorisés aux adresses du PIC16F18875**. Chaque lecture ou écriture appelle le modèle du périphérique concerné.
- **Variables `volatile` sur 16 bits** lues et écrites en deux accès de 8 bits. Une interruption peut donc tomber entre les deux octets, comme sur le vrai PIC (TP6 §2).
- **Interruptions** testées entre deux opérations. La condition est GIE ET (IF·IE d'une source de premier niveau en PIE0, ou PEIE ET IF·IE d'un périphérique). L'entrée en ISR remet GIE à 0 et le retour le remet à 1. Latence : 3 à 5 Tcy.
- **Pile matérielle de 16 niveaux**, ISR comprise. Un débordement provoque un reset (STKOVF), affiché dans l'Output.
- **Événements datés** dans une file de priorité : fronts des boutons et rebonds, crans de l'encodeur, correspondance du timer (calculée directement, sans compter tick par tick), fin de conversion, octet UART émis. Le compteur TMRx est recalculé à partir du temps écoulé quand le code le lit.
- **Exécution par tranches** dans le Worker : au maximum 2 ms simulées ou 50 000 opérations par tranche. Vitesses : ×0,1, ×1 (temps réel, par défaut), ×10 et pause.
- **Débogueur** : un seul point d'arrêt à la fois (annexe 7). Poser un second point d'arrêt remplace le premier, avec un avertissement. À l'arrêt, le temps est figé et un appui mémorise un seul flag (H13).

### 4.3 Périphériques et composants

Chaque modèle est une fonction pure ou un petit état avec une transition pure, dans `src/info3/models/`, testé sans React ni Worker.

| Modèle | Comportement | Ce qu'il doit reproduire |
| --- | --- | --- |
| `gpio` | Niveau de broche = LAT si TRIS = 0, sinon le niveau imposé par le composant externe ; lecture du PORT = 0 si ANSEL = 1 ; WPU, ODCON | Bouton jamais vu à cause d'ANSEL ; différence PORT/LAT (cours p. 9) |
| `ioc` | Détection de front par broche selon IOCxP/IOCxN ; met IOCxF et IOCIF à 1 ; aucune IOC sur le port D | IOC impossible sur ENCA (RD1) |
| `timer246` | Modes 0 (Roll over pulse) et 17 à 19 (Monostable, ERS = broche, départ sur front montant, descendant ou les deux ; le CR TP3 utilise le front descendant) ; sources Fosc/4, Fosc, HFINTOSC, LFINTOSC 31 kHz ; prescaler 1 à 128, postscaler 1 à 16 ; TMR2IF dans PIR4 | +1 de PR2 oublié ; LFINTOSC à 31 kHz ; PEIE oublié |
| `mssp-spi` | Maître, modes CKP/CKE, horloge choisie, MSB en premier ; `WriteByte` sans attente (WCOL si le registre est occupé), `ExchangeByte` attend BF ; fronts datés envoyés à l'oscilloscope | Ordre des bits, période SCK, collision |
| `hc595x2` | Décalage au front montant de SCK (si MOSI change sur ce même front, l'ancien bit est lu : H14) ; MR (RD2) à 0 vide le registre ; front montant de LATCH (RD3) → sorties | Mauvais mode SPI, LATCH oublié, ordre des 2 octets |
| `max7219` | Décale seulement si LOAD (RA3) = 0 ; verrouille 16 bits au front montant ; shutdown au démarrage ; intensité ; scan limit ; display test | Matrice éteinte sans initialisation ; octets inversés |
| `pwm` | CCP1, PWM6 et PWM7 sur TMR2 (Fosc/4 obligatoire) ; rapport cyclique 10 bits ; broche choisie dans Pin Manager | Rapport cyclique non multiplié par 4 (LED à 25 % au maximum) ; mauvaise source du timer |
| `rgbLed` | Couleur affichée = rapports cycliques pondérés (H17), éblouissement sans le cache | — |
| `eusart` | Baud = Fosc / (4·(SPBRG+1)) ; 1 octet = 10 bits datés ; le terminal affiche seulement si l'USB blanc est branché et si son baud est le même | Caractères illisibles si les bauds diffèrent ; rien sans l'USB blanc |
| `adcc` | 10 bits, alignement ADFM, temps de conversion 11,5 · TAD, voies POT, JOY\_HORZ, JOY\_VERT ; bruit de ±1 LSB (graine fixée) ; ADIF dans PIR1 | Joystick décentré (H4) ; TAD < 1 µs signalé par MCC |
| `ec12d` | 30 crans par tour, une transition de A et une de B entre deux crans, sens horaire = A en avance (H9) ; pas de rebond (filtres RC 22 kΩ / 10 nF, annexe 3) | Lecture des positions stables, détection du sens |
| `button` | Rebonds selon H3, aléa à graine fixée (reproductible dans les tests) | Saut de 2 sur S1 ; anti-rebond efficace sur S2 |
| `power` | USB noir = alimentation et programmation ; sans lui, carte éteinte et programme arrêté | — |

### 4.4 Erreurs de manipulation reproduites

| Erreur | Symptôme observé | Mécanisme |
| --- | --- | --- |
| `INTERRUPT_GlobalInterruptEnable()` laissé en commentaire | Aucune interruption | GIE = 0 |
| PEIE oublié avec TMR2, l'ADC ou l'UART | Le timer tourne mais l'ISR n'est jamais appelée | Condition de second niveau |
| Handler non enregistré (`SetInterruptHandler` oublié) | Le flag est remis à 0, rien ne se passe | Handler par défaut de MCC |
| `SetInterruptHandler` appelé avant `SYSTEM_Initialize()` | Le handler est écrasé par celui par défaut | Ordre réel des appels (cours p. 37) |
| Broche d'un bouton laissée en Analog | Le bouton lit toujours 0 | ANSEL = 1 |
| Rotary sur le mikroBUS 1, 8x8 sur le mikroBUS 2 | Encodeur muet, anneau ou matrice figés | Brochage 3.1 |
| Carte Click enfichée sous tension | Refusé ; pénalité en examen | Verrouillage |
| Mauvais mode SPI pour le 74HC595 | Motif décalé d'un rang | H14 |
| LATCH oublié ou envoyé avant les octets | Anneau inchangé ou en retard d'un motif | `hc595x2` |
| Octets de `led_ring_display16` inversés | Moitiés de l'anneau échangées | Ordre de la chaîne |
| Couleur 0 à 255 passée telle quelle en 10 bits | LED à 25 % au maximum | `pwm` |
| Variable 16 bits partagée sans section critique | Valeur aberrante de temps en temps (par exemple 0xFF00 = –256) | Lecture en deux octets (cours p. 37) |
| `__delay_ms(variable)` | Erreur de compilation | Énoncé TP1 §4 |
| `printf` sans USB blanc, ou bauds différents | Terminal vide ou illisible | `eusart` |
| Plus de 16 appels imbriqués, ISR comprise | Reset STKOVF | Pile matérielle |

### 4.5 Le professeur virtuel

- **Défi de code** : un scénario déclaratif (`stimuli` datés : appuis, crans, joystick ; `sondes` : broches, anneau, matrice, terminal) tourne en temps simulé accéléré. La trace obtenue est comparée à la trace attendue, produite par un modèle de référence en TypeScript (par exemple la séquence théorique du chenillard). Les tolérances sont celles de la section 7.
- **Question numérique** : réponse attendue calculée par les modèles à partir de la configuration de l'étudiant ou de l'énoncé (période SCK, PR2, quantum). Unité exigée, tolérance écrite dans la question.
- **Question d'analyse** (« justifier ANSELA », « quel mode SPI ») : choix multiples, avec comme leurres les erreurs typiques de la section 4.4 ; la correction cite la page du cours.
- **Réponses jamais écrites en dur** : chaque correction appelle un modèle. Une question qui dépend d'une hypothèse affiche le badge « valeur non vérifiée » avec l'identifiant Hx.

## 5. Architecture et performance

La simulation tourne entièrement dans un Web Worker. L'interface React ne fait qu'afficher l'état qu'il renvoie, et ne bloque donc jamais, même dans un `while(1)` sans délai.

&#91;embedded content: architecture · fil principal et Worker\]

(1) Le programme, ton code plus les fichiers générés par MCC, est compilé dans le Worker. (2) Les gestes sur le banc deviennent des événements datés. (3) Le Worker renvoie au plus 30 états par seconde au banc et aux instruments. (4) Le professeur virtuel rejoue ses scénarios dans ce même Worker.

### 5.1 Budget de poids et de calcul

- **Route `/info3` chargée à la demande** (`React.lazy`). ENER3 et MODBUS ne paient rien : le bundle initial du site augmente de 3 Ko gzip au maximum.
- **Une seule nouvelle dépendance** : CodeMirror 6 (`@codemirror/view`, `state`, `commands`, `language`, `lang-cpp`), chargé seulement à l'ouverture de l'éditeur. Pas de Monaco, pas de bibliothèque de parsing C, pas de Recharts dans `/info3` (l'oscilloscope est en canvas).
- **Worker** en module Vite (`new Worker(new URL(...), { type: 'module' })`). Messages différentiels : seules les broches et LED qui changent, et les échantillons de l'oscilloscope en `ArrayBuffer` transféré (sans copie).
- **Compilation mise en cache** par empreinte de fichier. Les en-têtes `xc.h` et MCC sont pré-analysés une seule fois par session.
- **Banc** : un seul SVG en ligne, lueur des LED par variable CSS, aucune image matricielle.
- **Générateur MCC** : fonctions TypeScript qui renvoient des chaînes, sans moteur de gabarits.

### 5.2 Organisation des fichiers

| Emplacement | Contenu |
| --- | --- |
| `src/data/reference.ts` | Toutes les constantes INFO3 : objet INFO3 défini dans reference.info3.ts et réexporté par reference.ts, seul point d'import (inline, il alourdissait ENER3 de 4,65 Ko gzip) ; un objet `INFO3` exporté à côté des constantes existantes |
| `src/data/questions.ts` | Questions INFO3 (`INFO3_QUESTIONS`) avec les intitulés exacts de `docs/info3/enonce.md`, et les points de validation A1 à A10 |
| `src/info3/compiler/`, `src/info3/vm/` | Compilateur et machine virtuelle, sans React |
| `src/info3/models/` | Modèles purs de la section 4.3 |
| `src/info3/mcc/` | Écrans MCC et générateur de fichiers C |
| `src/info3/board/`, `src/info3/ide/` | Banc SVG et IDE |
| `src/info3/worker/` | Point d'entrée du Worker et protocole de messages typé |
| `src/info3/fixtures/cr/` | Ton code des CR, copié tel quel |
| `src/lib/` | Réutilisé : oscilloscope, notation, examen, progression |
| `src/pages/info3/` | Accueil, pages TP, mode libre, examen |

## 6. Direction visuelle

Deux ambiances côte à côte : l'IDE et MCC copient MPLAB X pour que l'examen ne désoriente pas, et le banc garde l'établi sombre de TP-Sim.

- **IDE et MCC** : thème clair de MPLAB X, mêmes emplacements et mêmes libellés que sur tes captures. Dans Pin Module : colonnes Pin Name, Module, Function, Custom Name, Start High, Analog, Output, WPU, OD, IOC. Dans Timer : blocs Hardware Settings, Timer Clock, Timer Period, Software Settings. Dans Interrupt Module : colonnes Order, Module, Interrupt, Enabled. Le Pin Manager Grid View est en bas avec les cadenas. Un bouton bascule vers le thème sombre de MPLAB X.
- **Raccourcis** repris de ton CR TP1 : Ctrl+Espace pour compléter, Ctrl+clic pour aller à la définition, Source > Format pour indenter. S'y ajoutent F11 pour Build, Ctrl+F5 pour Debug et F5 pour Continue.
- **Banc** : carte Curiosity en SVG vectoriel vue de dessus, avec la sérigraphie (D2 à D5, S1, S2, POT, MODULE 1 et 2, J12). Cartes Click et câbles USB à glisser. La lueur d'une LED est proportionnelle à son rapport cyclique moyen sur l'image. L'apparence exacte reste à vérifier sur photos (H16).
- **Instruments** : oscilloscope 2 voies repris de `src/lib` (canvas, curseurs, déclenchement, de 1 µs/div à 1 s/div, décodage SPI en option) ; terminal en police à chasse fixe avec choix du débit et des fins de ligne ; inspecteur d'interruptions en tableau GIE, PEIE, IE, IF.
- **Écran étroit (375 px)** : 4 onglets (Code, MCC, Banc, Questions), aucun défilement horizontal de la page. Les tables MCC défilent dans leur propre cadre.
- **Mode examen** : chrono fixe en haut, aucun panneau Diagnostic, aucune infobulle d'aide.

## 7. Livraison en 7 étapes

Chaque étape se termine avec un build sans erreur ni warning, oxlint sans avertissement dans src/info3 et sans nouvel avertissement ailleurs (26 existants), tous les tests Vitest verts, le contrôle 375 px passé et aucune erreur dans la console du navigateur. Aucune tolérance n'est élargie pour faire passer un test : si deux critères se contredisent, on corrige le modèle ou ce PRD.

| Étape | Livrable | Critères d'acceptation chiffrés |
| --- | --- | --- |
| 1. Moteur | Compilateur C, VM, SFR, `gpio`, `button`, horloge et temps simulé, API du Worker ; `reference.ts` ; `docs/info3/enonce.md` (copie mot pour mot) ; aucune interface sauf une page technique | Les 4 fixtures du CR TP1 compilent. 3.3 : période de D2 = 1,000 s ± 0,5 %. 3.5 : séquence 1, 2, 4, 8 à 1,000 s ± 0,5 %. 3.7 : « relâché → gauche ». §4 : 200 ms, 1 s, 2 s ± 0,5 %. 12 programmes invalides donnent chacun l'erreur attendue, avec ligne et colonne. `__delay_ms(n)` avec une variable : erreur. 17 appels imbriqués : reset STKOVF. 10 s simulées du chenillard en moins de 300 ms sous Vitest |
| 2. Banc, IDE, MCC de base, TP1, mode libre v1 | Carte SVG, éditeur CodeMirror chargé à la demande, Build et Program, Output ; MCC System Module, Pin Manager, Pin Module, Generate ; questions TP1 ; Faire vérifier ; verrouillage ; mode libre (projet vide + Diagnostic) | LED\_D2 sur RA4 + BP\_S1 sur RB4 : `pin_manager.c` généré = cours p. 22 au caractère près (TRISA = 0xEF, TRISE = 0x07, ANSELA = 0xEF, ANSELB = 0xEF, ANSELC/D = 0xFF, ANSELE = 0x07). RB4 en Analog : S1 lu à 0 sur 100 appuis sur 100, donc D2 allumée en permanence avec le code 3.4. TP1 §4 du CR refusé avec « Tempo initiale : 500 ms attendu, 1 000 ms mesuré », version corrigée validée. Chunk `/info3` ≤ 150 Ko gzip hors éditeur, CodeMirror ≤ 120 Ko gzip, bundle initial du site augmenté de ≤ 3 Ko gzip. LED animées à 60 images/s |
| 3. TP2 + TP3 | `ioc`, `interrupt_manager` généré, `ec12d`, carte Rotary (partie encodeur), `timer246`, Interrupt Module, débogueur à un point d'arrêt, inspecteur d'interruptions | Graine fixée : S1 donne +2 au moins une fois sur 100 appuis, comme dans le CR. GIE en commentaire : 0 interruption. PEIE oublié : TMR2IF = 1 et 0 appel de l'ISR. Colonne IOC inactive sur le port D. TMR2 à Fosc = 1 MHz, 1:128, 1:16 : PR2 = 121 → 0,99942 s, PR2 = 122 → 1,00762 s (± 0,05 %). Monostable LFINTOSC 1:2 : 10,00 ms ± 0,5 %. « Actual Period » affiché = valeur du modèle. Anti-rebond S2 : 100 appuis avec rebonds donnent exactement –100. Un second point d'arrêt remplace le premier |
| 4. TP4 | `mssp-spi`, `hc595x2`, anneau de 16 LED, sondes de l'oscilloscope, décodage SPI | Fosc 4 MHz, Fosc/4 : période SCK mesurée aux curseurs = 1,00 µs ± 1 %. 0x31 lu MSB en premier sur MOSI. 0b00110001 → LED 1, 5 et 6 allumées. Mode 1 ou 2 : motif décalé d'un rang (H14). `led_ring_display16(0xF0F0)` + rotation : 16 positions par tour. La LED de l'anneau suit l'encodeur sur 30 crans |
| 5. TP5 | `pwm`, `rgbLed`, `eusart`, terminal, 2 USB, cache | Fosc 4 MHz, PR2 = 255, 1:16 : période PWM = 4,096 ms ± 0,5 %. Couleur 255 → rapport cyclique 1020/1024. Terminal = `(R,G,B) = (255,0,0)` à l'octet près. 9600 bauds → SPBRG = 103 (Fosc 4 MHz). Terminal à 19 200 bauds : caractères illisibles. Sans USB blanc : terminal vide. Machine à états : 3 appuis sur S2 ramènent à SET\_RED, +16 par appui sur S1 |
| 6. TP6 | `adcc`, joystick, potentiomètre, `max7219`, matrice, bibliothèque multi-fichiers | Joystick au repos : 498 et 530 ± 1 LSB (badge H4). Acquisition toutes les 10,0 ms ± 1 %. Sans section critique : au moins 1 valeur aberrante sur 10 000 lectures ; avec : 0. MAX7219 non initialisé : matrice éteinte. Séquence colonnes, lignes, diagonale ×5, `Tab[8]` conforme aux temps de l'énoncé ± 1 %. Seuils : -512 → -3, 0 → 0, +511 → +3 |
| 7. Examen et finitions | Mode examen, accueil A1 à A10, mode libre complet (6 projets de départ, export et import JSON), optimisation | Chrono ; configuration (cartes + MCC) notée 100 % au 1er essai, 50 % au 2e, 0 ensuite ; pénalité de 2 points par manipulation sous tension (barème à confirmer) ; questions non traitées affichées avec leur correction ; session intacte après rechargement. Aucune ligne A1 à A10 sans question. Lighthouse Performance ≥ 90 sur `/info3` en bureau. Simulation ×1 : moins de 25 % d'un cœur sur le chenillard TP1 |
