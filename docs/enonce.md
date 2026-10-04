# Énoncés officiels des TP — ENER3

Source : `pdf/Cours_TD_TP-2026.pdf`, pages 25 à 37 (extraction texte, sans reformulation).

Conventions de transcription :
- `[x]` : glyphe perdu par l'extraction PDF (µ, α, Ω, η, Ω…) et restauré d'après le contexte ;
- `[?]` : glyphe illisible, non restauré ;
- `[Figure — p. N]` : schéma ou chronogramme du PDF, non transcrit (voir la page N) ;
- formules : réécrites sur une ligne entre crochets quand la mise en page 2D est perdue.

---

## TP : Alimentation à découpage isolée.

### Partie 1 : Etude d'une alimentation isolée à découpage simplifié.

#### I - INTRODUCTION

Le transformateur utilisé dans les alimentations à découpage n'est ni plus ni moins qu'un transformateur. Il permet l'isolation galvanique entre la tension d'entrée et celle de sortie. Il travaille généralement à des fréquences allant de de quelques dizaines de kilohertz à plusieurs centaines de mégahertz. Le type de matériaux magnétiques différe selon la fréquence de fonctionnement.

Le rôle principal du transformateur est d'assurer l'isolation galvanique, les signaux de l'entrée sont découplés des signaux de sorties. Ils n'ont pas de référence commune. Comme tout transformateur, il est constitué de plusieurs enroulements bobinés sur un circuit magnétique. Le rapport de transformation peut-être de 1 ou différent. Le schéma équivalent est rigoureusement le même que celui d'un transformateur classique.

Dans le cas de ce TP, on utilise un transformateur SCHAFFNER IT 237 dont les caractéristiques sont à relever sur la notice jointe. Nous allons étudier dans un premier temps son principe de fonctionnement. Le schéma de principe simplifié est réalisé à l'aide du circuit suivant :

[Figure — p. 25 : schéma de principe (E, Ve, D1, Dz, T.I., i1, V1, V2, VZ, VD1)]

A chaque cycle, il faut démagnétiser le circuit magnétique. On utilise une diode de roue libre D1 en série avec une diode zener Dz.

L'aire de l'impulsion ne doit pas dépasser une certaine valeur maximum fixée par le constructeur (pour le IT237 : (V1.t)max = 1100 V.[µ]S ). Autrement, le circuit magnétique va saturer (champ magnétique dans la culasse atteint l'induction maximale).

Si on néglige la résistance, le courant dans le bobinage primaire du transformateur croit linéairement selon la formule, avec une pente de E/Lm :

[i1(t) = E·t / Lm]

Si on dépasse la valeur maximum, le circuit magnétique se sature et le courant croit rapidement dans le circuit primaire (champ magnétique dans la culasse atteint l'induction maximale). Ceci a pour effet de détériorer les enroulements sans pour autant augmenter l'aire des impulsions transmises. Le transformateur n'assure plus son rôle.

Il faut donc respecter une aire d'impulsion inférieure à la valeur maximum : Par exemple pour le IT237, une valeur de 5 V pendant 220 [µ]S ou 11 V pendant 100 [µ]S (aire de l'impulsion : 1100 V.μs).

Dans ces conditions, on obtient les formes d'ondes suivantes :

[Figure — p. 26 : chronogrammes Ve, i1 (pente E/Lm jusqu'à I1max en t1, puis pente – Vz/Lm jusqu'à t2), V1 (E puis −Vz, « Egalité des surfaces »)]

Lors de la phase de roue libre, on retrouve Vd1+Vz aux bornes du primaire. On peut négliger la tension de seuil de la diode Vd1 par rapport à la tension la diode zener Vz. En prenant t1 comme origine des temps, on obtient :

[i1(t) = I1max − (Vd1 + Vz)·t / Lm ≈ I1max − Vz·t / Lm]

On démontre pour que i1 revienne à zéro (démagnétisation), on doit avoir l'égalité des surfaces :

E.t1 = Vz(t2 − t1)

soit [t2 − t1 = E.t1 / Vz] → permet de calculer t2

La durée de démagnétisation (t2−t1) est donc d'autant plus petite que Vz est grand. On peut donc calculer la fréquence maximale des impulsions.

#### III – MANIPULATION

1 − Visualiser les impulsions du générateur d'impulsions (boitier noir) à l'oscillo, et régler la fréquence d'impulsions à 5kHz avec une largeur d'impulsions de 100μs, rapport cyclique 50%.

a) Etude du transformateur à vide, secondaire non relié à la charge.

