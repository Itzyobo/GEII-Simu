# PRD — Simulateur TP2 Liaison série / MODBUS

Oct 15, 2026 · @Youssef

## 1. Cadrage

Le simulateur prépare le tiers du partiel qui porte sur le TP2 : il entraîne au décodage sur papier, et reproduit le banc et le logiciel JBUS/MODBUS assez fidèlement pour revoir la manip. 100 % front, aucune donnée hors du navigateur.

**Source des attendus.** Il n'existe pas de grille officielle. Les attendus sont les notes prises en cours sur le partiel, plus les questions de l'énoncé (TP-10 à TP-15).

| Attendu | Origine | Couvert par |
| --- | --- | --- |
| Message codé | notes partiel | 2.3 SERIE\_3, générateur |
| Débit | notes partiel | 2.1, 2.2, générateur |
| Bit de parité | notes partiel | 2.1, 2.2, générateur |
| Impédance | notes partiel | 3.1 haute impédance, quiz de cours (terminaison, polarisation) |
| Longueur de câble | notes partiel | quiz de cours RS232 / RS485 |
| Autre chose | notes partiel (non précisé) | Modbus : trame, CRC, exception |
| Questions 2.1 à 2.4 | énoncé TP-10, TP-11 | partie A |
| Questions 3.1 | énoncé TP-13 | partie B |
| Questions 3.2 a à d | énoncé TP-14, TP-15 | partie C |

**On garde**

- Le banc : PC, carte d'interface série (DB9 PC, MAX232, DS3695, bornier et DB9 RS485, DB9 vers l'autre carte, commutateur « contrôle de flux »), oscilloscope 2 voies avec Math, pupitre Modbus à 4 esclaves (THT, TDS, TQS, OTB).
- Les programmes SERIE\_1, SERIE\_2, SERIE\_3, un RealTerm réduit aux réglages utiles, et un clone du logiciel SERVEUR JBUS/MODBUS fidèle aux photos.
- Un générateur d'exercices de chronogrammes : c'est le cœur de la préparation au partiel.
- Un mode partiel : chrono, sans indices, correction des questions non traitées.

**On coupe**

- Le câblage libre de type solveur. L'étudiant ne fait que les gestes réels du TP : placer les sondes, régler le commutateur, brancher le câble série entre les deux cartes, brancher le câble DB9/bleu-vert au pupitre.
- Backend, comptes, IA, synchronisation.
- Le mode Esclave du logiciel : visible dans le menu, désactivé, car aucune question ne l'utilise.
- Les fonctions Modbus 1, 2, 5, 7 et 15 en dehors de leur réponse d'exception : aucun module du pupitre ne les implémente.
- La simulation analogique fine de la ligne (réflexions, propagation). L'impédance de ligne est traitée en questions de cours, avec une illustration qualitative marquée « valeur non vérifiée ».
- Le verrouillage « sous tension », remplacé par un verrouillage « bus actif » : on ne débranche ni sonde ni DB9 pendant qu'un maître émet.

## 2. Ce que fait le simulateur

Chaque partie suit l'ordre de l'énoncé. Les questions sont affichées avec leur intitulé exact, et chaque réponse attendue est calculée par les modèles de la section 4.

### Partie A — Liaison série (énoncé §2, étape 2)

| Activité | Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- | --- |
| 2.1 SERIE\_1 | octet en 2 chiffres hexa ; sonde sur TXD TTL ou TXD RS232 ; V/div, s/div, front et niveau de déclenchement, mode Normal ou Auto ; curseurs | caractère répété : start, 8 données LSB d'abord, parité impaire, stop ; TTL 0/5 V au repos haut, RS232 inversé au repos bas | relever 55H, 00H, 01H ; repérer start, parité, stop ; mesurer le débit ; comparer TTL et RS232 |
| 2.2 SERIE\_2 | mêmes réglages, TTL seul | caractère dans un format inconnu | débit, 7 ou 8 bits, parité ou non, paire ou impaire |
| 2.3 SERIE\_3 | sonde TXD TTL, curseurs, zoom | message « lyon 1 » répété, 6 caractères 7O1 à 4 800 bauds (espace comprise), puis silence | relever la trame, retrouver les paramètres et le message ASCII |
| 2.4 RealTerm | brancher le câble série entre les deux cartes ; port, débit, bits, parité, stop côté réception | texte reçu, compteurs d'erreurs de trame et de parité | vérifier la transmission ; modifier les réglages et constater l'erreur |
| Générateur « message codé » | niveau de difficulté ; débit, format et longueur tirés au sort | chronogramme gradué sans légende | message codé, débit, bit de parité (attendus du partiel) |

