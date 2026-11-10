<!--
Transcription mot pour mot du fascicule « Informatique - TP » (INFO3, IUT Lyon 1 GEII), pages imprimées 3 à 15.
Source : couche texte du PDF. Les fautes d'origine sont conservées ; seules les apostrophes typographiques (’) sont remplacées par des apostrophes droites ('). Chaque figure est remplacée par [Figure : …].
Pages manuscrites du compte rendu (8, 9, 11, 13, 14 du PDF) exclues. Une ancre par question.
-->

# Travaux pratiques d'informatique industrielle — INFO3

<a id="planning"></a>
## Planning des travaux pratiques

| Semaines | Thèmes |
| --- | --- |
| (1)-2-3 | TP1 : Carte Curiosity HPC, IDE MPLABX et MCC<br>PIC16F18875 : Ports parallèles |
| 5 | TP2 : Mise en œuvre de la logique d'interruptions : IOC, Carte Rotary O click (Application IOC encodeur rotatif ) |
| (6)-7 | TP3 : Mise en œuvre du Timer2 |
| 9 | TP4 : Carte Rotary O click : anneau 16 leds (registre à décalage 74HC595 et bus SPI) |
| 11-12 | TP5 : PWM classique + timer1 en PWM + Led RGB (3 PWM) |
| 13-14 | TP6 : CAN (joystick + printf) + Carte 8x8 R click (driver MAX7219 et bus SPI) |
| 15-16 | PARTIELS |

<a id="consignes"></a>
## TRAVAUX PRATIQUES D'INFORMATIQUE INDUSTRIELLE — MODULES INFO3

### Travail à la maison à effectuer avant chaque séance de travaux pratiques

- Revoir impérativement votre TD
- Lire le texte du TP.

### Travail en séance

- Analyser la documentation technique fournie, synthétiser les informations utiles
- Réfléchir à la structure de votre programme (entrées/sorties, types de variables, fonctions, organigramme, machine à états …)
- Coder et commenter votre programme
- Archivez bien vos observations (chronogrammes), conclusions, remarques, pour ne pas vous reposer les mêmes questions la semaine suivante
- N'hésitez pas à poser des questions au professeur car vous n'aurez pas de corrigé de TP.

### Compte-rendu personnel

- Archiver votre code (main.c, fichiers_perso.c/ fichiers_perso.h)
- Archiver les copies d'écrans de MCC commentées qui vous ont servi à la configuration.
- Analyser les fichiers générés par MCC (registres de configuration et fonctions mises en œuvre)
- Préciser les tests que vous avez effectués et leur issue
- Rendre votre compte rendu à la fin de chaque TP, il vous servira également pour réviser pour les partiels.

### Notation