2 – Câbler la maquette en utilisant son schéma ci-après (annexe). L'alim de puissance est à régler à 5V. Faire vérifier le câblage.

3 – Visualiser à l'oscillo la tension v2(t) et le courant i1(t) en utilisant le shunt d'1Ω. Relever v2(t) et i1(t). Retrouver la valeur de Vz.

4 – Déterminer à partir de ces expérimentations, l'inductance magnétisante Lm du transformateur d'impulsions (également appelée inductance principale Lp), et comparer aux données constructeur en annexe.

5 – Régler la fréquence des impulsions à 2kHz puis augmenter progressivement la durée de l'impulsion (en partant de 0). Qu'observe-t-on sur l'allure du courant lorsque la durée de l'impulsion augmente ? Observer la saturation du circuit magnétique sur l'allure du courant.Déduire approximativement l'aire maxi de l'impulsion transmissible sans saturation (Aire = tension * la durée de l'impulsion en µs)

b) Etude du convertisseur complet, en charge.

6.– Relier au secondaire du transfo la partie diode D2 avec la résistance de charge Rs, visualiser la tension de sortie vs(t) pour des impulsions f=2kHz et [α]=30%. Commenter les résultats obtenus. Ajouter le condensateur C puis visualiser la tension de sortie. Faire varier la fréquence du GBF ainsi que le rapport cyclique (en partant de f=1kHz). Qu'on observe-t-on ? Sur quelle grandeur peut-on agir pour diminuer le ΔV ?

#### ANNEXE : SCHEMA DU MONTAGE