### Partie B — Scrutation du réseau (énoncé §3.1, étape 3)

| Activité | Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- | --- |
| Mise en réseau | câble DB9/bleu-vert de chaque carte vers le pupitre ; rôle de chaque carte (Maître, Analyseur) ; suppression des trames mémorisées | barre d'état COM1 · 38400 · 8 · Paire · 1 · rôle | règle « un seul maître » |
| Parcours réseau | lancement depuis Configuration Serveur | requêtes `[adr] 07 [CRC]` de 00 à FF ; liste « Trame reçue à hh:mm:ss Esclave NNN Fonction 07 » ; esclaves 23, 30, 35, 41 | adresses détectées, modules correspondants, trames émises, fonction utilisée |
| Oscilloscope TX+, TX−, TX\_EN | sondes sur TX+ et TX\_EN, puis TX+ et TX− ; Math = Ch1 − Ch2 | TX\_EN haut pendant toute la requête ; haute impédance hors émission ; différentiel d'amplitude double | relever TX+ et TX\_EN, repérer la haute impédance, capturer une trame, tension différentielle |
| Analyseur | carte en mode Analyseur | détail de trame décodé, ex. `17 87 01 63 F4` | analyser une réponse d'exception |
| Erreur : deux maîtres | les deux cartes en Maître | collisions, CRC faux, aucune réponse valide | piège du sujet |

### Partie C — Communication avec les esclaves (énoncé §3.2, étape 4)

| Module | Réglages | Ce qu'on observe | Questions couvertes |
| --- | --- | --- | --- |
| OTB (23) | Nouvelle trame : esclave, fonction, adresse, valeur, base de chaque champ ; 12 interrupteurs cliquables | LED Q0 à Q7, réponse écho de la fonction 06, mot lu en 03 | a) registres TOR, écrire 0x5A, relire les sorties, lire les entrées, comparer aux interrupteurs |
| TDS (30) | registre 113 ou 100 à 103 ; valeur | 4 afficheurs 7 segments rouges | b) entier décimal, texte « abcd » |
| TQS (35) | fonction 04, registre 1 | température en 1/10 °C | c) adresse interne, trame, comparaison à l'ambiante |
| THT (41) | fonction 04, registres 1 et 5 | température et humidité | d) adresses internes, trame, exactitude de la température |

### Partie D — Cours et mode partiel (étape 5)

- Quiz de cours : haute impédance et TX\_EN, terminaison, polarisation, RS232 contre RS485 (masse, différentiel, longueur, débit, multipoint).
- Mode partiel : exercices tirés au sort sur toutes les parties, chrono, aucun indice, note finale, correction détaillée.

## 3. Valeurs de référence

Toutes ces valeurs vivent dans un seul fichier de constantes. Une question qui dépend d'une hypothèse affiche le badge « valeur non vérifiée ». Sources : CR = compte rendu et notes du 8 octobre 2026 ; énoncé = TP-10 à TP-18 ; photo = photos du logiciel et du banc.

### Liaison série

| Grandeur | Valeur | Source |
| --- | --- | --- |
| SERIE\_1 format | 8 bits, parité impaire | énoncé |
| SERIE\_1 bits de stop | 1 | hypothèse H1 |
| SERIE\_1 durée de bit mesurée | 440 µs | CR (curseurs) |
| SERIE\_1 débit du modèle | 2 400 bauds, soit 416,7 µs par bit (fréquencemètre : 1,1899 kHz sur le signal alterné, soit 420 µs par bit) | CR (mesure Freq) |
| SERIE\_1 période de répétition | 100 ms (caractère puis repos) | hypothèse H22 |
| SERIE\_1 durée de 11 bits | 4,84 ms (= 11 × 440 µs, pas une mesure indépendante) | CR |
| SERIE\_2 format | inconnu | hypothèse H3 |
| SERIE\_3 format | 4 800 bauds, 7 bits, parité impaire | CR (confirmé par RealTerm) |
| SERIE\_3 bits de stop | 1 | hypothèse H4 |
| SERIE\_3 message | « lyon 1 » avec une espace (6C 79 6F 6E 20 31) ; le CR écrivait « lyon1 » | RealTerm + notes du binôme |
| SERIE\_3 période de répétition | ≈ 111 ms | CR |
| Niveaux TTL | 0 V / 5 V, repos haut | CR (« Vcc = 5 V », tableau du binôme « TTL : 5 V ») |
| Niveaux RS232 | Max 11,5 V, crête à crête 23,3 V (≈ +11,5 V / −11,8 V), repos bas | CR (mesure oscilloscope) |
| Réglages oscilloscope de SERIE\_1 | 500 µs/div ; RS232 à 10 V/div ; sonde 1:1 ; calibre TTL illisible | photos + hypothèse H6 |