- Une note dite de « compte-rendu ».
  La moyenne des 6 comptes-rendus de TP donnera une note MoyenneBrute.

  Attention il sera tenu compte des absences en TP comme suit (sachant qu'il y a 9 séances de TP) :

      MoyennePondérée = MoyenneBrute *( 9 - x ) / 9
      Avec x = nbAbsNJ + max ( 0 ; nbAbsJ -1)

  La MoyennePondérée sera modulée en fonction de de votre autonomie, de votre investissement personnel pendant les séances, ainsi que de votre aisance au codage.
  En résumé, la note finale de « compte-rendu » est une note individuelle.

- Une note de partiel (1h30) en fin de semestre, viendra compléter la moyenne du module.

---

<a id="tp1"></a>
## TP1 (2,5 séances) : Carte Curiosity HPC, IDE MPLABX et MCC — PIC16F18875 : ports parallèles

Le but de ce TP est de reprendre en main MPLABX IDE en utilisant le plugin MCC et de découvrir la carte Curiosity HPC qui est équipée d'un PIC16F18875.

    Login :          gr30x-01 (pour binôme 1 du groupe 30x)
    Mot de Passe :   123456

<a id="tp1-1"></a>
### 1. Préparer votre environnement de travail

Tous vos programmes de TP d'informatique industrielle devront être sauvegardés dans le répertoire W:\MesDocuments\INFO3
Dans celui-ci, vous réaliserez l'architecture suivante :

    \TP1    destiné aux fichiers du TP n°1
    \TP2    destiné aux fichiers du TP n°2
    …

<a id="tp1-2"></a>
### 2. Prise en main de l'outil de développement MPLABX

Visionner la vidéo qui décrit la création d'un projet et l'utilisation de MCC (MPLAB Code Configurator) accessible depuis le bureau dans le dossier Documentation_technique\INFO3.

### 3. Mise en œuvre progressive des ports parallèles du PIC16F18875 :

<a id="tp1-3-1"></a>
3.1 Analyser le schéma de la carte Curiosity HPC présent en Annexe 1 (Extraits zoomés de la partie BP et Leds) pour identifier quelle broche du PIC permet de piloter la led D2 de la carte.

<a id="tp1-3-2"></a>
3.2 Créer un projet, le configurer à l'aide d'MCC pour piloter la led D2 que vous nommerez LED_D2 dans MCC. Générer le projet.
Analyser les fichiers générés par MCC notamment pin_manager.h et pin_manager.c (aidez-vous des documents du TD pour l'interprétation).

<a id="tp1-3-3"></a>
3.3 Coder le main pour faire clignoter la led D2 toutes les 500 ms. Utiliser les macros créées par MCC (LED_D2_SetHigh( ), LED_D2_SetLow( ), LED_D2_Toggle( ), etc …)
Rappel :

```c
__delay_ms(duree); // permet de créer une pause dans le programme de « duree » ms
__delay_us(duree); // permet de créer une pause dans le programme de « duree » µs.
```

<a id="tp1-3-4"></a>
3.4 Modifier projet et votre programme pour qu'il permette d'allumer la led D2 lors d'un appui sur le bouton poussoir S1 de la carte Curiosity (que vous nommerez BP_S1 dans MCC).
On utilisera les macros générées par MCC : BP_S1_GetValue( ), LED_D2_SetHigh( ) …

Analyser le code généré par MCC et justifier les valeurs présentes dans les différents registres de configuration (en particulier les registres ANSELx et TRISx).

<a id="tp1-3-5"></a>
3.5 Modifier votre programme pour qu'il permette de créer un chenillard 4 bits (1 led allumée qui défile à gauche toutes les secondes) sur les leds D5-D4-D3-D2 présentes sur la carte Curiosity (nommées LED_D5, LED_D4, LED_D3, LED_D2 dans MCC). On prendra soin d'utiliser une variable Chenille pour préparer le motif et de masquer correctement le PORTA pour appliquer ce motif de façon à ne pas toucher au quartet de poids faible du PORTA.

```c
Syntaxe : PORTA=(PORTA&0x0F) | (Chenille << 4) ;
```

**Faire valider par l'enseignant.**

<a id="tp1-3-6"></a>
3.6 Compléter le programme précédent afin de créer un chenillard bidirectionnel de motif quelconque sur 4 bits. Ce chenillard devra changer de sens lorsque l'on appuie sur le bouton poussoir S1 (chenillard à droite à l'appui constant sur le BP_S1 et chenillard à gauche si BP_S1 est relaché). On créera 2 fonctions :
void Decale_Droite(void) permettant le décalage à droite d'un motif quelconque sur 4 bits alignés à droite (ex : xxxx0110) présent dans la variable globale Chenille.
void Decale_Gauche(void) permettant le décalage à gauche d'un motif quelconque sur 4 bits alignés à droite (ex : xxxx0110) présent dans la variable globale Chenille.

<a id="tp1-3-7"></a>
3.7 Introduction des pointeurs :
Améliorer le programme précédent pour éliminer la variable globale. Le motif du chenillard sera contenu cette fois dans une variable locale au main Motif.

Pour cela, on écrira 2 fonctions qui utilisent un pointeur sur la variable lcale au main :
void Rotate_Right_4Bits (uint8_t *PtrMotif) ; permettant le décalage à droite d'un motif quelconque sur 4 bits alignés à droite (ex : xxxx0110) présent dans une variable locale au main.
void Rotate_Left_4Bits (uint8_t *PtrMotif) ; permettant le décalage à gauche d'un motif quelconque sur 4 bits alignés à droite (ex : xxxx0110) présent dans une variable locale au main.

RAPPEL des syntaxes d'utilisation des pointeurs :

- Déclarer un pointeur PtrNb sur une variable de type uint8_t :
  `uint8_t *PtrNb ; //À ce stade le pointeur PtrNb pointe n'importe où`
- Affecter au pointeur ptr_nb l'adresse de la variable Nombre (variable de type uint8_t), ce qui correspond à faire pointer ce pointeur sur la variable Nombre :
  `PtrNb = &Nombre ;`
- Accéder au contenu de la variable pointée par le pointeur PtrNb :
  `*PtrNb = 20 ; /*Affecte la valeur 20 à la variable Nombre*/`

<a id="tp1-4"></a>
### 4. Cahier des charges : 2 BP (Boutons-Poussoir) + 4 Leds

Créer un projet et le configurer pour mettre en œuvre les 2 BP et les 4 leds présentes sur la carte Curiosity HPC.
Cahier des charges : Chenillard 2 sens de marche à motif quelconque configurable (sans utiliser le concept d'interruption, ni les timers)
Le motif du chenillard sera sélectionné au lancement du programme grâce aux 2 BP de la façon suivante :

- On commencera par le choix de l'état du poids faible (LED_D2), celui-ci sera déterminé par le BP_S1 (changement d'état à chaque appui). Une fois son état choisi, le BP_S2 permettra la validation.
  Puis on passera au choix du second bit (LED_D3) toujours grâce à BP_S1, validation par BP_S2 etc … pour chacun des 4 bits du motif.
- Une fois les 4 bits du motif quelconque validés, le chenillard débutera par un décalage sur la gauche toutes les 500ms.
- Le BP S1 permettra, s'il est maintenu appuyé, de provoquer un décalage à droite et s'il est relaché de provoquer un décalage à gauche.
- Le BP S2 quant à lui permettra à chaque appui de modifier la durée entre les différents états du chenillard entre les 3 valeurs : 500ms, 1s et 2s.
  NB : L'instruction __delay_ms(…) étant une macro (et non une fonction), il est impossible de lui donner en paramètre une variable. Par conséquent, pour réaliser une temporisation de n x 100ms, il faudra exécuter n fois un « delay » de 100ms.

<a id="tp1-4-1"></a>
4.1 Réfléchir de manière détaillée à l'architecture de votre programme avant de commencer le codage (découpage en fonctions, organigrammes, etc …).

<a id="tp1-4-2"></a>
4.2 Coder.

Conseil : Ne pas tout coder d'un seul coup. Si votre code est bien modulaire, vous devez pouvoir implanter les différentes fonctionnalités progressivement en les testant au fur et à mesure (saisie d'un bit du motif, puis saisie du motif complet, puis chenillard à gauche, puis changement de sens par BP S1, puis modification de la durée de temporisation).

