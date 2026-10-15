# TP2 (2 séances) Liaison série asynchrone / MODBUS

> Transcription mot pour mot des pages TP-10 à TP-18, faite depuis les photos du sujet le 15 octobre 2026.
> Les coquilles du sujet sont conservées volontairement (« THS », « L'autre carte sera ne sert », « 24.6°C is sent as 256 »).
> Les figures sont décrites entre crochets. `[illisible ?]` = passage absent ou caché sur les photos.

<!-- TP-10 -->

## 1. BUT

- Observer et interpréter divers signaux sériels asynchrones
- Se familiariser avec la transmission en niveaux TTL, RS232 et RS485.
- Étude des caractéristiques du Réseau de terrain MODBUS Série.
- Mise en œuvre de périphériques et d'entrées/sorties MODBUS Série.

## 2. LIAISON SÉRIE

On utilisera une carte d'interface connectée à la **sortie série COM1** du PC (norme RS232). Cette carte comprend deux drivers de ligne permettant d'étudier différentes normes de transmission série :

- MAX 232 pour la conversion RS232/TTL (côté PC)
- DS 3695 pour la conversion TTL/RS485

Différents signaux peuvent être visualisés à l'oscilloscope sur cette maquette :

- TXD et RXD en Transmission et Réception en RS232
- TXD et RXD en Transmission et Réception en niveau TTL
- TX+/RX+ et TX-/RX- en transmission bifilaire différentielle RS485.

[Figure : carte d'interface. En haut « Vers autre carte Série » → connecteur DB9. À gauche « Vers PC (RS232) » ↔ connecteur DB9 → MAX2 32 → DS 3695 → « Bornier à vis + connecteur DB9 » ↔ « Liaison différentielle RS485 ». Repères : « Niveaux RS232 (TXD, RXD) », « Niveaux TTL (TXD, RXD) », « Niveaux RS485 (TX+/RX+, TX-/RX-) ».]

Les programmes SERIE_1, SERIE_2 et SERIE_3 disponibles sur le serveur (dossier Documentation technique\RES3\Serie) permettent de gérer la liaison série COM1 du PC et de transmettre différents caractères suivant différentes configurations (parité, cadence de transmission, nombre de bits de données). Sur les cartes d'interface série, le commutateur sera basculé sur **la position « contrôle de flux »**.

### 2.1 Envoi d'un caractère, paramètres de la liaison connus

- Exécuter le programme SERIE_1
- Indiquer le caractère à émettre en série sur COM1 (deux chiffres hexadécimaux) puis valider.

Ce caractère est transmis périodiquement sur la liaison série COM1. La transmission est sur 8 bits avec parité impaire.

<!-- TP-11 -->

- Relever le signal obtenu sur TXD en **niveau TTL** avec différents octets : 55H, 00H et 01H (attention à la synchronisation de l'oscilloscope. Noter les réglages dans votre compte-rendu).
- Vérifier que ces relevés permettent bien de retrouver les caractéristiques de la transmission (8 bits, parité impaire). Repérer sur chacun d'eux les bits de start, parité et stop.
- Mesurer la cadence de transfert (débit)
- Relever le signal obtenu sur TxD **en niveau RS232**. Comparer au niveau TTL (niveau de tension, polarité inverse)

### 2.2 Envoi d'un caractère, paramètres de la liaison à déterminer

- Exécuter le programme SERIE_2
- Réaliser les mêmes opérations que précédemment (niveau TTL seulement). Quelles sont les caractéristiques de transmission : cadence de transfert, 7 ou 8 bits de données, parité ou non, si oui paire ou impaire ?

### 2.3 Envoi de plusieurs caractères, paramètres de la liaison à déterminer

- Exécuter le programme SERIE_3

Ce programme émet une trame constituée de plusieurs octets, chacun étant transmis en mode asynchrone.

- Relever la trame complète et l'interpréter : caractéristiques de la liaison asynchrone (cadence de transfert, nombre de bits, parité, …), contenu de la trame asynchrone transmise (c'est le code ASCII qui est utilisé).

[illisible ? : premiers caractères cachés par un doigt, probablement « La »] table ASCII est dans le répertoire Documentation technique.

### 2.4 Utilisation de RealTerm

Sur les cartes d'interface série, le commutateur est toujours basculé sur la position « contrôle de flux ».

- Relier deux cartes d'interface entre elles à l'aide d'une liaison RS 232

[Figure : PC n°1 (SERIE 3) → Carte Interface Série — TXD (RS 232) — câble série → RXD (RS 232) — Carte Interface Série → PC n°2 (RealTerm).]

- Sur le PC n°2, lancer RealTerm. Configurer ce logiciel avec les paramètres (COM1, cadence de transfert, nombre de bits, parité, …) observés à la question précédente.
- Sur le PC n°1, exécuter le programme précédent (SERIE 3). Vérifier la bonne transmission série entre les deux PC.
- Modifier les caractéristiques de réception de RealTerm (cadence, parité,…). Vérifier que la transmission n'est plus correcte.

<!-- TP-12 -->

## 3. MODBUS RTU

La carte d'interface est maintenant utilisée pour piloter différents esclaves utilisant le protocole MODBUS RTU, à l'aide de la liaison différentielle RS485.

[Figure : carte d'interface. En haut « connecteur DB9 (Non utilisé ici) ». « Vers PC (RS232) » ↔ connecteur DB9 → MAX2 32 → DS 3695 → connecteur DB9 ↔ « Liaison différentielle RS485 → Liaison MODBUS Série ». Repères : « Niveaux RS232 (TXD, RXD) », « Niveaux TTL (TXD, RXD) », « Niveaux RS485 (TX+/RX+, TX-/RX-) ».]

**On rappelle qu'en RS485, la même paire bifilaire véhicule les signaux émis et reçus** : il est donc nécessaire de gérer le « retournement du bus ». Le signal TX_EN est à l'état haut lorsque la carte émet une trame de requête Modbus (prise de ligne) : le reste du temps ce signal TX_EN est à l'état bas, permettant au driver DS3695 d'être en haute impédance afin de pouvoir recevoir des trames de réponse Modbus.

Le **programme MODBUS256K.exe** permet de piloter cette carte d'interface (dans le répertoire DocumentationTechnique/RES3/Modbus). Il offre plusieurs possibilités :

- **Configuration de la liaison série** : ici **38400 bauds, 8bits, parité paire, 1 stop**
- **Parcours réseau** : Test de la présence des esclaves MODBUS connectés (adresses 00 à FF) sur la sortie différentielle RS485.
- **Analyseur** : espionnage des trames MODBUS, décodage et affichage à l'écran de ces trames.
- **Maître** : Émission de trames MODBUS spécifiques
- **Esclave** : Configuration de la carte en tant qu'esclave MODBUS

Diverses documentations techniques (structure des trames MODBUS, Extraits de documentation des modules série, …) sont données en annexe du TP.

### 3.1 Scrutation d'un réseau MODBUS

Pour cette partie, les cartes série de deux binômes d'étudiants seront reliées sur un même pupitre (châssis bleu) comportant différents modules d'entrées/sorties déportées MODBUS.

**Chaque pupitre comporte 4 esclaves Modbus Série** (voir documentation en annexe), reliés entre eux sur la même paire différentielle (RS485):

- Un module **THT**, relié à un capteur de Température/Hygrométrie industriel
- Un module **TDS** comportant 4 afficheurs 7 segments
- Un module capteur de température **TQS** (type domotique)
- Un module d'entrées/sorties déportées **OTB** (Schneider) comportant :
    - 12 entrées numériques, reliées à 12 interrupteurs
    - 8 sorties TOR
    - 4 entrées analogiques
    - 2 sorties analogiques

<!-- TP-13 -->

[Figure : Pupitre Modbus Série. Deux lignes TX-/RX- et TX+/RX+ (« Liaison différentielle RS485 ») reliant : Module Modbus THT (Température, Humidité) TX+/RX+ TX-/RX- (Bornier) ; Module Modbus TDS (4 afficheurs) TX+/RX+ TX-/RX- (Bornier) ; Module Modbus TQS (capteur température) TX+/RX+ TX-/RX- (Bornier) ; Module Modbus OTB (Entrées-sorties déportées) TX+/RX+ TX-/RX- (RJ-45). En dessous : Carte interface Série (binôme 2) TX+/RX+ TX-/RX- (DB9) et Carte interface Série (binôme 1) TX+/RX+ TX-/RX- (DB9).]

Attention : Au préalable, sur le logiciel MODBUS, cliquer sur « configuration serveur », « maître », « liste des trames mémorisées », et supprimer toutes les trames présentes.

- Relier les cartes interface série au pupitre Modbus (câble DB9/bleu-vert)

Attention à la structure Maître/Esclave du réseau Modbus série :
**Une seule carte sera Maître du réseau** (fonction **Parcours Réseau**) : cette carte scrutera les esclaves Modbus connectés (trames Modbus successivement envoyées aux esclaves d'adresses 00, 01, 02, …, 255)
**L'autre carte sera impérativement en Mode Analyseur** et permettra d'analyser le contenu des trames présentes sur le réseau Modbus.

Sur les deux cartes d'interface, il est possible de visualiser les signaux présents sur la liaison commune (TX+/RX+ et TX-/RX-)

- Relever à l'oscilloscope les signaux TX+ et TX_EN.
- Repérer l'état haute impédance.
- Capturer une trame. Quel est le numéro de fonction ?
- Afficher la tension différentielle RS485, (TX+/RX+) – (TX-/RX-), en utilisant les fonctions mathématiques de l'oscilloscope. Que constate-t-on ? Rappeler l'intérêt d'une liaison différentielle dans un contexte industriel.
- En analysant les trames détectées sur la carte d'interface en mode analyseur, déterminer les adresses des esclaves détectés sur le réseau. A quels esclaves du pupitre Modbus correspondent-elles ?
- Quelles trames Modbus sont émises par le logiciel lors de cette phase de détection des esclaves ? Quelle est la fonction Modbus utilisée ?

Lorsqu'un esclave est détecté, une trame d'exception est observée car les esclaves Modbus du pupitre n'implémentent pas cette fonction.

- Analyser le contenu d'une réponse d'exception.

### 3.2 Communication avec différents esclaves MODBUS

Pour cette partie, deux cartes d'interface sont toujours reliées à un même pupitre Modbus. L'objectif est d'accéder aux différents registres des modules Modbus série.

<!-- TP-14 -->

**Attention: A un instant donné, une seule carte d'interface peut jouer le rôle de Maître (mode Maître). L'autre carte sera ne sert qu'à observer les trames Modbus échangées (mode Analyseur).**

Remarques : le programme MODBUS Maitre génère des **trames émises périodiquement**. Ces trames émises par le Maître sont mémorisées et plusieurs trames différentes, à destination de différents esclaves, peuvent être envoyées. Pour simplifier l'analyse, le logiciel permet de supprimer les trames mémorisées.

#### a) Tests des entrées-sorties déportées Modbus OTB:

Après avoir consulté la documentation du module OTB fournie en annexe, trouver l'adresse interne des registres d'entrées TOR, et de sorties TOR.

Tests des sorties TOR :

- Chercher la fonction Modbus permettant, depuis la carte réseau "Maître", d'envoyer l'octet 0x5A qui va configurer les sorties TOR du module OTB.
- Préparer la trame Modbus à envoyer. Utiliser le poste Maître pour émettre la trame préparée. Relever et interpréter les différents octets contenus dans une trame de requête et une trame de réponse.
- Vérifier que les sorties sont modifiées sur les Leds de sortie du module OTB.
- Choisir la fonction Modbus permettant de relire les états de ces sorties. Préparer la requête à envoyer. Tester le bon fonctionnement

Tests des entrées TOR :

- Chercher la fonction Modbus permettant, depuis la carte réseau "Maître", de lire l'état des entrées TOR du module OTB.
- Préparer la trame Modbus à envoyer. Utiliser le poste Maître pour émettre la trame préparée. Relever et interpréter les différents octets contenus dans une trame de requête et une trame de réponse.
- Vérifier que le mot d'entrée lu correspond bien au mot présent sur les interrupteurs reliés aux entrées TOR du module OTB.

#### b) Test du module TDS (4 afficheurs sept segments) :

- Après avoir consulté la documentation du module TDS fournie en annexe, trouver les adresses internes du module TDS permettant l'affichage d'un entier décimal sur les 4 afficheurs. Préparer la trame Modbus correspondante et tester le bon affichage sur le TDS.
- Mêmes questions mais pour un affichage des 4 caractères « abcd » sur les afficheurs (attention, l'afficheur n'accepte que les codes ASCII des lettres en minuscules).

#### c) Test du module TQS (capteur de température domotique):

- Le module TQS contient un capteur de température intégré, communiquant en protocole Modbus série. Après avoir consulté la documentation du module TQS fournie en annexe, trouver l'adresse interne du module TQS, permettant de connaitre la température ambiante.

<!-- TP-15 -->

- Préparer la trame Modbus permettant de mesurer cette température. Tester et vérifier la valeur lue : comparer à la température ambiante.

#### d) Test du module THT (capteur de température et d'hygrométrie industriel):

- Le module THT contient deux convertisseurs A/N reliés à un capteur industriel de mesure de température et d'hygrométrie. Ce module est accessible par protocole Modbus série. Après avoir consulté la documentation du module THT fournie en annexe, trouver les adresses internes du module THS, permettant de connaitre la température (valeur entière) et le degré d'humidité.
- Préparer la trame Modbus permettant de mesurer ces valeurs. Tester et vérifier l'exactitude de la valeur retournée (température).

<!-- TP-16 -->

## Annexe MODBUS

### Module Modbus Série Schneider OTB

**Caractéristiques générales**

| MODULE MODBUS OTB1S0DM9LP (12 entrées TOR, 8 Sorties TOR) | MODULE MODBUS TM2AMI4LT (4 entrées analogiques) | MODULE MODBUS TM2AVO2HT (2 sorties analogiques) |
| --- | --- | --- |

- Adresses Modbus configurées : 20, 21, 22, 23, 24, 25, 16, 17
- Connectique RJ45, liaison différentielle RS485
- **Fonctions Modbus supportées : 3 (lecture mot) et 6(écriture mot), 16(écriture n mots)**

**Module OTB (TOR)**

- 8 sorties TOR : adresse 100, sorties relais (Q7, …, Q0), fonction modbus 06 (écriture mot)
- 12 entrées : adresse 0, entrées (I11, …, I0), fonction modbus 03 (lecture mot)

**Cartographie Modbus simplifiée**

| Adresses (décimal) | Entrées/Sorties | Module | Page Doc OTB | Valeur défaut (Hexa) |
| --- | --- | --- | --- | --- |
| 0 | Entrées TOR (I0, … I11) | OTB1S0DM9LP | 57 | |
| 1 | Entrée analogique IN0 | TM2AMI4LT | 147 | |
| 2 | Entrée analogique IN1 | TM2AMI4LT | 147 | |
| 3 | Entrée analogique IN2 | TM2AMI4LT | 147 | |
| 4 | Entrée analogique IN3 | TM2AMI4LT | 147 | |
| 100 | Sorties TOR (Q0, Q7) | OTB1S0DM9LP | 57 | |
| 101 | Sortie analogique OUT1 | TM2AVO2HT | 145 | |
| 102 | Sortie analogique OUT2 | TM2AVO2HT | 145 | |
| 1102 | Code identification module 1 | TM2AMI4LT | 89 | 6004H |
| 1103 | Code identification module 2 | TM2AVO2HT | 89 | 6007H |

<!-- TP-17 -->

### Modules Afficheur TDS

**4 afficheurs 7 segments** : Affichage numérique (0, …9) ou littéral (a, …z)

- Adresses Modbus configurées : 26, 27, 28, 29, 30, 31, 12, 13
- Connectique 2 fils (TX+/RX+(bleu) et TX-/RX-(vert)), liaison différentielle RS485

**Fonctions Modbus Supportées**

- Fonction 03 : lecture registre d'état 16 bits
- Fonction 06 : écriture mot de 16 bits

**Cartographie Modbus simplifiée**

| Adresses (décimal) | Entrées/Sorties | Fonction Modbus | Valeur défaut (Hexa) |
| --- | --- | --- | --- |
| 1 | Adresse Modbus | 03, 06 | 26 à 31 en TP |
| 2 | Vitesse communication | 03, 06 | 0003 (1200 bps) |
| 3 | Parité | 03, 06 | 0001 (paire) |
| 100, 0x0064 | Affichage texte – 1er caractère (gauche) | 03,06 | Code ASCII (a…z, 0…9, space) |
| 101, 0x0065 | Affichage texte – 2ème caractère | 03,06 | Code ASCII (a…z, 0…9, space) |
| 102, 0x0066 | Affichage texte – 3ème caractère | 03,06 | Code ASCII (a…z, 0…9, space) |
| 103, 0x0067 | Affichage texte – 4ème caractère (droite) | 03,06 | Code ASCII (a…z, 0…9, space) |
| 110, 0x006E | Luminosité | 03,06 | 0 (éteint) à 4 (éclairage maxi) |
| 111, 0x006F | Durée d'affichage en secondes | 03,06 | 0 (affichage permanent), 1 à … (durée d'affichage en seconde) |
| 112, 0x0070 | Durée d'affichage restante en secondes | 03,06 | …. |
| 113, 0x0071 | Affichage nombre entier décimal | 03,06 | 0 à 9999 |

### Modules Capteur température TQS

**Mesure de température** : -55°C<θ<125°C

- Adresses Modbus configurées : 32, 33, 34, 35, 36, 37, 14, 15
- Connectique 2 fils (TX+/RX+(bleu) et TX-/RX-(vert)), liaison différentielle RS485

**Fonctions Modbus Supportées**

- Fonction 03 : lecture registre d'état 16 bits
- Fonction 04 : lecture mot d'entrée 16 bits
- Fonction 06 : écriture mot de 16 bits

**Cartographie Modbus simplifiée**

| Adresses (décimal) | Entrées/Sorties | Fonction Modbus | Valeur défaut (Hexa) |
| --- | --- | --- | --- |
| 1 | Adresse Modbus | 03, 06 | 32 à 37 en TP |
| 2 | Vitesse communication | 03, 06 | 0003 (1200 bps) |
| 3 | Parité | 03, 06 | 0001 (paire) |
| 0 | Température (status) | 04 | 0000 si température valide |
| 1 | Température courante | 04 | Température en 1/10ème de °C |

[illisible ? : le bas de la page TP-17 n'est pas sur la photo ; d'éventuelles lignes suivantes du tableau TQS manquent.]

<!-- TP-18 -->

### Modules Capteur Température et Humidité THT

**Capteur température, humidité, point de rosée :**
-40°C<θ<125°C, humidité 0% à 100%, calcul du point de rosée (température de condensation)

- Adresses Modbus configurées : **38, 39, 40, 41, 42, 43, 10, 11**
- Connectique 2 fils (TX+/RX+(bleu) et TX-/RX-(vert)), liaison différentielle RS485

**Fonctions Modbus Supportées**

- Fonction 03 : lecture registre d'état 16 bits
- Fonction 04 : lecture mot d'entrée 16 bits
- Fonction 06 : écriture mot de 16 bits

Format des données : d'après la documentation technique: *"Values are sent in two formats at once. As a signed integer (16bit value) multiplied by a factor of ten (i.e. temperature 24.6°C is sent as 256). Or as a recalculated decimal number in 32bit float format according to IEEE 754".*

**Cartographie Modbus simplifiée**

| Adresses (décimal) | Entrées/Sorties | Fonction Modbus | Valeur défaut (Hexa) |
| --- | --- | --- | --- |
| 1 | Adresse Modbus | 03, 06 | 38 à 43 en TP |
| 2 | Vitesse communication | 03, 06 | 0003 (1200 bps) |
| 3 | Parité | 03, 06 | 0001 (paire) |
| 0 | Température (status) | 04 | 0000 si température valide |
| 1 | Température courante | 04 | Température en 1/10ème de °C (entier signé) |
| 2,3 | Température courante | 04 | Température en °C (Float IEEE 754) |
| 4 | Humidité (status) | 04 | 0000 si Humidité valide |
| 5 | Humidité courante | 04 | Humidité en ‰ (entier signé) |
| 6,7 | Humidité courante | 04 | Humidité en ‰ (Float IEEE 754) |
| 8 | Point de rosée (status) | 04 | 0000 si Point de rosée valide |
| 9 | Point de rosée courante | 04 | Point de rosée en 1/10ème de °C (entier signé) |
| 10,11 | Point de rosée courante | 04 | Point de rosée en °C (Float IEEE 754) |