[Figure — p. 28 : Alimentation E=5V (Vcc rouge, GND1 noir) ; Dispositif d'amplification du géné d'impulsion, Prise BNC (géné d'impulsions) Vimp ; Transistor ; D1, VD1, DZ, VZ ; Transfo IT237 m=1, V1, V2 (bleu), i1, i2 ; shunt de mesure R=1 Ω (marron, mesure de courant) ; D2, VD2 (jaune), C 10[µ]F, Charge : Rs=330[Ω], iS, VS (jaune / rouge), GND2 (noir)]

#### ANNEXE : DOC CONSTRUCTEUR DES T.I.

[Figure — p. 28 : notice constructeur, non transcrite]

### Partie 2 : Platine Hacheur isolé.

Nous allons étudier un convertisseur de type flyback avec le kit d'évaluation MAX17691B de chez Maxim. C'est un convertisseur continue / continue avec une isolation galvanique.

1. A partir de la datasheet, trouver les principales caractéristiques de la platine, plage de tension d'entrée, tension et courant de sortie, fréquence de découpage, rendement pour le courant nominal. Que veut dire isolation galvanique ?

2. Proposer un schéma de câblage permettant de mesurer le rendement global de l'alimentation. On utilisera avec un rhéostat comme charge. Au départ le rhéostat sera réglé à sa valeur maximum. Faire varier le courant de sa valeur mini à 0,5A. Faire cinq points de mesures.

3. Quel serait le rendement si on remplaçait ce convertisseur par une alimentation type linéaire ? Calculer ce rendement théorique pour un courant de 0,5A (dans une alimentation linéaire le courant en entrée et le même qu'en sortie). Conclure

4. Le schéma simplifié de l'alimentation :

[Figure — p. 29 : 30V, PGND, V1, LX, K, m, V2, VOUT, GND0]

5. Visualiser les tensions V1(t) et V2(t) de l'alimentation isolée, attention aux masses. Régler le courant à 0,5A environ. Calculer le rapport de transformation [m = n2/n1]. Retrouver la fréquence de découpage.

---

## TP : Moteur pas à pas

Objectifs : Étude du fonctionnement d'un moteur hybride et de sa commande
Détermination des différents modes de fonctionnement
Étude des signaux de commande

Rappels : Revoir le cours concernant le fonctionnement des moteurs pas à pas.

Moteur :
Le moteur utilisé est un moteur pas à pas hybride 42BYGH40 -1,8. Il possède 2 bobinages stator (phase A : fils noir – vert ; phase B : fils rouge – bleu) , 4 pôles de 10 dents chacun et un rotor de 50 dents permettant de réaliser 200 pas par tour en mode pas complet et 400 pas par tour en mode demi-pas et jusqu'à 6400 pas par tour en mode micro pas.

Principales caractéristique du moteur :
Pas de 1,8° en pas entier - courant nominal par phase 1,7A, couple de maintien 3,5kg.cm,

Driver
L'électronique de commande associée (driver TB6600) permet d'alimenter chacun des 2 bobinages stator à l'aide d'un hacheur en pont complet. La limite de courant et le nombre de pas sont configurables avec les micro-switch de S1 à S6, voir table sur le driver.

Régulation du courant :
Quand un enroulement est commandé les transistors 1 et 3 sont fermés. Le courant parcourt donc l'enroulement à travers la résistance R qui donne une image de la valeur du courant. Quand la tension aux bornes de cette résistance atteint un seuil (correspondant à un courant de 1A), les transistors 1 et 3 sont coupés et le courant se reboucle à travers les diodes de roue libre D2 et D4. Quand la valeur du courant a chuté de 0,1A, les transistors 1 et 3 sont à nouveau fermés et le cycle repart.
Pour un fonctionnement en sens inverse, ce sont les transistors 2 et 4 qui sont commandés avec le même cycle.

1. Les switch S4 – S5 – S6 permettent de régler la limitation courant du driver, vérifier si la limitation est bien réglée à 1A. Les switch S4 et S6, non sortis, sont déjà sur ON. Mettre S5 en bas.

Commandes
• Signal d'horloge :
2. Régler le signal d'horloge puis le raccorder au driver :
Fréquence des impulsions : variable entre 10Hz et 10kHz, 5V d'amplitude (sortie TTL).
Rapport cyclique 50%.
Une impulsion d'horloge sur cette broche fait tourner le moteur d'un pas (en mode pas entier).
• Sens de rotation :
Entrée DIR sur le module définit le sens de rotation en fonction de la position de l'interrupteur.
• Mode Pas entier - demi pas et micro pas :
Les switch S1 – S2 – S3 permettent de régler le mode de commande pas entier (200 pas par tour) le mode demi pas (400 pas par tour) et le mode micro pas. ON : position haute.

3. Raccorder au driver avec une alimentation de puissance de +15V et 5V pour la commande.

Manipulation
Vitesse de fonctionnement :
4. Appliquer une fréquence de 20 Hz en mode pas complet (régler S1, S2 et S3) et mesurer expérimentalement la vitesse de rotation du moteur. Vérifier ce résultat par le calcul.
5. Appliquer une fréquence de 180 Hz en mode demi pas et mesurer la vitesse de rotation du moteur. Vérifier ce résultat par le calcul.

Analyse des modes de fonctionnement :
Suivant la fréquence du signal d'horloge, donc en fonction de la vitesse de rotation du moteur, le courant phase peut prendre 2 formes différentes :
• Cas 1 pour des fréquences Freq1, autour de 200Hz, le courant phase de la machine présente des paliers de courant avec des périodes de hachage par période de signal d'horloge. Dans ce mode de fonctionnement, le moteur travaille en mode courant, c'est à dire à la valeur limite du courant qui est imposée et maintenue dans les enroulements.
• Cas 2 pour des fréquences Freq2, le courant phase ne peut atteindre sa valeur de consigne (+1A ou -1A) et il représente alors une courbe d'allure « triangulaire ». Ici, le moteur travaille en mode tension.

Fonctionnement en mode pas complet :
Rq : Eviter certaines zones de fréquences où il y a des résonnances mécaniques se traduisant par une perte de pas du moteur.
6. Déterminer la valeur de la fréquence Freq2.
7. Pour les fréquences Freq1 et Freq2, relever sur une phase le courant et la tension à ses bornes. Justifier le mode de fonctionnement pour chacune de ces fréquences (mode courant ou mode tension)
8. Pour la fréquence Freq1, enregistrer le courant dans les 2 phases du moteur et retrouver un déphasage de T/4.

Changement de sens de rotation
9. A l'arrêt, en mode pas complet, inverser le sens de rotation du moteur, pour fréquence du GBF autour de 200Hz. Démarrer le moteur et relever les courants dans les enroulements en mode courant. Expliquer les différences avec la question 8.

Fonctionnement en mode pas entier, puis demi-pas, puis 1/4 de pas :

10. Pour une fréquence d'horloge de 500 Hz, relever le signal d'horloge etle courant. Justifiez dans quel mode fonctionne le moteur et indiquez le nombre de périodes horloge pour une période du courant moteur.

11. Relever le courant dans chacune des 2 phases du moteur, et déterminer la séquence des courants.

Calcul de l'inductance d'un enroulement.

12. En mode pas entier et pour une fréquence de 1khz (courant trapézoïdal), observer la montée, ou descente, du courant pour passer de +Imax à –Imax. Que vaut la tension aux bornes d'une phase ? En partant de l'équation [V(t) = L ⋅ di(t)/dt] et en supposant une croissance linéaire du courant, calculer la valeur de l'inductance.

---

## TP : Moteur asynchrone triphasé à cage

Objectifs
• Découvrir le fonctionnement de la machine asynchrone
• Effectuer un bilan de puissances
• Utiliser un variateur de vitesse

Rappels théoriques
Le moteur asynchrone triphasé est appelé aussi machine à induction car l'énergie est transférée du stator au rotor par induction électromagnétique. Le stator d'une machine asynchrone est constitué d'une culasse ferromagnétique et d'un bobinage multipolaire triphasé.
Le rotor est de plus en plus souvent à cage. C'est un ensemble de barres, très conductrices, noyées dans un matériaux magnétique, isolées de celui-ci et court-circuitées par des anneaux. Les courants dans le rotor sont des courants induits par le champ tournant.

L'enroulement triphasé statorique à p paires de pôles est parcouru par un système de courants triphasés équilibrés de fréquence f. Ceux-ci créent un champ tournant à la fréquence de synchronisme ns. On a la relation suivante ou n est la vitesse en tr/s :

f = p.n

Le rotor en court-circuit est le siège de courants induits intenses. Il tourne à la vitesse mécanique n nécessairement inférieure à celle du champ tournant pour qu'il existe un mouvement relatif entre champ et courants induits, seul capable de générer l'effet d'induction électromagnétique. D'où le qualificatif d'asynchrone réservé à ce moteur.

L'interaction entre le champ tournant et les courants induits génère un couple sauf si [Ω] = [Ω]s

Le glissement g est une variable importante. Il caractérise la différence relative entre les deux vitesses Ωs et Ω.

[g = (Ωs − Ω) / Ωs = (Ns − N) / Ns]

Pour un glissement faible, au régime nominal usuel, le couple électromagnétique est proportionnel au glissement.

Ce = K.g

Le glissement vaut 1 au démarrage, la vitesse est nulle. Au nominal g est de quelques centièmes au régime nominal. A vide, il est presque nul.

Les pertes sont principalement des pertes joule dues aux courants rotoriques d'intensité élevée dans la cage (dans le rotor). Il existe aussi des pertes joule au stator, des pertes magnétiques dans les tôles du circuit magnétique (stator-entrefer-rotor) et des pertes mécaniques.

Le couple « électromagnétique » est donné par [Ce = 3pVs²·g / ([Ω]s·R'2)] pour g usuel (quelques %). La valeur de R'2 (résistance du rotor) est donc le paramètre important du schéma équivalent.

Le travail à réaliser

1. Préliminaires
• Relever la plaque signalétique du moteur : tensions, courants, puissance utile, vitesse.
• Calculer le couple utile nominal de la machine. Le constructeur donne 10N.m.
• Combien de paires de pôles possède le moteur ? Quelle est sa vitesse de synchronisme, vitesse à vide ?

2. Câblage
La machine asynchrone sera utilisée en moteur, directement reliée au réseau 400V, puis commandée à travers un variateur de vitesse. La charge mécanique sera constituée par une autre machine électrique (machine synchrone) pilotée par un variateur (appelée charge active). La charge active permet de faire varier le couple résistant de la machine asynchrone et donc d'étudier facilement les caractéristiques de celle-ci.

[Figure — p. 34 : Charge active (machine synchrone : MS) / Machine asynchrone étudiée : MAS]

• Le moteur 690/400V est directement relié au réseau en prenant garde au couplage.
• Ne pas brancher ou débrancher la charge active. l
• L'énergie de la charge active est dissipée dans une résistance qui peut monter très haut en température. Attention aux risques de brulure
• Les puissances actives, réactives et apparentes sont mesurées au wattmètre par la méthode des 3 wattmètres (Lapuissance active et réactive est la somme des indications données pour chaque phase ; theorème de BOUCHEROT ).
• La variation du couple de charge se fait en positionnant le commutateur sur la position 1 et en tournant le bouton rotatif progressivement. On contrôlera dans le même temps la valeur du couple sur un voltmètre.
• Le couple est mesuré par la charge active à l'aide d'un voltomètre sur deux bornes.La vitesse est lue directement sur le variateur de la charge active

Calibre couple : 0,3V/Nm ne pas dépasser 3V (10N.m)

[Figure — p. 35 : Mesures couple, Mesure vitesse, Commutateur, Bouton rotatif, Pilotage de la charge active]

3. Essai en charge puis à vide, stator sous tension nominale

Pour un couple utile compris entre la valeur nominale et la valeur nulle (essai à vide) : Cun , ¾Cun , ½Cun , ¼Cun, 0, mesurer :
• le courant statorique Is,
• la tension simple V,
• la puissance active absorbée Pa,
• la puissance réactive Qa,
• la puissance apparente S
• la vitesse [Ω] en rd/s.

Présenter les résultats sous forme de tableau comme ci-dessous.

Calculer à partir des mesures :
• le glissement g,
• la puissance utile Pu ,
• le rendement η en % (Pu/Pa),
• le facteur de puissance k = cos(φ) = Pa/S.

| | A vide 0 | ¼ charge nominale | ½ charge nominale | ¾ charge Nominale | Charge nominale |
|---|---|---|---|---|---|
| Cu(N.m) mesure | | | | | |
| Vitesse (tr/mn) | | | | | |
| [Ω] (rd/s)) calcul | | | | | |
| Pu(W) calcul | | | | | |
| Is(A°) mesure | | | | | |
| V(volt) mesure | | | | | |
| g calcul | | | | | |
| Pa(W) mesure | | | | | |
| Qa(var) mesure | | | | | |
| S(VA) calcul | | | | | |
| [η] (%) calcul | | | | | |
| cosφ calcul | | | | | |

4. Mesure de Rs

Mesurer en continu à l'ohmmètre, la résistance d'une bobine du stator Rs à chaud. (Alimentation coupée, moteur à l'arrêt).

5. Alimenter le moteur sous 400V, mais couplé en étoile.
Mesurer P'0 et I's0 (mesure en vue de séparer les pertes magnétiques et mécaniques)

6. Exploitation des mesures

Tracer les courbes suivantes :
• Cu=f(N) et Cu = f(g).
• cosφ et [η] en fonction du couple utile
• Tracer la courbe donnant Is en fonction du couple utile
• Tracer la courbe Qa en fonction du couple utile

7. Fonctionnement avec variateur de vitesse.

• Coupler le moteur en triangle. Câbler le moteur en utilisant le variateur de vitesse. Attention lors des essais de ne pas dépasser la valeur du courant nominal du moteur et le couple nominal.
• Tracer la courbe donnant la vitesse en fonction de la fréquence d'alimentation. Conclure sur l'utilité du variateur de vitesse.
• Relever pour trois points (15, 35 et 50Hz), la fréquence et la tension entre deux phases du moteur. Calculer pour chaque point le rapport U/f, conclure. Attention : pour mesurer U, la tension aux bornes d'une bobine, on relèvera la tension du fondamental à l'aide du wattmètre, mode harmonique. En effet, à la sortie du variateur les tensions sont des créneaux de tension ±450V à 3kHz. Ses tensions sont très riches en harmonique et de hautes fréquences, seulement le fondamental est utile au fonctionnement de la machine.

Contrôler le courant dans une phase pour ne pas dépasser Inom.

[Figure — p. 37 : Synoptique du variateur de vitesse (Réseau 400V, redresseur, onduleur, MAS, Commande)]

8. Séparation des pertes mécaniques et magnétiques à l'aide de l'essai 400V couplage étoile et triangle.
• Reprendre les résultats de la puissance absorbée à vide en montage triangle et étoile. Cette puissance correspond seulement aux pertes, à vide la puissance utile est nulle.
• Calculer les pertes joule statoriques à partir de Rs dans le cas du montage étoile et triangle. Attention au courant qui circule dans l'enroulement !
• Pour séparer les pertes mécaniques et les pertes magnétiques, on suppose que les pertes magnétiques sont proportionnelles au carré de la tension stator, Pmag = α.U² montage triangle ou α.V² montage étoile.
• Les pertes mécaniques ne dépendent que de la vitesse de rotation de l'arbre et le moteur tourne à la même vitesse en montage étoile et triangle. Pméca = PmécaY = PmécaΔ

➢ Essai stator couplé en triangle. Bobinage alimenté en tension composée, U=400V :

PoΔ = PjsΔ+ PmagΔ + Pméca avec PjsΔ = 3.Rs.J0Δ² (J0Δ = I0Δ/√3) et PmagΔ = α.U²

➢ Essai stator couplé en étoile. Bobinage alimenté en tension simple, V=230V :

PoY = PjsY+ PmagY + Pméca avec PjsY = 3.Rs.I0Y² et PmagY = α.V²

On obtient le système suivant à deux équations et deux inconnues, α et Pméca :

PoΔ = PjsΔ+ α.U² + Pméca
PoY = PjsY+ α.V² + Pméca

Résoudre le système pour déterminer α et Pméca.