<a id="tp1-4-3"></a>
4.3 Si vous avez terminé, ajoutez des fonctionnalités au cahier des charges, notamment un clignotement de chacune des leds après leur validation lors de la saisie du motif et un clignotement des 4 leds lors du changement de temporisation.

**Faire valider par l'enseignant.**

---

<a id="tp2"></a>
## TP2 (1 séance) : Mise en œuvre de la logique d'interruptions IOC — Carte Rotary O click (encodeur rotatif EC12D)

Le but de ce TP est de reprendre en main la logique d'interruption IOC du PIC et de mettre en œuvre un encodeur rotatif de la carte Rotary O Click.

[Figure : photo de la carte Rotary O click]

### 1. Interruptions IOC :

<a id="tp2-1-1"></a>
1.1 Créer un projet, le configurer à l'aide d'MCC afin de créer un programme qui permette d'incrémenter et de décrémenter un compteur 4 bits en mettant en œuvre les IOC. On utilisera les fronts descendants du bouton poussoir S1 pour incrémenter le compteur et les fronts descendants de S2 pour le décrémenter (Rappel : les BP produisent un 0 logique à l'appui). On visualisera le compteur 4 bits sur les 4 leds D5-D4-D3-D2 de la carte curiosity.
Pensez à ajouter au fichier main.c les prototypes des 2 routines d'interruption void BP_S1_ISR(void) et void BP_S2_ISR(void). Ne pas oublier également dans la fonction void main (void) (du fichier main.c) les IOCxxx_SetInterruptHandler(BP_Sx_ISR) utiles.
Quelle(s) ligne(s) faut-il décommenter dans le main pour valider les IOC ?
Coder les 2 routines d'interruption IOC.

<a id="tp2-1-2"></a>
1.2 Observer attentivement les fichiers générés par MCC pour comprendre la logique d'interruption IOC. Suivre le cheminement du mécanisme d'interruption en vous aidant du TD (différentes fonctions appelées). Consigner vos constatations dans votre compte-rendu.

### 2. Encodeur rotatif :