### Modbus — liaison et oscilloscope

| Grandeur | Valeur | Source |
| --- | --- | --- |
| Liaison | 38 400 bauds, 8 bits, parité paire, 1 stop | énoncé + photo (barre d'état) |
| Durée de bit | 26,04 µs | calcul |
| Durée d'octet (11 bits) | 286,5 µs | calcul |
| Silence inter-trame | ≥ 1,75 ms | cours (norme au-delà de 19 200 bauds) |
| Requête 07 (4 octets) | 1,146 ms | calcul |
| Fréquence d'interrogation | 1 s | photo (valeur par défaut) |
| Intervalle du parcours réseau | 201,4 ms par adresse, soit ≈ 51,6 s de 00 à FF | photo (horodatages de l'analyseur, 10:52:14,650 → 16,261 sur 8 adresses) |
| Capture : voies | Ch1 et Ch2 à 1,00 V/div, sondes 10:1 | CR (capture) |
| Capture : Math | Ch1 − Ch2, 1,00 V/div, décalage 1,6902 V | CR (capture) |
| Capture : déclenchement | 2,54 V | CR (capture) |
| Capture : base de temps | 500 µs/div | hypothèse H7 |
| Niveaux de TX+ et TX− | ≈ 1 V et ≈ 4 V, opposés | hypothèse H8 |
| Niveau du bus en haute impédance | TX+ ≈ 2,65 V, TX− ≈ 2,35 V (+0,30 V, lu comme un 1) ; 2,5 V sur les deux fils sans polarisation | hypothèse H9 |
| Seuil du récepteur RS485 | ± 200 mV | cours (EIA-485) |

### Esclaves

| Grandeur | Valeur | Source |
| --- | --- | --- |
| Esclaves détectés | 23, 30, 35, 41 | CR (analyseur) |
| Exception 07 de l'OTB | `17 87 01 63 F4` | CR (capture) |
| Exception 07 du TDS | `1E 87 01 B3 F6` | hypothèse H10 |
| Exception 07 du TQS | `23 87 03 A3 FB` | CR (capture, CRC vérifié) |
| Exception 07 du THT | `29 87 01 02 38` | CR (capture) |
| OTB fonctions | 03, 06, 16 | énoncé (annexe) |
| OTB sorties TOR | registre 100 en 06 ; 5AH écrit, LED Q1, Q3, Q4, Q6 | énoncé + CR (photo) |
| OTB entrées TOR | registre 0 en 03 ; réponse `17 03 02 0F 0F B4 73` | CR (capture) |
| OTB codes d'identification | registres 1102 et 1103 = 6004H et 6007H | énoncé (annexe) |
| TDS fonctions | 03, 06 | énoncé (annexe) |
| TDS registres | 100 à 103 ASCII minuscule ; 110 luminosité 0 à 4 ; 111 durée ; 112 temps restant ; 113 entier 0 à 9 999 | énoncé (annexe) |
| TDS entier testé | 1234 | hypothèse H11 |
| TDS rendu de « abcd » | « AbCd » | CR (photo) |
| TQS température | registre 1 en 04 = 00F3H = 24,3 °C | CR (notes) |
| THT température | registre 1 en 04 = 00F0H = 24,0 °C | hypothèse H12 |
| THT humidité | registre 5 en 04 = 00EFH = 23,9 %HR | CR (notes) |
| THT point de rosée | ≈ 2,1 °C | hypothèse H13 |
| Registre 1 lu en 03 (TQS, THT) | adresse Modbus : 0023H, 0029H | énoncé (annexe) |
| Registre 2 de vitesse | 0003 = 1 200 bauds par défaut ; 38 400 → 0008 (un doublement par code) | énoncé (annexe) + hypothèse H14 |
| Registre 3 de parité | 0001 = paire ; 0 aucune et 2 impaire reconstitués | énoncé (annexe) + hypothèse H43 |
| TDS, caractères admis | a…z, 0…9, espace | énoncé (annexe) |
| OTB, entrées et sorties analogiques | IN0 et IN1 sur les potentiomètres, 12 bits | hypothèse H40 |

### Valeur apparente ou paramètre du modèle

| Mesure apparente | Paramètre du modèle | Pourquoi l'écart |
| --- | --- | --- |
| 440 µs par bit (SERIE\_1) | 416,7 µs | placement des curseurs ; 440 µs ne correspond à aucun débit standard |
| 4,84 ms pour 11 bits | 4,58 ms | même erreur multipliée par 11 |
| 111 ms (SERIE\_3) | durée d'un caractère : 2,083 ms | 111 ms est la période de répétition du message entier, silence compris |
| 24,3 °C (TQS) | entier 243 en 1/10 °C | l'appareil transmet un entier, la virgule est une convention de la documentation |

### Liste des hypothèses à vérifier

1. H1 — SERIE\_1 a 1 bit de stop. Sur un caractère répété, 2 stops ressemblent à 1 stop suivi de repos.
2. H2 — Résolue : 1,1899 kHz mesurés sur le signal alterné donnent 420 µs par bit, donc 2 400 bauds.
3. H3 — SERIE\_2 : format tiré au sort parmi les formats standards jusqu'à ce que la vraie valeur soit saisie.
4. H4 — SERIE\_3 a 1 bit de stop. Un récepteur réglé sur 1 stop lit aussi 2 stops.
5. H5 — Résolue : RS232 mesuré à Max 11,5 V et 23,3 V crête à crête.
6. H6 — Calibre TTL de SERIE\_1 : 2 V/div, front descendant, mode Normal. La base de temps de 500 µs/div est lue sur les photos.
7. H7 — Base de temps de la capture Modbus lue sur une photo floue.
8. H8 — Niveaux bas et haut de TX+ et TX− non mesurés.
9. H9 — Polarisation du bus, non mesurée : en haute impédance TX+ ≈ 2,65 V et TX− ≈ 2,35 V, soit +0,30 V lu comme un 1 logique. Réglage « polarisation absente » : les deux fils à 2,5 V, différentiel nul.
10. H10 — Exception du TDS recalculée avec le code 01 : la photo est floue.
11. H11 — Entier affiché sur le TDS non noté.
12. H12 — THT : 00F0H choisi car cohérent avec le TQS, mais 00E0H n'est pas exclu.
13. H13 — Point de rosée calculé par la formule de Magnus (b = 17,62, c = 243,12 °C) à partir de H12 et de 23,9 %HR.
14. H14 — Code du registre de vitesse pour 38 400 bauds absent de l'annexe : 0008, en prolongeant 0003 = 1 200 bps avec un doublement par code (0004 = 2 400, 0005 = 4 800, 0006 = 9 600, 0007 = 19 200, 0008 = 38 400).
15. H15 — Fonctions non implémentées hors 07 : exception 01 pour tous les modules.
16. H16 — Écriture à un registre absent : exception 02.
17. H17 — Les boîtes « Décimal / Hexadécimal » du logiciel sont des boutons qui basculent la base du champ. Valeurs par défaut lues sur les photos : esclave en décimal, adresse en hexadécimal, nombre en décimal, valeur en hexadécimal.
18. H18 — Commutateur hors « contrôle de flux » : aucune émission.
19. H19 — Bruit de l'oscilloscope : gain de chaque acquisition tiré selon une gaussienne d'écart type 1 %, tronquée à ± 1,5 % ; bruit visuel point par point d'écart type 0,3 %, hors mesures (paramètres de simulation, pas une mesure).
20. H20 — Pince de masse absente : trace décalée jusqu'à ±1,5 V et bruit gaussien de 0,4 V (valeurs inventées, effet qualitatif).
21. H21 — Champs des fonctions 2, 5, 15 et 16 du logiciel non photographiés : intitulés reconstitués sur le modèle de F1/F3/F6 ; valeurs de F15/F16 saisies séparées par des espaces.
22. H22 — SERIE\_1 : chaque caractère est suivi d'un repos ; période de répétition 100 ms (durée non relevée).
23. H23 — Niveau de déclenchement TTL par défaut : 2,5 V, mi-hauteur entre 0 V et 5 V (réglage non noté).
24. H24 — Configuration Maître s'ouvre sur la fonction 1, première de la liste (valeur par défaut non photographiée).
25. H25 — Réglages initiaux de l'écran : déclenchement 4 div à gauche du centre, curseurs X à 2 et 4 div du bord gauche.
26. H26 — Une acquisition affichée toutes les 150 ms ; en Auto sans déclenchement, la trace avance de 0,17 écran par acquisition.
27. H27 — Supprimée : niveaux TTL 0 V / 5 V sourcés par le CR (« Vcc = 5 V » et tableau du binôme « TTL : 5 V »).
28. H28 — SERIE\_2 demande l'octet à émettre comme SERIE\_1 : l'énoncé dit « Réaliser les mêmes opérations que précédemment ».
29. H29 — Générateur « message codé » : 1 200 à 19 200 bauds, 7 ou 8 bits, sans parité / paire / impaire, 1 stop ; 3 à 8 caractères (lettres, chiffres, espace) ; RS232 une fois sur deux à partir du niveau 2 ; 2 V/div en TTL, 5 V/div en RS232 ; un bit couvre au moins 1,5 div.
30. H30 — Correction : la bonne réponse de débit est le débit standard exact (1 200, 2 400, 4 800, 9 600, 19 200, 38 400) ; une valeur à ± 10 % du bon débit sans être un standard vaut la moitié des points ; tensions à ± 5 % ; une réponse à ± 1 % de la base de temps est signalée comme confusion avec la durée d'un bit.
31. H31 — RealTerm réduit : ports COM1 et COM2 proposés (seul COM1 relié à la carte) ; débits 1 200 à 19 200 bauds ; s'ouvre en 9 600 bauds, 8 bits, sans parité, 1 stop.
32. H32 — Délai de réponse d'un esclave : 3 ms entre la fin de la requête et le start de la réponse (non mesuré ; la norme impose au moins 1,75 ms).
33. H33 — TX_EN monte 50 µs avant le premier start et redescend 50 µs après le dernier stop (non mesuré) ; le driver d'un esclave suit la même règle.
34. H34 — Convention RS485 : 1 logique (et repos piloté) ⇔ TX+ > TX−.
35. H35 — Parasite de mode commun de démonstration : sinus de 1 V crête à 1 kHz ajouté aux deux fils.
36. H36 — Libellés de l'analyseur pour les codes d'exception 02 à 04 non photographiés (seul 01 « Code fonction inconnu » est lu).
37. H37 — Deux cartes en Maître : un second parcours lancé pendant le premier se cale sur ses créneaux, décalé de 0,5 ms (les deux PC lancés ensemble). Simplification : en réalité, deux maîtres décalés ne se percutent que par moments.
38. H38 — Pendant un parcours, le logiciel envoie les trames mémorisées au milieu d'un créneau de 201,4 ms, à la période d'interrogation.
39. H39 — Conflit de drivers RS485 : un bit identique sur les deux émetteurs passe normalement ; des bits opposés donnent un différentiel de 0,05 V (sous le seuil de 200 mV), et le récepteur lit un bit au hasard (générateur à graine).
40. H40 — OTB : entrées analogiques IN0 et IN1 réglées par les 2 potentiomètres, IN2 et IN3 non câblées (0) ; entrées et sorties analogiques sur 12 bits (0 à 4 095) ; potentiomètres à 50 % et 25 % au départ.
41. H41 — OTB : l'octet fort écrit dans le registre 100 est ignoré ; écrire en 06 ou 16 un registre d'entrée (0 à 4) ou un code d'identification → exception 02.
42. H42 — Valeur hors plage (entier > 9 999, luminosité > 4, caractère hors a…z / 0…9 / espace, nombre de mots hors 1…125) → exception 03.
43. H43 — Registres de configuration 1 à 3 écrits en 06 : écho, puis effet immédiat ; nouvelle adresse (1 à 247) prise aussitôt. Codes de parité : 0 aucune, 1 paire (annexe), 2 impaire.
44. H44 — TDS : entier aligné à droite sans zéros non significatifs ; le dernier registre écrit (texte ou entier) fixe le mode d'affichage ; au départ luminosité 4 et affichage vide.
45. H45 — Trames mémorisées : envoyées tour à tour, une par créneau de 201,4 ms ; le cycle se répète à la plus longue période saisie (au moins le temps d'envoyer toutes les trames).
46. H46 — Libellés du « Détail Trame » pour les requêtes et les réponses 06 et 16 reconstitués sur le modèle de la photo (réponse 03/04 et exception lues sur les photos).
47. H47 — OTB : les fonctions 06 et 16 n'acceptent que les registres 100 à 102 (sorties TOR et analogiques) ; tout autre registre → exception 02.
48. H48 — Vitesse (≠ 0008) ou parité (≠ 0001) réécrite dans un module : écho, puis le module ne comprend plus le bus et reste muet jusqu'à « Réinitialiser le pupitre ».
49. H49 — Terminaison absente : après chaque front de TX+ et TX−, une réflexion par aller-retour sur le câble (retard 2 × L × 5 ns/m), d'amplitude 30 % de l'excursion, amortie en 3 oscillations ; l'amplitude n'est pas mesurée.
50. H50 — Polarisation absente : la ligne flottante change d'état au hasard toutes les 20 ms en moyenne ; le récepteur y lit des caractères parasites.
51. H51 — Mode partiel : 30 minutes par défaut (réglable).
52. H52 — Barème du partiel : 1 point par question ; câblage 1 point au 1er « Faire vérifier » réussi, ½ au 2e, 0 ensuite ; −0,5 point par manipulation pendant une émission.
53. H53 — Longueur du bus au banc du TP : 2 m (quelques mètres de câble entre les cartes et le pupitre), non mesurée.
54. H54 — Oscilloscope : 2 500 points d'acquisition par écran ; un palier plus court qu'un point n'apparaît ni sur la trace ni dans les mesures.

## 4. Modèles de simulation

Tout est déterministe, sauf l'amplitude affichée à l'oscilloscope, qui reçoit 1 % de bruit gaussien. Les temps, les bits et les CRC sont exacts : sur ce TP, une erreur vient de la manip, jamais d'un tirage aléatoire. Chaque modèle est une fonction pure, testable sans interface.

### Liaison série

| Fonction | Entrée | Sortie |
| --- | --- | --- |
| `uartFrame` | octet, format (débit, 7 ou 8 bits, parité aucune / paire / impaire, 1 ou 2 stops) | liste de bits : start, données LSB d'abord, parité, stop |
| `uartWaveform` | bits, format, niveau (TTL, RS232, RS485 TX+ ou TX−), silence entre caractères | échantillons tension / temps |
| `uartDecode` | forme d'onde, format du récepteur | caractères reçus + erreurs de trame et de parité |
| `exerciseGenerate` | graine, difficulté | message, format, chronogramme et corrigé |

La parité vaut 1 si cela rend le nombre total de 1 pair (paire) ou impair (impaire) :

```latex
T_{bit} = \frac{1}{D} \qquad N = 1 + n_{données} + n_{parité} + n_{stop} \qquad T_{car} = N \cdot T_{bit}
```

### Modbus

| Fonction | Entrée | Sortie |
| --- | --- | --- |
| `crc16Modbus` | octets | CRC, polynôme A001H, départ FFFFH, octet de poids faible transmis en premier |
| `buildRequest` | esclave, fonction, champs saisis et leur base | octets de la requête avec CRC |
| `slaveRespond` | état du module, requête | réponse normale, exception, ou rien (adresse 0, esclave absent, CRC faux) |
| `busTiming` | trame, débit | durée, fenêtre TX\_EN, silence |
| `scopeView` | signaux, réglages | trace affichée, curseurs, Math |

Modèles de modules :

- OTB : 12 entrées reliées aux interrupteurs (registre 0, 12 bits utiles), 8 sorties (registre 100), codes d'identification 1102 et 1103.
- TDS : registres 100 à 103, 110 à 113 ; police 7 segments qui rend « abcd » en « AbCd ».
- TQS : registres d'entrée 0 et 1 ; registres de configuration 1 à 3.
- THT : registres d'entrée 0 à 11, entiers signés en 1/10 et flottants IEEE 754 ; registres de configuration 1 à 3.

### Erreurs de manip reproduites

| Erreur | Effet simulé |
| --- | --- |
| Sonde sur TXD RS232 au lieu de TTL | polarité inversée, amplitude ≈ ±11,6 V |
| Déclenchement sur le mauvais front | trace instable ou décalée |
| Mode Auto sans déclenchement | trace qui défile |
| Atténuation de sonde mal réglée (1:1 au lieu de 10:1) | amplitudes affichées divisées par 10 |
| Pince de masse non reliée | trace bruitée et flottante (hypothèse) |
| Commutateur hors « contrôle de flux » | aucune émission (H18) |
| Câble série non croisé en 2.4 | rien reçu sur RealTerm |
| Mauvais réglage RealTerm | caractères faux, erreurs de trame ou de parité |
| Deux cartes en Maître | collisions, CRC faux, aucune réponse valide |
| Trames mémorisées non supprimées | anciennes requêtes envoyées en boucle avec les nouvelles |
| Adresse 100 saisie en base hexadécimale | requête au registre 0100H = 256, exception 02 (H16, H17) |
| Fonction 03 au lieu de 04 sur le registre 1 du TQS ou du THT | lecture de l'adresse Modbus au lieu de la température |
| Fonction non supportée (ex. 16 sur le TDS) | exception 01 (H15) |
| Valeur en BCD au lieu de binaire sur le TDS | 1234H écrit, afficheur à 4660 |
| Adresse esclave 0 | diffusion, aucune réponse |
| Esclave absent | délai dépassé, aucune réponse |
| Sonde ou DB9 débranché pendant qu'un maître émet | pénalité en mode partiel |

## 5. Direction visuelle

L'écran représente un établi de labo sombre, avec les vrais instruments du TP posés dessus. Le logiciel MODBUS reprend à l'identique les fenêtres photographiées. Aucun logo de marque n'est reproduit.

**Établi.** Fond anthracite mat, plan de travail en grille fine. Trois zones fixes : le PC et son écran à gauche, l'oscilloscope au centre, le pupitre et les cartes à droite. Sur mobile, ces zones deviennent des onglets.

**Oscilloscope.**

- Oscilloscope 2 voies de 100 MHz, de type DSOX1102A. Graticule de 10 × 8 divisions sur fond noir, mesures automatiques Freq, Max et crête à crête, sonde réglable 1:1 ou 10:1.
- Couleurs de trace de la capture du TP : Ch1 jaune, Ch2 vert, Math violet.
- Bandeau du haut : calibres des voies, base de temps, déclenchement.
- Colonne de touches à droite comme sur la capture : Math, Function, Operator, Source 1, Source 2, Scale, Offset.
- Curseurs X et Y, avec affichage de Δt et 1/Δt.

**Logiciel SERVEUR JBUS/MODBUS (d'après les photos).**

- Fenêtre Windows grise classique, police système, titre « SERVEUR JBUS/MODBUS ».
- Menus : Configuration Liaison, Configuration Serveur, Filtrage, « ? ».
- Configuration Serveur ouvre Analyseur, Maître (Nouvelle trame, Liste des trames mémorisées — grisée quand la liste est vide), Esclave, Parcours Réseau.
- Fenêtre « Configuration Maître » : Numéro d'Esclave, Fonction à réaliser, champs propres à la fonction, chacun suivi de sa boîte de base (Décimal ou Hexadécimal), Fréquence interrogation esclave (en seconde), bouton Validation.
- Liste déroulante des fonctions dans l'ordre exact : 1 Lecture de N bits de sorties ou internes, 2 Lecture de N bits d'entrées, 3 Lecture de N mots de sorties ou internes, 4 Lecture de N mots d'entrées, 5 Écriture d'un bit, 6 Écriture d'un mot, 7 Lecture rapide de 8 bits, 15 Écriture de N bits, 16 Écriture de N mots.
- Barre d'état : COM1 · 38400 · 8 · Paire · 1 · rôle.
- Panneau d'analyse : liste « Trame reçue à hh:mm:ss,mmm Esclave NNN Fonction NN », zone « Détail Trame », zone « Messages système ».

**Pupitre Modbus.** Châssis bleu « PLATINE 6 », étiquettes THT 41, TDS 30, TQS 35, OTB 23 sous les modules, bus RS485 à deux fils (TX+ bleu, TX− vert) relié aux quatre modules :

- THT en boîtier gris à bornier ;
- TDS en boîtier noir à 4 afficheurs 7 segments rouges ;
- TQS en boîtier blanc à grille d'aération ;
- OTB Schneider blanc avec 2 modules d'extension jaunes, prise RJ45 et LED ; 12 inverseurs noirs et 2 potentiomètres bleus sur un panneau séparé, devant le châssis.

**Carte d'interface.** Carte blanche avec 3 DB9, deux circuits en boîtier DIP, un inverseur et des douilles rouge et noire, organisée comme le schéma TP-10 : DB9 côté PC, MAX232, DS3695, bornier + DB9 RS485, DB9 vers l'autre carte, commutateur « contrôle de flux ». Points de test TXD TTL, TXD RS232, TX+, TX−, TX\_EN.

**Non visible sur les photos.** Les sérigraphies exactes de la carte et l'emplacement précis de chaque point de test, car la photo est prise de biais. La fenêtre complète de RealTerm. Ces éléments sont dessinés d'après le schéma de l'énoncé et signalés comme reconstitués.

## 6. Livraison en 5 étapes

Chaque étape se termine sur un build et des tests sans erreur ni avertissement, puis une vérification dans le navigateur sans erreur console. Les valeurs attendues des tests viennent de la section 3, sans tolérance élargie.

| Étape | Livrable | Critères d'acceptation chiffrés |
| --- | --- | --- |
| 1. Socle et instruments | projet, fichier unique de constantes, énoncé copié mot pour mot, page d'accueil des attendus, oscilloscope, coquille du logiciel JBUS/MODBUS (menus, fenêtres, barre d'état), CRC Modbus | les 30 trames du CR et `23 87 03 A3 FB` ont un CRC identique à 100 % ; Δt d'un bit à 2 400 bauds lu aux curseurs = 416,7 µs ± 0,5 % ; chaque attendu de l'accueil est relié à au moins une question, sinon la ligne est marquée « non couverte » |
| 2. Partie A, liaison série | SERIE\_1, SERIE\_2, SERIE\_3, RealTerm, générateur de message codé | 55H, 00H, 01H donnent `0·10101010·1·1`, `0·00000000·1·1`, `0·10000000·0·1` ; les 6 caractères de « lyon 1 » sont identiques bit à bit au tableau corrigé (espace 20H = 0·0000010·0·1) ; durée d'un caractère SERIE\_3 = 2,083 ms ± 0,1 % ; RealTerm à 9 600 bauds sur SERIE\_3 → au moins 1 erreur de trame sur 6 caractères ; 55H en RS232 : Max 11,5 V ± 2 % et 23,3 V crête à crête ± 2 % ; générateur : 1 000 tirages décodés égaux au message émis |
| 3. Partie B, scrutation | câbles, rôles Maître et Analyseur, Parcours réseau, analyseur, oscilloscope TX+, TX−, TX\_EN, Math | esclaves détectés = exactement {23, 30, 35, 41} ; 4 exceptions identiques au tableau ; requête 07 de 4 octets = 1,146 ms ± 1 % ; TX\_EN reste haut sans interruption entre les octets d'une requête ; amplitude Math = 2 × amplitude d'une voie ± 2 % ; deux maîtres → 0 réponse valide |
| 4. Partie C, esclaves | OTB, TDS, TQS, THT, fenêtres Maître par fonction, pièges de la section 4 | `17 06 00 64 00 5A 4A D8` → écho identique et LED Q1, Q3, Q4, Q6 allumées ; interrupteurs I0–I3 et I8–I11 → `17 03 02 0F 0F B4 73` ; 1234 → `1E 06 00 71 04 D2 59 23` ; « abcd » → les 4 trames du CR ; TQS → `23 04 02 00 F3 01 72` = 24,3 °C ; THT humidité 00EFH = 23,9 %HR ; registre 1 lu en 03 sur le THT → 0029H ; adresse 100 en hexadécimal → registre 0100H |
| 5. Mode partiel et finitions | quiz de cours, examen chronométré, correction, sauvegarde locale | aucun indice affiché en mode partiel ; chaque question non traitée apparaît avec sa correction ; une session en cours survit à 1 rechargement de page ; toute manipulation pendant qu'un maître émet retire des points ; questions de cours sur impédance et longueur de câble présentes |

**Stack.** Vite, React, TypeScript strict, Tailwind, Recharts, Vitest. 100 % front, sauvegarde en localStorage, aucun serveur.