<a id="tp2-2-1"></a>
2.1 Avant de mettre en œuvre l'encodeur rotatif présent sur de la carte Rotary O click, étudier attentivement la documentation de l'EC12D en annexe 4.

<a id="tp2-2-2"></a>
2.2 Créer un projet, le configurer à l'aide de MCC et créer un programme qui permet de recopier dans un premier temps l'état de ENCA sur la led D3 et l'état de ENCB sur la led D2 sans utiliser les IOC.
Repérer ainsi les positions stables de l'encodeur.

<a id="tp2-2-3"></a>
2.3 Mettre en oeuvre une IOC pour qu'à chaque front sur ENCB (montant et descendant) la Led D3 affichera le sens de rotation (à 1 pour sens horaire CW, à 0 pour sens anti-horaire ACW). La Led D2 continuera à changer d'état comme précédement.

<a id="tp2-2-4"></a>
2.4 Modifier le programme précédent de façon à ce que la rotation de l'encodeur permette d'incrémenter un compteur 4 bits visualisé sur les leds D5-D4-D3-D2 lorsque l'on tourne dans le sens horaire et décrémente ce compteur lorsque l'on tourne dans le sens anti-horaire.

---

<a id="tp3"></a>
## TP3 (1,5 séance) : Mise en œuvre du Timer 2

<a id="tp3-1"></a>
### 1. Interruption Timer2 (mode free running) :

Créer un projet, le configurer à l'aide d'MCC afin d'utiliser le timer2 pour générer une interruption périodique (mode free running periode = roll over pulse dans MCC) de façon à alterner toutes les 1s entre les 2 motifs ci-dessous sur les Leds D5-D4-D3-D2.

| LED D5 | LED D4 | LED D3 | LED D2 |
| --- | --- | --- | --- |
| ◯ | ◯ | ⬤ | ⬤ |
| ⬤ | ⬤ | ◯ | ◯ |

<a id="tp3-2"></a>
### 2. Interruption Timer2 (mode monostable) :

Reprendre votre projet du TP2 1.1. Vous avez du constater que les boutons poussoirs S1 et S2 comportent quelques rebonds. On souhaite installer un anti-rebond sur le bouton poussoir S2 uniquement afin de pouvoir le comparer au bouton poussoir S1.

[Figure : chronogramme de BP_S2 (appui sur le BP avec rebonds lors de l'appui, relâchement du BP avec rebonds lors du relâchement) et de l'IT Timer2 survenant 10 ms après le premier front de l'appui et 10 ms après le premier front du relâchement. Légendes : « Décrémenter le Compteur, si BP_S2 est à 0 donc appuyé » ; « Ne pas décrémenter le compteur, si BP_S2 est à 1 donc relaché »]

Reprendre votre projet et mettre en œuvre le timer2 et son interruption pour faire la gestion de l'anti-rebond sur le bouton-poussoir S2 (On prendra pour hypothèse que la durée des rebonds ne dépasse pas 10ms). On ne décrémentera le compteur 4 bits que 10ms après le premier front descendant de l'appui sur S2. Tester l'efficacité de cet anti-rebond en comparant l'action des boutons S1 et S2.

<a id="tp3-3"></a>
### 3. Test du programme : ( pour les plus rapides)

Etudier la documentation sur l'utilisation du « debug on hardware » présente en annexe 7.
En mode debug on hardware, observer l'exécution de l'interruption IOC et de l'interruption du timer2 du 2. en installant un point d'arrêt tour à tour dans chacune d'elles.
Attention : Cette version de debugger n'autorise qu'un seul point d'arrêt à la fois.

---

<a id="tp4"></a>
## TP4 (1 séance) : Carte Rotary O click (connectée sur mikro BUS 2) — anneau de 16 leds (registre à décalage 74HC595 et bus SPI)

Revoir attentivement le TD concernant la liaison SPI (fonctionnement et paramétrage). Revoir le schéma de la partie pilotage de l'anneau de led de la carte mikroe Rotary O click, notamment le fonctionnement des 2 registres à décalage 74HC595.

<a id="tp4-1"></a>
1. Créer un projet, à l'aide de MCC configurer la liaison SPI du PIC en mode 3. Créer un programme permettant d'envoyer toutes les 100 ms, à l'aide d'un __delay_ms (100), l'octet 0b00110001 sur la liaison SPI. On utilisera pour cela les fonctions : SPI1_Open et SPI1_WriteByte de la bibliothèque spi1.c.

[Figure : PIC SPI Master avec les lignes SCK, (SDO) MOSI et (SDI) MISO]

Observer à l'oscilloscope les signaux SCK et MOSI. Vérifier notamment que la période de SCK est conforme à votre configuration.
Qu'en concluez-vous concernant l'ordre d'envoi des bits de l'octet ?

<a id="tp4-2"></a>
2. Le PIC et la carte Rotary étant reliés selon le schéma ci-dessous :

[Figure : PIC SPI Master (SCK, (SDO) MOSI, (SDI) MISO, RST, LATCH) relié à la Carte Rotary SPI Slave (SCK, MOSI (SDI), MISO (SDO), RST, LATCH)]

Modifier la configuration du projet et le programme précédent pour pouvoir envoyer le motif 00110001 sur les 8 premières Leds de l'anneau de Leds.

Quel devra être le mode de la SPI dans ce cas ?
On utilisera cette fois les fonctions SPI1_Open et SPI1_ExchangeByte qui attend que l'octet soit transmis avant d'exécuter la suite du programme.

<a id="tp4-3"></a>
3. Compléter votre programme pour pouvoir enchainer, derrière ces 8 premiers bits, un second motif 8 bits. Ils s'afficheront ensemble d'un seul coup sur les 16 leds de l'anneau. Pour cela, créer les 2 fonctions :

```c
void led_ring_clear(void)                       qui permettra d'éteindre les 16 leds
void led_ring_display16(uint16_t led_state)  qui permettra d'afficher un motif 16 bits.
```

Tester vos fonctions avec différents motifs.

<a id="tp4-4"></a>
4. Ecrire un main qui permettra de faire cheniller une led allumée de la led 1 jusqu'à la led 16 toutes les secondes en utilisant la macro __delay_ms(xxx).

<a id="tp4-5"></a>
5. Modifier la configuration de votre projet pour y ajouter la gestion de l'encodeur rotatif mis en œuvre lors du TP 2. On gardera également l'affichage du compteur 4 bits sur les leds D5-D4-D3-D2 pour faciliter la mise au point. Modifier le programme du paragraphe précédent pour allumer une led sur l'anneau de sorte que celle-ci suive la position du codeur.

<a id="tp4-6"></a>
6. Modifier le programme pour créer une animation sur l'anneau de leds. On fera cheniller le motif 0xF0F0 en boucle sur les 16 leds. Puis proposer une autre animation du même type.

---

<a id="tp5"></a>
## TP5 (2 séances) : Led RGB (PWM et notion de struct)

La led RGB, présente sur la carte fille (détail en annexe 2), fonctionne selon le principe de la synthèse additive des couleurs selon le schéma ci-dessous. Donc en réglant la proportion de chacune des 3 couleurs primaires RGB, on pourra obtenir une gamme très étendue de teintes différentes.
Exemple : codage de la teinte saumon rouge=100 %, vert=80 %, bleu=60 %.

[Figure : synthèse additive des couleurs rouge, vert, bleu]

Cette proportion sera réalisée en envoyant sur chacunes des trois broches de la led des signaux PWM dont on réglera les rapports cycliques respectifs.

Important, lors de ce TP :

- Pensez à brancher les 2 cordons USB (le noir et le blanc).
- Ajoutez (s'il n'est pas déjà présent) un petit cache en plastique sur la Led RGB, pour éviter de vous éblouir.

<a id="tp5-1"></a>
1. Créer un projet, le configurer à l'aide de MCC afin de produire 3 signaux PWM de période environ 4ms.
   On utilisera pour cela le timer2 avec 10 bits de résolution, donc bien vérifier que PR2=0xFF.
   Les sorties PWM et CCP utilisées pour piloter les 3 couleurs RGB seront :

   | | |
   | --- | --- |
   | R | PWM6 |
   | G | PWM7 |
   | B | CCP1 |

   En vous aidant de la documentation sur l'interface de liaison série UART (dernier chapitre de la partie TD) programmer grâce à MCC l'interface de liaison série afin de pouvoir faire des « printf » sur l'écran du PC.
   Ecrire un programme qui utilise les fonctions générées par MCC pour éclairer la Led RGB en rouge.
   L'affichage à l'écran correspondant sera :      (R,G,B) = (255,0,0)

<a id="tp5-2"></a>
2. Créer un nouveau type struct pour manipuler plus facilement les niveaux de RGB correspondants à la synthèse d'une couleur.

   ```c
   typedef struct {
        uint8_t red;
        uint8_t green;
        uint8_t blue;
   } rgb_color_t;
   ```

   Coder la fonction void RGBL_SetColor(rgb_color_t color)qui permettra d'allumer la led RGB de la couleur souhaitée. Attention le rapport cyclique du PWM est sur 10 bits.
   Afficher en même temps à l'écran toutes les secondes le niveau de chacune des couleurs (la struct).

   Tester votre programme pour différentes couleurs.
   Exemples :      Rouge  (255, 0, 0)
                   Bleu électrique  (44, 117, 255)
                   Fushia  (253, 63, 146) …

<a id="tp5-3"></a>
3. On ajoutera à la configuration MCC, la gestion des 2 boutons poussoirs S1 et S2 pour générer des interruptions IOC, ainsi que les leds LED_D3, LED_D4 et LED_D5.
   Ajouter également une enum qui définira les 3 états différents d'une machine à états.

   ```c
   typedef enum
   {
     SET_RED,
     SET_GREEN,
     SET_BLUE
   } state_t;
   ```

   Le passage d'un état à l'autre se fera par appui sur le BP_S2 sous interruption IOC et sera visualisé sur la LED_D5 pour l'état réglage du rouge, sur la LED_D4 pour l'état réglage du vert et sur la LED_D3 pour l'état réglage du bleu.

   Coder la fonction void IncrementCurrentColor(void)permettant, suivant l'état en cours de la machine à états précédente, d'incrémenter le champs de la couleur choisie par pas de 16 et d'appliquer la nouvelle couleur en appelant la fonction RGBL_SetColor du 1). La fonction IncrementCurrentColor sera appellée à chaque appui sur le BP_S1 sous interruption IOC.

<a id="tp5-4"></a>
4. Ajouter à la configuration de votre projet les ressources nécessaires pour permettre de piloter l'incrémentation et la décrémentation de la couleur à l'aide du codeur rotatif de la carte Rotary O Click.
   Pour mettre en œuvre l'anneau de leds il conviendra également de mettre en œuvre la liaison SPI.

   Ajouter au code précédent la fonction void DecrementCurrentColor(void)qui permettra de décrémenter la valeur d'un champ de couleur RGB et ajouter également la partie de code du TP précédent concernant la gestion de la carte Rotary O Click.

   **Faire vérifier le bon fonctionnement de l'ensemble.**

---

<a id="tp6"></a>
## TP6 (2 séances) : Joystick (Convertisseur Analogique Numérique) et carte 8x8 R click connectée sur mikro BUS 1 (Driver MAX7219 et bus SPI)

### 1. Prise en main du CAN du PIC et du Joystick de la carte fille (annexe 2) :

Créer un projet, le configurer à l'aide de MCC pour :

- Convertir les tensions fournies par le potentiomètre de la carte Curiosity et le joystick (Horizontal et Vertical)
- Mettre en œuvre la liaison série pour faire des affichages à l'écran du PC.

<a id="tp6-1-1"></a>
1.1 Ecrire un programme permettant de convertir ces 3 tensions en utilisant la fonction bloquante adc_result_t ADCC_GetSingleConversion(adcc_channel_t channel) et d'afficher la valeur numérique brute et la valeur en % de ces 3 entrées analogiques. Que constatez-vous ?

<a id="tp6-1-2"></a>
1.2 Pour remédier au problème il va être nécessaire de calibrer le joystick. Il faudra prélever les valeurs converties en X et en Y pour la position centrale (position de repos) et corriger la mesure de façon à obtenir une valeur de 0 en X et en Y pour cette position. On veillera en outre à ce que la position du joystick soit telle qu'elle donnera des valeurs négatives à gauche et en bas et positives à droite et en haut.

<a id="tp6-1-3"></a>
1.3 En déduire les 2 fonctions de calibrations en X et en Y, qui permettront de passer de la valeur numérique convertie à la valeur calibrée signée.

```c
int16_t Joy_Cal_X(adc_result_t NumX);
int16_t Joy_Cal_Y(adc_result_t NumY);
```

<a id="tp6-2"></a>
### 2. On souhaite maintenant utiliser le CAN sous interruption.

Pour cela, configurer votre projet avec MCC, pour pouvoir utiliser le CAN sous interruption et le timer 2 sous interruption également.

Ecrire un programme qui permet de convertir toutes les 10ms, la valeur horizontale de la position du joystick puis d'enchainer dès la fin de cette conversion avec la conversion de la valeur verticale du joystick. Afficher les deux valeurs converties calibrées en boucle toutes les 1s dans le main.
On utilisera ici uniquement les fonctions non bloquantes ADCC_StartConversion et ADCC_GetConversionResult.

Attention : les valeurs converties étant stockées dans des variables globales (volatile) de taille>8bits et partagées entre le main et l'IT CAN, il conviendra de les protéger correctement contre l'accès concurrent (recopie de la variable globale dans une variable locale dans le main en coupant momentanément les IT, puis travail sur la variable locale).

<a id="tp6-3"></a>
### 3. Prise en main de la carte mikroe 8x8RClick (annexe 5). Etudier de manière détaillée la datasheet du MAX7219 (annexe 6).

Créer la bibliothèque LED8x8.c et son .h correspondant qui contiendra les fonctions :

```c
void LED8x8_Write (uint8_t reg, uint8_t val);
```
qui permettra d'envoyer à l'adresse (reg) la donnée (val) sur le 7219. Attention : MSB first. Cette fonction pourra être utilisée pour la configuration du 7219 mais également pour envoyer un motif sur une colonne.

```c
void LED8x8_Initialize(uint8_t intensity) ;
```
qui permettra d'initialiser le 7219 et de régler l'intensité lumineuse des leds (mettre cette dernière au minimum par la suite).

```c
void LED8x8_Clear( );
```
qui permettra d'éteindre les 64 leds.

```c
void blank_100ms(uint8_t delay_100ms);
```
qui permettra d'éteindre les 64 leds pendant un multiple de 100ms.

Ecrire un main qui bouclera et qui permettra, après initialisation du composant et extinction des 64 leds :

- D'éclairer puis d'éteindre successivement les colonnes 1 à 8 toutes les 200ms
- D'éclairer puis d'éteindre successivement les lignes 1 à 8 toutes les 200ms
- De faire clignoter 5 fois une diagonale toutes les 500ms
- De faire clignoter toutes les 500ms un motif contenu dans un tableau de 8 octets local au main
  `uint8_t Tab[8]={0x30,0x78,0x7C,0x3E,0x3E,0x7C,0x78,0x30};`
- De créer le motif de votre choix que vous stockerez dans un autre tableau et que vous ferez clignoter toutes les 500ms.

<a id="tp6-4"></a>
### 4. On va maintenant associer le joystick et l'affichage sur les 64 leds.

Créer un programme qui permet de déplacer un carré de 4 leds allumées sur l'afficheur en fonction de la position en X et en Y du joystick. La position de repos du joystick correspondra à la position centrale du carré ci-dessous.

[Figure : matrice 8x8 avec un carré de 4 leds au centre ; axe horizontal gradué - 0 +, axe vertical gradué - 0 + (+ en haut)]

Conseils : On pourra prendre comme origine du repère la led de l'angle en bas à droite du carré par exemple.
Cette led peut se déplacer de 3 positions à droite, à gauche, en bas et en haut, au maximum.
En considérant que le joystick fournit après calibration une grandeur entre -512 et +511 en X et en Y, mettre en place les seuils nécessaires sur cette grandeur pour y associer une position entre -3 et 3 en x et en y de cette led.
Une fois la position de cette led allumée gérée, il conviendra également d'allumer les leds positionnées à (x;y+1) à (x-1;y) et enfin à (x-1;y+1).
Pour réaliser le motif à poser sur chacune des 8 colonnes, on pourra utiliser un tableau de 8 octets rempli de 0 où l'on viendra mettre à 1 les 4 bits des 2 octets non nuls.

---

<a id="annexes"></a>
## ANNEXES

- ANNEXE 1 : Schéma de la carte Curiosity HPC 1/2, 2/2 et extraits zoomés
- ANNEXE 2 : Carte fille GEII Villeurbanne
- ANNEXE 3 : Schéma de la carte Rotary O Click Mikrobus
- ANNEXE 4 : Datasheet de l'encodeur rotatif EC12D
- ANNEXE 5 : Schéma de la carte 8X8 R Click Mikrobus
- ANNEXE 6 : Datasheet du MAX7219
- ANNEXE 7 : Debugger un programme sous MPLABX
