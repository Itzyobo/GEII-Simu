# TPs Ressource AU3 — Automatique — Asservissement / Régulation

> Copie de l'énoncé `docs/au3/source/Automatisme_-_TP.pdf` (pages 1 à 34 : méthodes de travail, fiches GBF et oscilloscope, TP1 à TP4), extraite avec `pdftotext -layout`. Seule la mise en page est corrigée : titres, listes, formules en LaTeX, glyphes de la police Symbol perdus à l'extraction (Δ, Ω, ≈, ±, ∞, τ) rétablis. Les figures sont notées `[illisible : figure p. N]`. Les ancres `<a id="…"></a>` servent de clés aux questions du simulateur (`src/data/questions.au3.ts`).

<!-- p. 1 -->

IUT LYON 1 - Site Gratte-ciel

Département GEII
Génie Electrique et Informatique Industrielle

Semestre 3

TPs Ressource AU3
Automatique

Asservissement / Régulation

[illisible : figure p. 1]

Eléa BERRAHO
Thomas BISCALDI
Pilar SANGO
Claire VALENTIN
Julien VIAL

Apporter vos COURS /TD AU3
Ainsi qu’un zeste de curiosité et de motivation !
Et l’envie de comprendre ce que vous faites

Année 2026/2027

<!-- p. 2 -->

**1ère Série – 5 semaines – TP de 3h**

| | | |
| --- | --- | --- |
| TP1 | Etude de la vitesse d’un Moteur à Courant Continu au démarrage et en régime permanent<br>Expérimentations / Identification / Modèle comportement / Optimisation avec MATLAB | p 5 |
| TP2 | Etude de la vitesse d’un Moteur à Courant Continu bouclé avec un régulateur proportionel : Effets de différents réglages du régulateur<br>Expérimentations / Identification / Modèle comportement / Optimisation avec MATLAB | p 12 |
| TP3 | Asservissement de position d’un moteur à courant continu avec un régulateur Proportionnel :<br>Commande automatique de l’orientation d’une antenne puis de la position d’un balai d’essui-glace<br>Expérimentations / Observations / Mesure des performances | p 21 |
| TP4 | Etude de l’asservissement de la vitesse d’un Moteur à Courant Continu bouclé avec un régulateur PI série (Proportionel Intégral) au démarrage et en régime permanent<br>Expérimentations / Observations / Mesure des performances<br>Simulations avec MATLAB /SIMULINK | p 28 |

PARTIEL (1h15) : QCM + Expérimentations

Annexe 1 : Abaques pour l’étude des systèmes du 2ième ordre (poly Cours/TD) — sur table
Annexe 2 : Manuel d’utilisation – platine « régulateur analogique » — sur table

**2ième Série – 3 semaines – TP de 3h**

| | | |
| --- | --- | --- |
| TP5 | Etude temporelle des déplacements (position) d’un chariot sur un axe linéaire avec un haut niveau de performances<br>Expérimentations / Identification / Choix régulateur et réglage de ses paramètres | p 35 |
| TP6 | Découverte et régulation/asservissement de la position d’articulations d’un robot PANDA de FRANKA EMIKA | p 54 |
| TP7 | Régulation/asservissement du niveau dans un château d’eau pilote<br>Modélisation, étude du système seul puis du système asservi automatiquement | p 67 |

Les binomes 1, 2 et 3 feront le TP 6 en premier et les
binomes 4, 5 et 6 feront le TP 7 en premier.

Ces 3 derniers TPs seront évalués en séance à chaque fois que vous montrerez des courbes à
l’enseignant. Vous ferez un compte-rendu par binôme en notant bien le n° des questions.

Vous déposerez dans Moodle, cours « Automatique-Régulation-Asservissement », onglet « CR TP AU3 série 2 » au bon
endroit un fichier .zip, incluant le CR et les fichiers excel des mesures, au plus tard 1 semaine après le TP. Le nom de
votre fichier devra être : n°demi-GROUPE_NOM1_NOM2_n°_bi nome_TPx.zip avec x = 5, 6 ou 7.

<!-- p. 3 -->

## METHODES DE TRAVAIL

**• Travail personnel à effectuer avant chaque séance de TP**

- Lire le texte du TP et revoir les cours/TD correspondants

**• Travail personnel durant la séance de TP**

Pour vous connecter au PC, utilisez votre login habituel. Vous pouvez sauvegarder vos fichiers dans un dossier
nommé « AU3 ».

- Effectuez les programmes et/ou mesures demandés.
- Interprétez, analysez et comparez vos résultats à la théorie vue en cours/TD
- Notez précisément vos conclusions et remarques
- Posez toutes les questions nécessaires à votre bonne compréhension du sujet.
- Sauvegardez tous vos programmesmatlab(.m) ou simulink (.slx) avecdes noms de fichiers explicites. Ces
fichiers vous fourniront une base pour les TP suivants et en partiel.

**• Quelques points sur les méthodes de travail en TPs AU3 expérimentaux**

1. Pour permettre une détection plus simple des erreurs de cablage, câblez tous les signaux (Consigne,
Sortie régulateur, Mesure, …) avec des câbles de couleur différente de noir et toutes les masses
avec des câbles noirs.

2. Régler le GBF d’abord sur une fréquence très basse puis l’augmenter jusqu’à obtenir le signal que
l’on attend : 70% de la courbe doit représenter le régime transitoire et 30% le régime permanent (les
systèmes que l’on étudie en salle B26 sont plus lents qu’en électronique en salles B23 ou B24 !).

3. Régler l’oscilloscope sur un calibre et une base de temps grands puis le diminuer jusqu’à ce que les
courbes occupent la majeure partie de l’écran. Signaux DC.

4. Dans une réponse à un échelon d’entrée ou de consigne positif, faire coincider le début de l’échelon
positif avec l’état initial de la sortie (comme au tableau en cours/TD ou avec Matlab).

5. Il y a un grand risque de saturation en sortie de l’AOP du régulateur (sortie de G2) à ±10,6 V (12V
– somme des tensions de seuil de 2 diodes). Il est indispensable d’observer qu’il y a ou pas une
saturation en sortie de l’amplificateur G2 avant de faire des mesures précises sur une courbe
représentant la sortie. C’est une information importante pour l’analyse.

6. Quand on commande un moteur, l’ampli de courant (puissance) est indispensable pour que le
moteur soit alimenté avec une puissance suffisante, notamment au démarrage.

**• Mini-rapport de TP**

Vous devez rédiger un mini-rapport sur chaque TP dans un fichier Word regroupant les courbes obtenues et/ou
les programmes. La rédaction courte, soignée et précise d’un mini-rapport constitue un atout majeur pour
la préparation correcte des partiels de TP et pendant les partiels :

- Il pourra être rédigé en grande partie en séance si la préparation a été correctement réalisée
- Il devra obligatoirement être terminé à la maison pour la séance suivante.
- Il comprendra impérativement :
  - Les courbes avec les curseurs positionnés sur les mesures demandées. Ces courbes seront commentées.
  - Détailler tous les calculs demandés ou nécessaires
  - Une copie de vos programmes MATLAB et des schémas SIMULINK
  - Vos analyses et comparaisons entre cours/TD et observations en TP, vos interprétations,
    conclusions, remarques, problèmes rencontrés et propositions d’amélioration.

Il faut faire une remarque dès que vous observez quelque chose de bizarre
/différent du cours ou de ce que vous attendez.

Conseil : Les logiciels MATLAB/SIMULINK sont disponibles dans les salles 16 et 18 . Vous pouvez donc
approfondir vos connaissances en Automatique en dehors des horaires de cours/TD/TP.

<!-- p. 4 -->

<a id="fiche-gbf"></a>

## Fiche GBF TG315 TTi : conseils d’utilisation

Utiliser la sortie de droite : MAIN OUT 50 Ω

Régler :
- La fréquence du signal (Pour les parties opératives de la salle B26, elle est faible, quelques Hertz
maximum)
- La forme du signal : constant, périodique carré, périodique triangulaire
- L’amplitude crête à crête du signal : Vpp (peak-to-peak)
- La valeur moyenne (bouton offset) du signal : souvent 0

Une tension constante sera obtenue quand tous les boutons de choix de forme sont relachés et en
fixant l’amplitude avec le bouton d’offset du GBF.

Les boutons d’atténuations (en haut à droite) permettent de générer des signaux d’amplitude faible
Toujours visualiser à l’oscilloscope le signal généré par le GBF pour vérifier ses caractéristiques

<a id="fiche-oscilloscope"></a>

## Fiche oscilloscope Keysight DSOX2004A : conseils d’utilisation

**NE JAMAIS APPUYER SUR AUTOSCALE**

Mode de réglage de l’oscilloscope pour observer une réponse à un échelon :
- Afin de visualiser l’intégralité du signal, choisir le couplage DC pour l’ensemble des voies de
l’oscilloscope
- Mettre le signal d’entrée ou la consigne sur la voie 1 de l’oscilloscope et synchroniser
l’oscilloscope sur la voie 1 (Menu Trigger), régler trigger (déclenchement) sur le front montant,
- La fréquence de renouvellement de l’écran étant faible, dans le menu "mode/coupling" :

  - Sélectionner le mode "normal" ou "non automatique" (sous l’écran),
  - Activer les filtres "Reject HF" et "Reject Bruit" afin d’éviter le déclenchement par les
parasites des signaux.
- Bien régler le seuil de déclenchement (Trigger) entre le min et le max du signal carré d’entrée ou
de consigne. Choisir « Couplage » CC pour que le T soit visible.
- Pour placer systématiquement l’instant du déclenchement au niveau du 1ier carreau à gauche de
l’écran (C’est à partir de ce « repère 0 » que l’échelle des temps se dilatera), dans le menu
« Horizontal » en haut à droite, cliquer sur le bouton "horiz" :

  - Sélectionner « Reference Temps » à Gauche (sous l’écran),
  - Appuyer sur le bouton « Push to zero » du menu « Horizontal »
- Choisir la base de temps de l’oscilloscope telle que on voit bien le régime transitoire (70%) et
régime permanent (30%) pour être bien sûr de la valeur finale même si le signal n’est pas
parfaitement constant (commutation entre les balais du moteur et de la DT) et que l’on voit 1 seul
échelon positif.
- Régler le calibre vertical pour que les signaux prennent un maximum de place sur l’écran.
- Faire les mesures en utilisant les curseurs de l’oscilloscope. Pour mesurer le TR5% ou τ, utiliser
le mode « suivre signal » (Choisir Source X1 : 2, Source X2 : 2, Cursor : X2, Positionner X1 et Y1).

Conseils :
- Adapter et choisir des calibres fins des voies de l’oscillo pour que les courbes occupent l’écran au
maximum (certains disent « décalibrer »).
- Quand on travaille sur un système en boucle fermée (bouclé) choisir le même calibre pour la
consigne C et la mesure M. Cela permet une comparaison facile et de bien voir l’erreur (C – M).
- Si le signal d’entrée ou de consigne est un signal carré sur lequel le déclenchement est facile, f aire
l’acquisition en mode "moyennage" (bouton acquire) sur 4 ou 8 acquisitions pour avoir une
courbe la moins bruitée possible (plus lisse). La courbe peut mettre quelques secondes à se figer.
- Si l’écran de l’oscilloscope ne se rafraichit plus, tenter de faire « force trigger ».

<!-- p. 5 -->

<a id="tp1"></a>

# TP1 – Etude de la vitesse d’un Moteur à Courant Continu au démarrage et en régime permanent

Expérimentation / Identification / Modèle de comportement

Optimisation avec MATLAB

L’objectif de ce TP1 est de modéliser un système réel « le moteur à courant continu (MCC) avec son
capteur de vitesse » afin de pouvoir simuler différents scénarios et prédire son fonctionnement.

<a id="tp1-attendus"></a>

**A la fin du TP1, vous devez savoir :**

1. Réaliser une réponse à un échelon d’un système et faire les mesures permettant de l’identifier et
aussi celles attestant de ses performances,

2. Choisir un modèle théorique (d’ordre 1 ou 2) à partir d’une réponse à un échelon de ce système réel,

3. Identifier les paramètres d’un modèle (d’ordre 1 ou 2) en utilisant des mesures sur l’oscilloscope et
éventuellement des abaques,

4. Identifier les paramètres d’un modèle (d’ordre 1 ou 2) en utilisant les scripts Matlab (minimisation
de l’erreur entre le modèle simulé et les mesures).

Le compte-rendu (fichier word) que vous allez faire de ce TP1 doit contenir les courbes obtenues sur
l’oscilloscope, avec les mesures faites avec les Cursors qui sont copiées à l’aide d’une clé USB et les
courbes obtenues avec Matlab. La réponse aux questions peut être dans le même fichier ou sur papier.

<a id="tp1-numeros"></a>
Notez dans votre compte-rendu le n° du moteur et de la platine de régulation.

Lisez les fiches GBF et oscilloscope page 4. Elles donnent des conseils pour une utilisation bien adaptée
aux systèmes « lents » avec un(des) moteur(s) ou une pompe.

## I. Identification du système : moteur avec sa dynamo tachymétrique seulement

Une dynamo tachymétrique (DT) (appelée aussi générateur tachymétrique) mesure la vitesse du moteur.

Elle transforme un mouvement mécanique (rotation de l’axe) en énergie électrique (tension continue). La
tension délivrée en sortie est proportionnelle à la vitesse de rotation du moteur.

[illisible : figure p. 5]

Figure 1 : Schéma fonctionnel du moteur (MCC), de l’amplificateur de courant et
du capteur de vitesse

<!-- p. 6 -->

Le MCC est toujours alimenté par l’amplificateur de courant situé en bas à
droite sur la « platine Régulateur Analogique», noté « Ampli » sur les schémas. Sa tension de
sortie est égale à sa tension d’entrée, mais le courant maximum qu’il peut fournir est plus
grand que celui du régulateur. Le gain en tension de cet ampli est 1.

[illisible : figure p. 6 — Amplificateur de courant : Entrée, Sortie (<1A), gain 1]

Face avant de cablage du moteur :
- Tension d’alimentation : entre les bornes rouge et noires à gauche
- Mesure de vitesse (sortie DT) : entre les bornes verte et jaune à droite
- Les bornes noire et jaune seront reliées à la masse de la platine « régulateur » avec des cables noirs.

[illisible : figure p. 6 — face avant du moteur : Rouge, Noir (Alim Moteur), Vert, Jaune (Sortie DT, <1A)]

<a id="tp1-reglages"></a>

**Réglages à effectuer (platine éteinte) :**

1. Réglez la tension de la sortie MAIN OUT (50 Ω) du GBF avec une forme périodique carrée de
fréquence la plus près possible de 1,3 Hz et avec une variation d’amplitude la plus près possible
de 12V sans offset (entre -6V et + 6V, Vpp ≈ 12V ) sur le GBF en l’observant sur l’oscilloscope.

<a id="tp1-cablage"></a>

**Câblages à réaliser (platine éteinte) :**

1. Alimentez l’amplificateur de courant avec la sortie MAIN OUT de droite (50Ω) du GBF.
2. Reliez la sortie de l’amplificateur de courant à l’entrée d’alimentation du moteur (rouge).
3. Reliez l’autre borne d’alimentation du moteur (noire) à une masse de la platine Régulateur
Analogique avec un cable noir.
4. Reliez la sortie du capteur de vitesse (Dynamo Tachymétrique) (borne verte) à la voie verte de
l’oscilloscope.
5. Reliez l’autre borne de sortie DT (jaune) à une masse de la platine Régulateur Analogique.
6. Reliez la sortie MAIN OUT de droite du GBF à la voie jaune de l’oscilloscope.

Souvent, le signal carré de sortie du GBF n’est pas symétrique ni correct quand le GBF est relié à la
platine « régulateur » éteinte. Il faut la mettre sous tension pour que le signal soit correct.

<a id="tp1-sous-tension"></a>
**Mettre sous tension la platine Régulateur**

Remarque : si le moteur se met à tourner tout le temps dans le même sens ou ne tourne pas du tout,
indépendamment de l’entrée :
- Eteindre la platine régulateur,
- Relier l’entrée de l’ampli de courant à la masse,
- Rallumer la platine,
- Remplacer la masse par le signal venant du GBF sur l’entrée de l’ampli de courant, sans
éteindre la platine.

Si nécessaire, ajustez la tension de la sortie du GBF en vérifiant sur l’affichage de l’oscilloscope.

Choississez les réglages de l’oscilloscope pour que l’on visualise l’échelon positif sur la majeure partie de
l’écran avec des courbes les plus « propres » possible (présentée comme en TD), (Vous devez suivre les
conseils de la fiche oscilloscope page 4 pour y arriver).
Dès que vous avez obtenu deux « belles » courbes, mettez l’oscilloscope en mode « STOP » puis
éteignez la platine « régulateur analogique» pour ne pas solliciter inutilement le moteur.

<!-- p. 7 -->

**Faire valider les courbes par l’enseignant avant de continuer.**

Prendre en photo le cablage complet pour l’inclure dans votre compte-rendu et assurez vous d’être
capable de le refaire.

## I.2. Identification du MCC dont on s’intéresse à la vitesse de rotation

### I.2.1 Identification par un modèle d’ordre 1 : Mesures directes sur l’écran de l’oscilloscope

L’entrée et la mesure n’ont pas comme condition initiale 0, donc on établira un modèle « en
variation » : $\dfrac{\text{variation de la mesure}}{\text{variation de l’entrée}} = \dfrac{\Delta M(p)}{\Delta U(p)}$ qui est le même modèle dont on parle en cours/TD car
on considère le système comme linéaire, donc il ne contient ni saturations, ni frottement sec et ne
dépend pas de l’amplitude de l’échelon. Les courbes sont juste décalées verticalement de leurs
valeurs initiales.

On va maintenant effectuer les mesures nécessaires pour trouver son modèle du 1ier ordre en
s’intéressant à l’échelon positif. La fonction de transfert aura la forme suivante :

$\dfrac{\Delta M(p)}{\Delta U(p)} = G_1(p) = \dfrac{G_0}{1+\tau p}$, les valeurs des 2 paramètres G0 et τ devant être déterminées à partir des
mesures adéquates (cf chapitre 1 du cours/TD AU3)

Remarques : toutes les mesures précises que vous allez faire, d’amplitude et de durées, seront des
variations, donc des ΔY=Y2–Y1 ou ΔX=X2-X1.

- ✓ La « valeur finale », m(∞), dont on parle en TD, est la variation de la mesure entre sa valeur à
l’instant de démarrage de l’échelon positif, considérée comme point de départ (Y1), et la
valeur stabilisée de la mesure à la fin de ce même « carré positif », considérée comme valeur
finale (Y2). Donc m(t=∞)=ΔY=Y2–Y1.
- ✓ La constante de temps τ, est le temps écoulé entre l’instant de démarrage de l’échelon positif « carré
positif », X1, et l’instant auquel la mesure atteint 0,63*m(∞), X2. Donc τ=ΔX=X2-X1 quand ΔY=Y2–Y1=0,63*m(∞).
- ✓ Le temps de réponse à 5%, TR5%, est le temps écoulé entre l’instant de démarrage de l’échelon positif
« carré positif », X1, et l’instant auquel la mesure atteint 0,95*m(∞), X2. Donc TR5%=ΔX=X2-X1
quand ΔY=Y2–Y1=0,95*m(∞).

**Mesures et calculs pour trouver les 2 paramètres G0 et τ :**

Pour chaque mesure, réalisée de la manière expliquée dans la remarque ci-dessus et quand
les 2 curseurs « Y1 et Y2 » ou « X1 et X2 » sont bien placés, sauvegardez l’écran au format .png
sur une clé USB (Save : recall => choix format => Appuyer sur « Enregistrer ») puis copiez la
figure dans votre fichier de compte-rendu puis donner le résultat en dessous.

Sauvegardez aussi une fois les signaux au format .csv pour l’identification avec Matlab du
paragraphe I.2.3. Recopiez ce fichier .csv dans votre dossier de travail et changez son nom par :
Signaux_1.csv

<a id="tp1-i21-q1"></a>
1. Mesurez m(∞) (ΔY sur la courbe verte),

<a id="tp1-i21-q2"></a>
2. Mesurez U0, amplitude crête-à-crête de la variation du signal d’alimentation carré (ΔY sur la
courbe jaune),

<!-- p. 8 -->

<a id="tp1-i21-g0"></a>
⇨ Calculez alors le gain statique du système, $G_0 = \dfrac{\Delta M(p\to 0)}{\Delta U} = \dfrac{m(t\to\infty)}{U_0}$ (sans unité)

<a id="tp1-i21-q3"></a>
3. Mesurez τ (ΔX sur la courbe verte),

<a id="tp1-i21-g1"></a>
⇨ Donner alors la fonction de transfert du 1ier ordre du système, G1(p).

<a id="tp1-i21-q4"></a>
4. Mesurez le temps de réponse à 5%, TR5%, en donnant tous les petits calculs nécessaires
(0,95*m(∞), …).

**Faire valider cette fonction de transfert G1(p) par l’enseignant.**

### I.2.2. Identification par un modèle d’ordre 2 : Mesures directes sur l’écran de l’oscilloscope

On conserve les mêmes courbes sur l’oscillo. On va maintenant effectuer les mesures nécessaires
pour trouver le modèle du 2ième ordre du système en s’intéressant à l’échelon positif. La fonction de
transfert aura la forme suivante : $\dfrac{\Delta M(p)}{\Delta U(p)} = G_2(p) = \dfrac{G_0}{1+\frac{2z}{\omega_n}p+\frac{1}{\omega_n^2}p^2}$, les valeurs des 3 paramètres G0,
z et wn devant être déterminées à partir des mesures adéquates (cf chapitre 3 du cours/TD AU3 ou
semestre 2, ressource OML2)

**Mesures et calculs pour trouver les 3 paramètres G0, z et wn :**

Pour chaque mesure, quand les 2 curseurs « Y1 et Y2 » ou « X1 et X2 » sont bien placés,
sauvegardez l’écran au format .png sur une clé USB puis copiez la figure dans votre fichier de
compte-rendu puis donner le résultat en dessous.

<a id="tp1-i22-q1"></a>
1. Le gain statique du système, G0, a déjà été déterminé en I.2.1. Redonnez-le.

<a id="tp1-i22-q2"></a>
2. Pour déterminer la valeur de z, mesurez sur l’oscilloscope les temps t1 et t3 pour atteindre
respectivement 26.4% et 80.1% de la valeur finale m(∞). Puis, calculez le rapport t3/t1 et mettez une
croix au point de la courbe t3/t1 de l’abaque ci-dessous, qui a comme ordonnée t3/t1. La valeur de z
est l’abscisse de ce point.

<!-- p. 9 -->

Abaque valide pour tous les systèmes d’ordre 2 tels que 0,5 < z < 3 (échelle logarithmique)

[illisible : figure p. 9 — abaque : courbes ωnt3, ωnt2, t3 / t1, t2 / t1, ωnt1 en fonction du coefficient d’amortissement z]

<a id="tp1-i22-q3"></a>
3. z étant estimé, mettez une croix au point de la courbe ωnt3 qui a comme abscisse z. La valeur de
ωn est l’ordonnée de ce point divisée par t3, en secondes.

La précision du résultat final dépend essentiellement de votre capacité à mesurer avec précision les temps
t1 et t3.

<a id="tp1-i22-g2"></a>
⇨ Donner alors la fonction de transfert du 2ième ordre du système, G2(p).

<a id="tp1-i22-q4"></a>
4. Le TR5%, a déjà été déterminé en I.2.1. Redonnez-le.

**Faire valider cette fonction de transfert G2(p) par l’enseignant.**

### I.2.3 Identification par un modèle d’ordre 1 ou 2 : Optimisation avec Matlab®

La méthode des moindres carrés permet de trouver les valeurs des paramètres d’un modèle (G0 et τ pour
un modèle du 1ier ordre ou G0, z et ωn pour un modèle du 2ième ordre) de telle sorte que ces valeurs des
paramètres permettent de minimiser la somme des carrés de la différence entre les valeurs simulées avec
ce modèle et les valeurs des mesures.

$\text{Critère à minimiser} = \sum_{\text{Pour toutes les mesures}} (\text{valeur simulée} - \text{valeur mesure})^2$

Le modèle obtenu avec ces valeurs des paramètres est le modèle du système qui nous intéresse.

Pour trouver les valeurs optimales des paramètres d’un modèle d’ordre 1 ou 2 :

<!-- p. 10 -->

1. Recopier les 3 fichiers « main_ident.m », « identif_ordre1.m » et « identif_ordre2.m » de V:\
Module_AU3\2026_2027_Cours_TD_TP_AU3\TP1_Identif_Matlab\ dans votre dossier de
travail
2. Ouvrez le fichier « main_ident.m » avec Matlab
3. Trouver dans ce programme la ligne où se trouve le nom du fichier .csv contenant les mesures
(Par défaut, Signaux_1.csv ) qui seront importées dans Matlab par la fonction uiimport. Si
nécessaire, modifier son nom en écrivant celui de votre fichier.
4. Lancer l’exécution de main_ident.m avec « RUN » (Change Folder : oui). Le fichier .csv
contenant les signaux sauvegardés sur l’oscilloscope va s’ouvrir dans une interface d’import de
données dans Matlab
5. Dans "Output Type" (à la place de « Table »), sélectionner "Column Vectors"
6. Choisir « Variable Names row » égal à 2 ici (ou, dans le cas général, la ligne qui contient :
second, Volt, Volt)
7. Cliquer sur « Import Data » dans « Import selection » en haut à droite,
8. Fermer la fenêtre d’Import en cliquant sur la croix tout en haut à droite,
9. Répondre à la question sur l’ordre du modèle dans la « Command Window » : d’abord
« 1 » puis cliquer sur « Entrée »,
10. Observer si la simulation de la réponse à un échelon du modèle est superposée (ou presque) aux
mesures ou pas (les légendes peuvent être déplacées avec la souris pour ne pas cacher les
courbes).
N’oubliez pas de recopier les courbes tracées par Matlab® dans votre compte-rendu (avec capture ou
Edit=>copie Figure).

Remarque : les 3 vecteurs suivants issus de l’oscilloscope sont créés dans le workspace (les noms sont
imposés par la sauvegarde) :

- Second : le vecteur des instants
- Volt : le vecteur des valeurs des signaux de la voie 1, jaune (Alimentation du moteur, U)

<!-- p. 11 -->

- volt1 : le vecteur des valeurs des signaux de la voie 2, verte (Mesure de vitesse, M)

Parfois, il est nécéssaire de réexécuter le fichier main_ident.m pour refaire l’import des données
correctement dans le cas où tous les signaux n’ont pas été recopiés dans le workspace de Matlab.

<a id="tp1-i23-q11"></a>
11. Est-ce qu’un modèle d’ordre 1 représente bien le comportement du démarrage du moteur et
la stabilisation de sa vitesse ? Vous pouvez zoomer sur le démarrage autour de t=0 (début du
régime transitoire) pour vous guider dans votre réponse.

<a id="tp1-i23-q12"></a>
12. Est-ce que les paramètres G0 et τ du modèle optimisé par Matlab (donnés dans la « Command
Window ») sont les mêmes que ceux que vous avez obtenus avec des mesures directement sur
l’écran de l’oscilloscope question 1.2.1 ?

Recommencer l’identification par la méthode des moindres carrés en répondant 2 à la question sur
l’ordre du modèle (point 9.).

N’oubliez pas de recopier les courbes tracées par Matlab® dans votre compte-rendu (avec capture ou
Edit=>copie Figure).

<a id="tp1-i23-o2-q1"></a>
1. Est-ce qu’un modèle d’ordre 2 représente bien le comportement du démarrage du moteur et
la stabilisation de sa vitesse ? Vous pouvez zoomer sur le démarrage autour de t=0 (début du
régime transitoire) pour vous guider dans votre réponse.

<a id="tp1-i23-o2-q2"></a>
2. Est-ce que les paramètres G0, z et ωn du modèle optimisé par Matlab (donnés dans le workspace)
sont les mêmes que ceux que vous avez obtenus avec des mesures directement sur l’écran de
l’oscilloscope question 1.2.2 ?

<a id="tp1-conclusion"></a>
**Conclure sur l’ordre le plus probable du système réel. Justifiez**

N’hésitez pas à zoomer sur le démarrage autour de t=0 (début du régime transitoire) pour vous guider
dans votre réponse.

<a id="tp1-deviner"></a>
**Aurait-on pu le deviner dès que l’on a obtenu la réponse à un échelon ? Comment ?**

S’il vous reste du temps : compléter le script « main-ident.m » pour tracer la réponse à un échelon
du modèle d’ordre 2 que vous avez trouvé question 1.2.2, sur la même figure que les 2 autres courbes
(mesures et réponse à un échelon du modèle optimisé par matlab).

<!-- p. 12 -->

<a id="tp2"></a>

# TP2 – Etude, au démarrage et en régime permanent, de la vitesse d’un Moteur à Courant Continu (MCC) bouclé avec un régulateur proportionel

Expérimentation / Identification / Modèle de comportement
Optimisation avec Matlab

Asservissement : effets de différents réglages du régulateur

L’objectif de ce TP2 est de modéliser un système réel « le moteur à courant continu (MCC) avec son
capteur de vitesse » asservi en boucle fermée avec un régulateur proportionel afin de pouvoir simuler
différents scénarios et prédire son fonctionnement (démarrage et régime permanent) en fonction du
réglage du paramètre K du régulateur R(p).

<a id="tp2-attendus"></a>

**A la fin du TP2, vous devez savoir :**

1. Effectuer le cablage d’un système en boucle fermée avec un régulateur proportionnel avec les
platines à disposition en salle B26,
2. Réaliser une réponse à un échelon de ce système bouclé et faire les mesures sur l’oscilloscope
permettant de l’identifier (modèle d’ordre 2) et aussi celles attestant de ses performances dans
différents cas,
3. Choisir un modèle théorique (d’ordre 2 avec facteur d’amortissement supérieur ou inférieur à 1) à
partir d’une réponse à un échelon de ce système réel bouclé,
4. Identifier les paramètres d’un modèle (d’ordre 2) en utilisant les scripts Matlab (minimisation de
l’erreur entre le modèle simulé et les mesures),
5. Choisir la meilleure valeur du paramètre K pour que le système bouclé ait les performances
souhaitées ou conclure que le régulateur proportionnel n’est pas adapté au cahier des charges du
client (qui veut toujours une erreur statique nulle entre la consigne et la mesure, notamment).

Le compte-rendu que vous allez faire de ce TP2 doit contenir les courbes obtenues sur l’oscilloscope, avec
les mesures faites avec les Cursors qui sont copiées à l’aide d’une clé USB et les courbes obtenues avec
Matlab. La réponse aux questions peut être dans le même fichier ou sur papier.

Reprenez le même moteur et la même platine de régulation qu’au TP1.
Créez le dossier « TP2 » pour y placer votre compte-rendu et les fichiers utilisés pour l’identification.

## I. Expérimentation/Observations/Identification d’un MCC avec son capteur de vitesse en boucle fermée avec un régulateur proportionnel R(p) = K pour différentes valeurs du gain K

La figure 1 donne le diagramme fonctionnel de ce système bouclé :

[illisible : figure p. 12]

Figure 1 : Schéma fonctionnel de l’asservissement de vitesse d’un moteur en
boucle fermée avec un régulateur

<!-- p. 13 -->

Le MCC est toujours alimenté par l’amplificateur de courant situé sur la
« platine Régulateur Analogique», noté « Ampli » sur les schémas. Sa tension de sortie
est égale à sa tension d’entrée, mais le courant maximum qu’il peut fournir est plus grand que
celui du régulateur. Le gain en tension de cet ampli est 1.

[illisible : figure p. 13 — Amplificateur de courant : Entrée, Sortie (<1A), gain 1]

Face avant de cablage du moteur :
- Tension d’alimentation : entre les bornes rouge et noires à gauche
- Mesure de vitesse (sortie DT) : entre les bornes verte et jaune à droite
- Les bornes noire et jaune seront reliées à la masse de la platine « régulateur » avec des cables noirs.

[illisible : figure p. 13 — face avant du moteur : Rouge, Noir (Alim Moteur), Vert, Jaune (Sortie DT, <1A)]

<a id="tp2-reglages"></a>

**Réglages à effectuer (platine éteinte) :**

1. Réglez la tension de la sortie MAIN OUT du GBF avec une forme périodique carrée de fréquence
la plus près possible de 2 Hz et avec une variation d’amplitude la plus près possible de 3,2V sans
offset (entre -1,6V et + 1,6V, Vpp ≈ 3,2V), en l’observant sur la voie 1 (jaune) de l’oscilloscope.
2. Réglez le paramètre K à 3,8 sur la platine régulateur : pour cela, réglez « Affichage G1 » à 38 et
G2 avec le coté appuyé sur 10 (K=38*10/100)

<a id="tp2-cablage"></a>

**Câblages à réaliser (en boucle fermée cette fois) (platine éteinte) :**

1. Alimentez l’entrée de consigne (verte) de la platine régulation avec la sortie MAIN OUT de droite
du GBF.
2. Reliez la sortie de l’amplificateur G2 (<25 mA) de la platine régulation à l’entrée de l’amplificateur
de courant (verte)
3. Reliez la sortie bleue de l’amplificateur de courant (< 1A) à l’entrée d’alimentation du moteur
(rouge).
4. Reliez l’autre borne d’alimentation du moteur (noire) à une masse de la platine Régulateur
Analogique avec un cable noir.
5. Reliez la sortie du capteur de vitesse (Dynamo Tachymétrique) (borne verte) à la borne verte
« Mesure » de la platine « Régulateur » pour fermer la boucle.
6. Reliez l’autre borne de sortie DT (jaune) à une masse de la platine Régulateur Analogique avec un
cable noir.
8. Reliez la sortie du capteur de vitesse (Dynamo Tachymétrique) (borne verte) à la voie 2 (verte) de
l’oscilloscope.
9. Reliez la sortie de l’amplificateur G2 (<25 mA), c’est-à-dire la sortie du régulateur, appelée
commande U, à la voie 3 (bleue) de l’oscilloscope. Réglez le calibre de la voie 3 (uniquement) à
5V pour bien voir si le signal U est linéaire ou s’il sature (à ±10,6 V).
10. Reliez la signal d’erreur (Borne « Erreur »), sur la voie 4 (rose) de l’oscilloscope.

<a id="tp2-sous-tension"></a>
**Mettre sous tension la platine Régulateur**

Remarque : si le moteur se met à tourner tout le temps dans le même sens ou ne tourne pas du tout,
indépendamment de l’entrée :

- Eteindre la platine régulateur,
- Relier l’entrée de l’ampli de courant à la masse,
- Rallumer la platine,
- Remplacer la masse par le signal venant du GBF sur l’entrée de l’ampli de courant, sans
éteindre la platine.

<!-- p. 14 -->

Souvent, le signal périodique carré de sortie du GBF n’est pas symétrique ni correct quand le GBF
est relié à la platine « régulateur » éteinte. Il faut la mettre sous tension pour que le signal soit correct.

Si nécessaire, ajustez la tension de la sortie du GBF en vérifiant que la variation d’amplitude est bien la
plus près possible de 3,2V sur l’écran de l’oscilloscope.

Choisissez les réglages de l’oscilloscope pour visualiser l’échelon positif sur la majeure partie de l’écran
avec des courbes les plus « propres » possible (présentée comme en TD), (Vous devez suivre les conseils
de la fiche oscilloscope page 4 pour y arriver). Conseil : moyennage = 16

Dès que vous avez obtenu deux « belles » courbes occupant un maximum de l’écran pour la consigne
(jaune) et la mesure (verte), mettez l’oscilloscope en mode « STOP » puis éteindre la platine
« régulateur analogique» pour ne pas solliciter inutilement le moteur.

**Faire valider les courbes par l’enseignant avant de continuer.**

Prendre en photo le cablage complet pour l’inclure dans votre compte-rendu.

## I.1. Identification du MCC avec son capteur de vitesse en boucle fermée avec R(p)=K=3,8

<a id="tp2-i1-ordre"></a>
A l’observation de la courbe verte, d’après vos connaissances et le cours/TD AU3, quel pourrait être
l’ordre de ce système (on pourra regarder la tangente au démarrage (à l’origine) en zoomant et se
rappeler du TP1) ?

Sauvegardez une fois les signaux au format .csv (les voies jaunes et vertes uniquement) pour
l’identification avec Matlab du I.1.3. Recopiez ce fichier dans votre dossier de travail et changez son
nom par : Signaux_2.csv

### I.1.1. Identification par un modèle d’ordre 2 : Mesures directes sur l’écran de l’oscilloscope

On va effectuer les mesures nécessaires pour trouver un modèle du 2ième ordre du système bouclé en
s’intéressant à l’échelon positif. La fonction de transfert aura la forme suivante :

$\dfrac{\Delta M(p)}{\Delta C(p)} = G_{b2}(p) = \dfrac{G_{0b}}{1+2z_b p/\omega_{nb}+p^2/\omega_{nb}^2}$ : les valeurs des 3 paramètres G0b, z b et wnb devant être
déterminées à partir des mesures adéquates (sera traité chapitre 3 du cours/TD). Comme le système
est bouclé, on ajoute l’indice b aux noms des paramètres et de la fonction de transfert.

Rappels : toutes les mesures précises que vous allez faire, d’amplitude et de durées, seront des
variations, donc des ΔY=Y2–Y1 ou ΔX=X2-X1.

- ✓ La « valeur finale », m(∞), dont on parle en TD, est la variation de la mesure entre sa valeur à
l’instant de démarrage de l’échelon positif, considérée comme point de départ (Y1), et la
valeur stabilisée de la mesure à la fin de ce même « carré positif », considérée comme valeur
finale (Y2). Donc m(t=∞)=ΔY=Y2–Y1.
- ✓ Le temps de réponse à 5%, TR5%, est le temps écoulé entre l’instant de démarrage de l’échelon positif
« carré positif », X1, et l’instant auquel la mesure atteint 0,95*m(∞), X2 quand il n’y a pas de
dépassement. Donc TR5%=ΔX=X2-X1 quand ΔY=Y2–Y1=0,95*m(∞).

**Mesures et calculs pour trouver les 3 paramètres de ce système en boucle fermée, G0b, z b et wnb :**

<!-- p. 15 -->

Pour chaque mesure, réalisée de la manière habituelle et quand les 2 curseurs « Y1 et Y2 » ou « X1
et X2 » sont bien placés, sauvegardez l’écran au format.png sur une clé USB puis copiez la figure
dans votre fichier de compte-rendu puis donner le résultat en dessous.

<a id="tp2-i11-q1"></a>
1. Est-ce que la mesure de la vitesse m(∞) (en Volts) atteint la valeur de la consigne C0 (en Volts) en
régime permanent (erreur statique nulle) ?

<a id="tp2-i11-q2"></a>
2. Mesurez m(∞),

<a id="tp2-i11-q3"></a>
3. Mesurez/Rappelez C0, amplitude crête-à-crête de la variation du signal de consigne carré.

<a id="tp2-i11-q4"></a>
4. Calculez alors le gain statique du système bouclé, $\boldsymbol{G_{0b}} = \dfrac{\mathbf{m(\infty)}}{C_0} = \dfrac{\Delta M}{\Delta C}$ (sans unité)

<a id="tp2-i11-q5"></a>
5. Pour déterminer la valeur de zb, on procède comme dans le TP1 car la réponse à un échelon n’est
pas oscillatoire amortie (pas de dépassement ni d’oscillations). C’est-à-dire :

<a id="tp2-i11-q6"></a>
6. Pour déterminer la valeur de zb, mesurez sur l’oscilloscope les temps t1 et t3 pour atteindre
respectivement 26.4% et 80.1% de la valeur finale m(∞). Puis, calculez le rapport t3/t1 et mettez
une croix au point de la courbe t3/t1 qui a comme ordonnée t3/t1. La valeur de zb est l’abscisse de
ce point.

Abaque valide pour tous les systèmes d’ordre 2 tels que 0,5 < z < 3

[illisible : figure p. 15 — abaque : courbes ωnt3, ωnt2, t3 / t1, t2 / t1, ωnt1 en fonction du coefficient d’amortissement z]

<a id="tp2-i11-q7"></a>
7. zb étant estimé, mettez une croix au point de la courbe ωnt3 qui a comme abscisse zb. La valeur
de ωnb est l’ordonnée de ce point divisée par t3 en secondes.

<!-- p. 16 -->

La précision du résultat final dépend essentiellement de votre capacité à mesurer avec précision
les temps t1 et t3.

<a id="tp2-i11-gb2"></a>
⇨ Donner alors la fonction de transfert du 2ième ordre du système, Gb2(p).

<a id="tp2-i11-q8"></a>
8. Calculez les valeurs numériques théoriques G0b théorique, zb théorique, ωnb théorique, grace aux valeurs
trouvées lors du TP1 en boucle ouverte G0, z et ωn et avec K=3,8 sachant que les formules sont
(le calcul sera effectué en cours/TD AU3) :

$G_{0b\,\text{théorique}} = \frac{KG_0}{1+KG_0}, \quad z_{b\,\text{théorique}} = \frac{z}{\sqrt{1+KG_0}}, \quad \omega_{nb\,\text{théorique}} = \omega_n\sqrt{1+KG_0}$

<a id="tp2-i11-q9"></a>
9. Comparez les aux valeurs que vous venez de trouver par identification.

<a id="tp2-i11-q10"></a>
10. Mesurez le temps de réponse à 5%, TR5%b, en donnant tous les petits calculs nécessaires
(0,95*m(∞), …).

**Faire valider cette fonction de transfert Gb2(p) par l’enseignant.**

### I.1.2 Identification par un modèle d’ordre 2 avec K = 3,8 : Optimisation avec Matlab®

Copier les 2 fichiers « main_ident.m » et « identif_ordre2.m » que vous avez déjà utilisé lors du TP1
dans le dossier TP2.

Pour trouver les valeurs optimales des paramètres du modèle d’ordre 2 :
1. Ouvrez le fichier « main_ident.m » avec Matlab,
2. Trouvez dans ce programme la ligne où se trouve le nom du fichier .csv contenant les mesures
qui seront importées dans Matlab par la fonction uiimport. Si nécessaire, modifier son nom en
écrivant celui de votre fichier pour ce TP2 : uiimport('Signaux_2.csv') par exemple
3. Lancer l’exécution de main_ident.m avec « RUN ». Le fichier .csv contenant les signaux
sauvegardés sur l’oscilloscope va s’ouvrir dans une interface d’import de données dans Matlab
4. Sélectionner "Column Vectors" dans "Output Type" (à la place de « Table »)
5. Choisir « Variable Names row » égal à 2 ici (ou, dans le cas général, la ligne qui contient :
second, Volt, Volt)
6. Cliquer sur « Import Data » dans « Import selection » en haut à droite
7. Fermer la fenêtre d’Import en cliquant sur la croix tout en haut à droite
8. Répondre à la question sur l’ordre du modèle : « 2 » puis cliquer sur « Entrée »,
<a id="tp2-i12-q9"></a>
9. Est-ce que les valeurs des 3 paramètres G0b, zb, ωnb sont les mêmes que celles que vous avez
trouvées avec des mesures directes sur l’écran de l’oscilloscope ?

<!-- p. 17 -->

<a id="tp2-i12-q10"></a>
10. Observer si la simulation de la réponse à un échelon du modèle est superposée (ou presque) aux
mesures ou pas (les légendes peuvent être déplacées avec la souris pour ne pas cacher les
courbes).
N’oubliez pas de recopier les courbes tracées par Matlab® dans votre compte-rendu (avec capture ou
Edit=>copie Figure).

<a id="tp2-i12-q11"></a>
11. Est-ce que le modèle d’ordre 2 que vous avez trouvé représente bien le comportement du
démarrage du moteur et la stabilisation de sa vitesse ? Vous pouvez zoomer sur le démarrage
autour de t=0 (début du régime transitoire) pour vous guider dans votre réponse.

<a id="tp2-i12-q12"></a>
12. Si zb ≥ 1, notez les valeurs des 2 constantes de temps trouvées : tau1 et tau2. L’une est elle
négligeable par rapport à l’autre ?

## I.2. Identification du MCC avec son capteur de vitesse en boucle fermée avec une régulateur proportionnel dont le gain est beaucoup plus grand, K=40

<a id="tp2-i2-reglages"></a>

**Réglages à changer (platine éteinte) :**

a) Changez l’amplitude de la tension de la sortie MAIN OUT du GBF avec une forme périodique
carrée avec une fréquence la plus près possible de 2 Hz avec variation d’amplitude la plus près
possible de 0,3V sans offset (Vpp ≈ 0,3V). Utilisez l’atténuation d’amplitude de 20dB si
nécessaire).

b) Réglez le paramètre K à 40 sur la platine régulateur : pour cela, réglez « Affichage G1 » à 40
et G2 coté appuyé à 100 (K=40/100*100)

Remarque : il est possible que le signal de sortie « semble » ne pas s’afficher. Dézoomez
temporellement de façon à voir une période entière.

**Mettre sous tension la platine Régulateur**

<a id="tp2-i2-ordre"></a>
A l’observation de la courbe verte de mesure et d’après vos connaissances du cours/TD d’AU3, quel
pourrait être l’ordre de ce système bouclé ?
**Faire valider les courbes par l’enseignant avant de mesurer.**
Sauvegardez les signaux au format .csv (les voies jaunes et vertes uniquement) pour l’identification
avec Matlab du I.2.2. Recopiez ce fichier dans votre dossier de travail et changez son nom par :
Signaux_2_40.csv

Puis, pour chaque mesure, réalisée de la manière habituelle et quand les 2 curseurs « Y1 et Y2 » ou
« X1 et X2 » sont bien placés, sauvegardez l’écran au format.png sur une clé USB puis copiez la
figure dans votre fichier de compte-rendu puis donner le résultat en dessous.

### I.2.1. Mesures directes sur l’écran de l’oscilloscope :
<a id="tp2-i21-q1"></a>
1. Avec ce nouveau réglage du paramètre K, est-ce que la mesure de la vitesse m(∞) atteint
maintenant la valeur de la consigne C0 en régime permanent (erreur statique nulle) ?

<!-- p. 18 -->
<a id="tp2-i21-q2"></a>
2. Mesurez la valeur de la consigne C0, en positionnant correctement les 2 curseurs Y1 et Y2 et en
regardant la variation correspondante ΔY.
<a id="tp2-i21-q3"></a>
3. Mesurez la valeur de la mesure M en régime statique, m(∞), en positionnant correctement les 2
curseurs Y1 et Y2 et en regardant la variation correspondante ΔY.

<a id="tp2-i21-q4"></a>
4. Calculez le gain statique du système bouclé, $\boldsymbol{G_{0b}} = \dfrac{\Delta M(p\to 0)}{\Delta C} = \dfrac{m(t\to\infty)}{C_0}$.
<a id="tp2-i21-q5"></a>
5. Est-ce le même que pour K=3.8 (question 4. du I.1.1.) ? Pour quelle raison ?
<a id="tp2-i21-q6"></a>
6. Mesurez le premier dépassement D1 (défini sur la figure ci-dessous) en positionnant
correctement les 2 curseurs Y1 et Y2 et en regardant la variation correspondante ΔY.

[illisible : figure p. 18 — m(t), m(∞), D1b, Tpb/2, Tpb]

$$\omega_{nb} = \frac{2\pi}{T_{pb}\sqrt{1-z_b^2}}$$

<a id="tp2-i21-q7"></a>
7. Calculez D1/m(∞).

<a id="tp2-i21-q8"></a>
8. Puis calculez la valeur de zb avec la formule générale suivante (même notations que la figure de la
question 6. ou à l’aide de l’abaque ci-dessous :

[illisible : figure p. 18 — formule générale et abaque D1/m(∞) en fonction du coefficient d’amortissement zb]

<!-- p. 19 -->
<a id="tp2-i21-q9"></a>
9. Mesurez Tpb ou Tpb/2.

<a id="tp2-i21-q10"></a>
10. Calculez ωnb avec la formule générale donnée avec la figure de la question 6.

Rappel : dans le cas général, Tr5% (ou Tr5%b en boucle fermée) est le temps mis par la mesure m(t) pour
arriver et rester dans l’intervallem(∞)±5%ΔM c’est-à-dire l’intervalle [0.95ΔM 1.05ΔM]. Dit autrement,
c’est le temps mis par la mesure m(t) pour faire 95% ou 105% de la variation ΔM tout en restant à moins
de ±5%ΔM de la valeur finale m(∞) ensuite, quand t > Tr5% (ou Tr5%b en boucle fermée).

<a id="tp2-i21-q12"></a>
12. Mesurez le temps de réponse à 5% du système bouclé, TR5%b, en donnant tous les petits calculs
nécessaires (0,95*m(∞), 1,05*m(∞), …). Est il le même que pour le réglage K=3,8 ? Pour quelle
raison ?

**Faire valider cette fonction de transfert G40b2(p) par l’enseignant.**

### I.2.2. Identification par un modèle d’ordre 2 avec K = 40 : Optimisation avec Matlab®

Comme d’habitude, pour trouver les valeurs optimales des paramètres du modèle d’ordre 2 :

1. Ouvrez le fichier « main_ident.m » avec Matlab,
2. Trouvez dans ce programme la ligne où se trouve le nom du fichier .csv contenant les mesures
(Par défaut, Signaux_1.csv ) qui seront importées dans Matlab par la fonction uiimport. Si
nécessaire, modifier son nom en écrivant celui de votre fichier pour ce TP2 :
uiimport('Signaux_2_40.csv') par exemple
3. Lancer l’exécution de main_ident.m avec « RUN ». Le fichier .csv contenant les signaux
sauvegardés sur l’oscilloscope va s’ouvrir dans une interface d’import de données dans Matlab
4. Sélectionner "Column Vectors" dans "Output Type" (à la place de « Table »)
5. Choisir « Variable Names row » égal à 2 ici (ou, dans le cas général, la ligne qui contient :
second, Volt, Volt)
6. Cliquer sur « Import Data » dans « Import selection » en haut à droite
7. Fermer la fenêtre d’Import en cliquant sur la croix tout en haut à droite

<!-- p. 20 -->

8. Répondre à la question sur l’ordre du modèle : « 2 » puis cliquer sur « Entrée »,

<a id="tp2-i22-q9"></a>
9. Est-ce que les valeurs des paramètres sont les mêmes que celles que vous avez trouvées avec
des mesures directes sur l’écran de l’oscilloscope ?

<a id="tp2-i22-q10"></a>
10. Observer si la simulation de la réponse à un échelon du modèle est superposée (ou presque) aux
mesures ou pas (les légendes peuvent être déplacées avec la souris pour ne pas cacher les
courbes). Les différences principales sont elles au démarrage (régime transitoire) ou en régime
permanent ?

N’oubliez pas de recopier les courbes tracées par Matlab® dans votre compte-rendu (avec capture ou
Edit=>copie Figure).
<a id="tp2-i22-q11"></a>
11. Est-ce que ce modèle d’ordre 2 représente bien le comportement du démarrage du moteur et la
stabilisation de sa vitesse quand il est asservi en boucle fermée avec un régulateur proportionnel
de gain K=40 ? Pour quelle raison ? Quel phénomène physique a pu être négligé dans le
modèle ?

<a id="tp2-i22-q12"></a>
12. S’il vous reste du temps : compléter le script « main-ident.m » pour tracer la réponse à un
échelon du modèle d’ordre 2 que vous avez trouvé question 13. du I.2.1., sur la même figure
que les 2 autres courbes (mesures et réponse à un échelon du modèle optimisé par matlab).
## Conclusions du TP2 à retenir
<a id="tp2-conclusion-1"></a>
1. Est-ce que cette méthode d’asservissement en "bouclant" le MCC avec son capteur de vitesse et un
régulateur proportionnel permet à la mesure m(t) de rejoindre la consigne c(t) en régime permanent
avec une erreur statique nulle donc une précision parfait, comme l’attend tout client ?
<a id="tp2-conclusion-2"></a>
2. Est-ce que cette réponse à la question 1. de la conclusion dépend de la valeur de K ?

Pour laquelle des 2 valeurs de K, 3,8 ou 40 :

<a id="tp2-comparaison-ecart"></a>
- A-t-on l’écart statique le plus faible entre la consigne c(t) et la mesure m(t) en régime permanent ?
<a id="tp2-comparaison-tr5"></a>
- A-t-on le temps de réponse Tr5%b le plus faible ?
<a id="tp2-comparaison-depassement"></a>
- A-t-on le dépassement le plus grand ?

Ce TP vous a permis de voir l’importance du choix de la valeur du gain K du régulateur pour que le régime
transitoire corresponde aux besoins de l’utilisateur (Cahier des charges). Les conclusions concernant le
TR5%b et les dépassements seront toujours valables pour les TPs suivants. Mais, cette méthode
d’asservissement de vitesse avec un régulateur proportionnel ne donne pas de bons résultats concernant
la performance de précision. On verra dans le TP 4 comment résoudre ce problème et répondre
complètement au cahier des charges du client.

<!-- p. 21 -->

<a id="tp3"></a>

# TP3 – Asservissement de position d’un moteur à courant continu avec un régulateur Proportionnel

Commande automatique de l’orientation d’une antenne puis de
la position d’un balai d’essui-glace

Expérimentations, observations et mesure des performances

Les objectifs de ce TP sont :
- d’étudier les performances d’un asservissement de position (orientation d’une antenne virtuelle
puis de la position angulaire d’un balai d’essui-glace) effectué avec un moteur à courant continu,
un capteur de position angulaire et un régulateur proportionnel.
- De trouver un réglage du régulateur qui permet le respect du cahier des charges du client

<a id="tp3-attendus"></a>

**A la fin du TP3, vous devez savoir :**

- Effectuer le cablage d’un asservissement de position effectué avec un moteur à courant continu, un
capteur de position angulaire et un régulateur proportionnel.
- Visualiser et comprendre le signal en sortie du capteur de position angulaire (potentiomètre rotatif)
quand le moteur est alimenté par une tension continue (en boucle ouverte).
- Visualiser et comprendre le signal en sortie du capteur de position angulaire (potentiomètre rotatif)
quand la consigne est changée manuellement (en boucle fermée) : orientation d’une antenne
parabolique.
- Réaliser une réponse à un échelon du système bouclé (balai d’essui-glace) et faire les mesures
permettant d’attester de ses performances : précision, rapidité, dépassement.

Les cahiers des charges des clients pour les différents asservissements de position sont :
- Orientation de l’antenne parabolique : quand la consigne est changée manuellement, la mesure
en Volts de la position angulaire doit suivre au mieux la consigne de position donnée en Volts et se
stabiliser sans erreur statique.
- Position d’un balai d’essui-glace central : quand la consigne est périodique de forme carrée, la
mesure (en Volt) de la position angulaire doit se stabiliser à la valeur de la consigne donnée en
Volts, sans erreur statique en régime permanent, et le temps de réponse à 5%, TR5%b, doit être
inférieur à 200 ms.
- Si vous avez le temps : Dans le cas où la consigne est périodique de forme triangulaire, la mesure
(en Volt) de la position angulaire doit suivre la valeur de la consigne, avec une erreur de trainage
(en régime permanent) de maximum 0,15V pour f=0,7 Hz.

Le compte-rendu que vous allez faire de ce TP3 doit contenir les courbes obtenues sur l’oscilloscope, avec
les mesures faites avec les Cursors qui sont copiées à l’aide d’une clé USB et les courbes obtenues avec
Matlab. La réponse aux questions peut être dans le même fichier ou sur papier.

Notez le numéro du moteur que vous utilisez.

<!-- p. 22 -->

## I. Etude du signal en sortie du capteur de position angulaire (potentiomètre rotatif) quand le moteur de l’antenne ou du balai d’essui-glace central est alimenté par une tension constante de 12V (en boucle ouverte)

Un potentiomètre rotatif mesure la position angulaire de l’axe du moteur et donc mesure l’orientation de
l’antenne (virtuelle représentée par le disque fixé sur l’axe du moteur) ou la position du balai d’essui-glace
(virtuel représenté par le disque fixé sur l’axe du moteur).
Il transforme un mouvement mécanique (rotation de l’axe) en énergie électrique (tension).
La tension délivrée en sortie du potentiomètre est proportionnelle à la vitesse de rotation du moteur.

[illisible : figure p. 22]

Figure 1 : Schéma fonctionnel des différents éléments des 2 maquettes utilisées : régulateur et Moteur

On s’intéresse ici à la position angulaire. Or, la vitesse angulaire est : $\Omega(t) = \theta'(t) = \dfrac{d\theta(t)}{dt}$. Donc, la
position angulaire est l’intégrale de la Vitesse angulaire : $\theta(t) = \int_0^t \Omega(\sigma)\,d\sigma$. En prenant la transformée
de Laplace, on a : $\theta(p) = \dfrac{1}{p}\,\Omega(p)$ (d’après l’annexe de votre poly de Cours/TD).

Deux schémas du potentiomètre rotatif sont donnés figure 2 ci-dessous :

[illisible : figure p. 22]

Figure 2 : capteur de position angulaire (vue de profil et vue de face)

Dans l’angle mort, la mesure n’est pas correcte (à cet endroit à, la tension n’est pas proportionnelle à
l’angle). On ne peut donc pas réguler le système à une position comprise dans l’angle mort.
L’angle mort est composé de 3 parties :

1. La largeur de la soudure pour alimenter avec -12 V
2. La largeur de l’isolant à 0V
3. La largeur de la soudure pour alimenter avec +12 V

**Réglages à effectuer sur l’oscilloscope (platine éteinte) :**

1. Réglez le calibre de la voie 2 (verte) à 5V

<!-- p. 23 -->

2. Régler le calibre horizontal (temps) à 100ms

**Câblages à réaliser (platine éteinte) :**

1. Reliez la sortie +12V de la platine « Régulateur Analogique » (en bas à gauche) à l’entrée de
l’amplificateur de courant.
2. Reliez la sortie bleue de l’amplificateur de courant (< 1A) à l’entrée d’alimentation rouge du
moteur (ou bleue sur le moteur « blanc »).
3. Reliez la borne noire d’alimentation du moteur à une masse de la platine
« Régulateur Analogique » avec un cable noir.
4. Alimentez le potentiomètre rotatif en reliant la sortie -12V en bas à gauche de la platine
« Régulateur Analogique » à la borne rouge (ou jaune sur le moteur « blanc ») du capteur et en
reliant la sortie +12V en bas à gauche de la platine « Régulateur Analogique » à la borne bleue (ou
rouge sur le moteur « blanc ») du capteur.
5. Reliez la sortie du potentiomètre rotatif (borne verte) qui est la mesure de la position angulaire à la
voie 2 (verte) de l’oscilloscope.

**Mettre sous tension la platine Régulateur**

Il n’est pas nécessaire de moyenner les signaux dans ce paragraphe I.

Vérifiez que les segments de droites ont une pente positive. Cela signifie que le gain du moteur
est positif. Si ce n’est pas le cas, inversez les connexions du potentiomètre rotatif à -12 V et +12 V.

Dès que vous avez obtenu une « belle » courbe avec environ 2 périodes, mettez l’oscilloscope en mode
« STOP » puis éteindre la platine « régulateur analogique» pour ne pas solliciter inutilement le moteur.

Remarque : Cette courbe est la caractéristique statique du potentiomètre de mesure, M=f(qM).

Prendre en photo le cablage complet pour l’inclure dans votre compte-rendu.

**Observations, mesures et calculs pour trouver les caractéristiques du capteur :**

1. Est-ce que le signal de mesure de la position angulaire est bien proportionnel à la position angulaire
(linéaire) la majorité du temps (segment de droite incliné) ?

2. Constate-t-on une certaine périodicité de ce signal ? Si oui, comment l’expliquez vous ?

3. Décrivez la courbe et expliquez ce que représentent physiquement les 3 parties qui composent cet
angle mort qui correspond à toute la partie de la courbe qui n’est pas linéaire (pas une droite).
Relisez les explications page précédente si nécessaire.

4. Sur l’oscilloscope, changez le calibre des temps à 100ms et déplacez la courbe pour visualiser une
période. Déterminez la période temporelle de ce signal de mesure de position angulaire en utilisant
les Data Cursors de l’oscilloscope. Copiez cette courbe dans votre compte-rendu de TP, à l’aide
d’une clé USB. A quelle période angulaire est ce que cela correspond (en degrés) ?

5. Ensuite, mesurez l'angle mort du potentiomètre, en degrés (ne zoomez pas trop pour bien voir
les cassures du signal) après avoir effectué la mesure adéquate.

Pour chaque mesure, quand les 2 curseurs « X1 et X2 » sont bien placés, sauvegardez l’écran au format
.png sur une clé USB puis copiez la figure dans votre fichier de compte-rendu puis donner le résultat en
dessous.

<!-- p. 24 -->

**Faire valider la mesure de l’angle mort par l’enseignant avant de continuer.**

6. Est-ce que ce système en boucle ouverte est de même nature, avec le même type de comportement,
que les systèmes des TP1 et TP2 (stabilisation de la mesure après un certain temps) ?

## II. Etude des performances d’un asservissement de position angulaire d’une antenne ou d’un système téléopéré ou d’un balai d’essui-glace central de vitre arrière dont le moteur est en boucle fermée avec un régulateur proportionnel

### II.1. Commande automatique de l’orientation d’une antenne parabolique ou d’un système téléopéré : consigne changée manuellement

La figure 3 donne le diagramme fonctionnel de ce système bouclé :

[illisible : figure p. 24]

Figure 3 : Schéma fonctionnel de l’asservissement de position angulaire

Pour effectuer le câblage correspondant à ce schéma fonctionnel, nous allons modifier et compléter le
câblage déjà fait à la question précédente, de manière suivante :

**Réglages à changer (platine éteinte) :**

1. Relachez tous les boutons de choix de forme du signal du GBF pour obtenir une tension de consigne
constante. La valeur de la tension de sortie du GBF se règle alors manuellement avec le bouton
d’offset du GBF.
2. Réglez « Affichage G1 » à 70 et G2 à 10 (coté appuyé) (K = G2*(Affichage G1) /100) pour obtenir
K = 7.
3. Réglez les voies 1 (jaune) et 2 (verte) de l’oscilloscope sur le calibre 5V en ajustant les 0.

**Câblages à changer/réaliser (en boucle fermée cette fois) (platine éteinte) :**

1. Enlevez le cable entre l’entrée de l’ampli de courant et la borne +12V de la platine régulateur
2. Reliez à la place la sortie de l’amplificateur G2 (<25 mA) à l’entrée de l’amplificateur de courant.
3. Reliez la sortie MAIN OUT de droite (50Ω) du GBF à l’entrée « Consigne » de la platine
« Régulateur ».
4. Reliez la sortie du potentiomètre de mesure (borne verte) à l’entrée « Mesure » de la platine
« Régulateur analogique ». Laisser la visualisation de la sortie verte du potentiomètre sur la voie 2
(verte) de l’oscilloscope.
5. Vérifiez que les 2 résistances placées sur les supports de la platine « régulateur analogique » ont
bien des valeurs égales.
6. Reliez la sortie MAIN OUT du GBF à la voie 1 (jaune) de l’oscilloscope.

Prendre en photo le système cablé complet pour l’inclure dans votre compte-rendu.

<!-- p. 25 -->

Le moteur de l’antenne parabolique virtuelle est donc asservi en boucle fermée avec un régulateur
proportionnel réglé tel que K=7.

Dans la suite, la consigne ne sera jamais choisie en limite d’angle mort, c.àd. -12 V ou + 12 V.

Commencez sans moyenner les mesures. Ajouter un moyennage quand les bonnes courbes sont
obtenues et seulement si les mesures sont trop bruitées.

**Observation du fonctionnement (sans mesures) – 10 mn maximum :**

1. Que se passe-t-il à la mise sous tension de la platine « Régulateur » ?
2. Que se passe-t-il ensuite si l’on ne change pas la tension de consigne (orientation désirée de
l’antenne) avec le bouton d’offset du GBF ? Expliquez pourquoi.
3. Que se passe-t-il si l’on change la tension de consigne (orientation désirée de l’antenne) avec le
bouton d’offset du GBF (regarder d’abord le disque et pas les courbes sur l’oscilloscope) ? Si
nécessaire, appuyer sur « Force Trigger » pour mettre à jour la courbe.
4. Comment est le régime transitoire (réaction rapide, « molle», …) ?
5. Comment est le régime permanent (position angulaire mesurée et consigne superposées, …) ?
6. Est-ce qu’il se passe la même chose pour toutes les valeurs de la consigne (Proche de -12V ou +12V,
loin de ces 2 limites) ? Expliquez pourquoi.

7. Baissez la valeur du gain K jusqu’à K=1 et observez la réaction du disque quand vous changez la
tension de consigne (en régime transitoire et permanent).

8. Si un système de téléopération (opération chirurgicale à distance) était commandé de cette manière,
vaut-il mieux régler K=1 ou K=7 pour que la trajectoire réelle de l’outil soit la plus prêt possible de
celle de la consigne avec un chirurgien formé à ne pas faire d’actions trop brutales sur le
potentiomètre de consigne ?

**Faire valider vos conclusions par l’enseignant.**

Dans la suite, on s’intéresse au même système bouclé de régulation de position mais on change
seulement la consigne pour la rendre carrée périodique . On n’est donc plus dans une situation de
réguler la position d’une antenne parabolique ou de téléopération, mais dans un mouvement périodique
répétitif, comme celui du balai d’essui-glace central arrière d’une voiture.

### II.2. Commande automatique de la position d’un essui-glace central arrière de voiture dont le moteur est en boucle fermée avec un régulateur proportionnel : signal de consigne périodique carré

**Réglages à changer (platine éteinte) :**

1. Remettre la valeur du gain K à 7
2. Mettez l’OFFSET à 0.
3. Sur le GBF, choisissez un signal de consigne périodique carré de fréquence la plus près possible de
0.2 Hz et avec une variation d’amplitude la plus près possible de 4V (entre -2V et +2V).

**Câblages à changer/compléter (en boucle fermée) (platine éteinte) :**

Le schéma fonctionnel est le même qu’à la question précédente II.1.. On veut juste vérifier en plus si
le signal U est linéaire ou s’il sature (à ±10,6 V)

1. Pour cela, reliez la sortie de l’amplificateur G2 (<25 mA), c’est-à-dire la sortie du régulateur,
appelée commande U, à la voie 3 (bleue) de l’oscilloscope. Réglez le calibre de la voie 3
(seulement) à 5V. Réglez les calibres des voies 1 et 2 tels que les courbes de la consigne c(t) et de
la mesure m(t) occupent la majeure partie de l’écran.

<!-- p. 26 -->

Mettez sous tension la platine « régulateur analogique » et ajustez les réglages de l’oscilloscope pour bien
observer un échelon positif qui occupe la majeure partie de l’écran. Mettez l’oscilloscope en mode
« STOP » puis éteindre la platine « régulateur analogique» pour ne pas solliciter inutilement le moteur.

**Faire valider les courbes par l’enseignant avant de répondre aux questions suivantes**

**Observations du comportement à l’aide des courbes sur l’oscilloscope (sans mesures) :**

Remarque : s’il s’agissait d’un essui-glace réel, la fréquence serait plus élevée et il serait toujours en
mouvement, c’est-à-dire toujours en régime transitoire. Ici, on s’intéresse aussi au régime permanent donc
il s’arrête un court temps à chaque position extrème.

1. Est-ce que ce système en boucle fermée est maintenant de même nature, avec le même type de
comportement (avec stabilisation de la position après un certain temps lors de la réponse à un
échelon), que les systèmes des TP1 et TP2 (avec stabilisation de la vitesse après un certain temps
lors de la réponse à un échelon) ?

2. Zoomez sur le démarrage du déplacement du balai d’essui-glace (réponse à un échelon avec une
consigne de position carrée positive) et observez la tangente à l’origine. Que peut-on en conclure
sur l’ordre de ce système en boucle fermée ?

3. Est-ce que le déplacement du balai d’essui-glace respecte le cahier des charges du client (en terme
de précision) ?

4. Vous pouvez relier le signal d’erreur, E, sur la voie 4 (rose) de l’oscilloscope et réglez son calibre
au même calibre que C et M pour mieux comprendre. Positionnez le correctement par rapport à C
et M. L’erreur statique correspondant à la variation de position est elle nulle ?

5. Est-ce que le signal de commande en sortie du régulateur, U (le bleu) est linéaire (pas de saturation
à ±10,6 V (12V moins « somme des tensions de seuil de 2 diodes ») ? U est la tension d’alimentation
du moteur de l’essui-glace. Vous pouvez comparer sa forme avec celle du signal d’erreur, E (rose),
pour conclure.

**Etude des performances (précision, rapidité, dépassement) en boucle fermée quand K=7 : Mesures :**

Pour chaque mesure, réalisée comme d’habitude, et quand les 2 curseurs « Y1 et Y2 » ou « X1 et X2 »
sont bien placés, sauvegardez l’écran de l’oscilloscope au format .png sur une clé USB (Save : recall
=> choix format => Appuyer sur « Enregistrer ») puis copiez la figure dans votre fichier de compte-
rendu puis donner le résultat en dessous.

1. Mesurez avec les curseurs la valeur finale de la variation de la mesure, m(∞).
2. D’après l’observation des courbes m(t) et c(t) en régime statique, donnez le gain statique de la
boucle fermée, G0b (sans mesures).
3. Mesurez le 1ier dépassement, D1 (S’il n’y a pas de dépassement, vous pouvez régler K à 9 au lieu
de 7 (le dire dans votre compte-rendu))
4. Calculez D1/m(∞) en %
5. Mesurez avec les curseurs le temps de réponse à 5% de ce système bouclé, TR5%b.

6. Si le fil de sortie du potentiomêtre de mesure s’use et casse, que se passe-t-il ? Testez le en
débranchant le fil. Expliquez le comportement observé.

7. Pour comparer les comportements avec différents réglages, réglez le gain du régulateur
proportionnel à K=4, K=2 et K=1 puis comparer le fonctionnement du balai d’essai-glace central
commandé en boucle fermée avec ces 3 réglages (en observant et sans nouvelles mesures). Vaut-
il mieux régler K=1, K=2, K=4 ou K=7 pour que le cahier des charges du client soit respecté (Pas
d’erreur statique et TR5%b inférieur à 200 ms) ? Vous pouvez adapter la fréquence du signal carré
pour chaque valeur du gain K pour bien voir le régime permanent.

<!-- p. 27 -->

N’hésitez pas à appelez l’enseignant si vous avez des questions ou pour lui faire vérifier tous vos résultats.
Vous aurez votre compte-rendu pendant le partiel, il est donc important qu’il soit complet et juste.

## Conclusions de ce TP3 à retenir

Dans ce TP3, nousavons étudiéles caractéristiquesde différents systèmes en boucle ferméeavec un régulateur
proportionnel : antenne parabolique, bras de robot de téléopération et balai d’essui-glace central arrière
de voiture, dont on veut réguler la position.

Nous avons déterminé les caractéristiques du capteur de position et notamment son angle mort et nous avons
observé le comportement de l’antenne en boucle ouverte. Elle tourne tout le temps et est donc instable si
l’on s’intéresse à son orientation. C’est à cause de « l’intégrateur mécanique » présent dans le moteur quand
on s’intéresse à la position et pas à la vitesse. En effet, la position est l’intégrale de la vitesse (on peut dire
aussi que la vitesse est la dérivée de la position, ce qui donne, à vitesse constante (ce qui n’est pas notre cas
ici) : vitesse = « distance parcourue » / « temps de parcours »). Cela sera vu aussi en cours/TD AU3.

Ensuite, nous avons ferméla boucle (pour obtenir l’erreur entre la consigneet la mesure) et nous avons ajouté
un régulateur proportionnel K (qui permet d’obtenir la tension d’alimentation du moteur) pour tenter de
stabiliser l’antenne. Nous avons observé que le disque relié à l’axe du moteur suit la position d’un
potentiomètre de consigne manipulé manuellement (comme en téléopération par un chirurgien). Il la
suit d’autant mieux et rapidement que K est grand, si l’on ne manipule pas trop brusquement le
potentiomètre.

Nous avons observé le comportement d’un balai d’essui-glace central arrière de voiture, avec un signal de
consigne de position périodique carré. Pour une valeur de K considérée comme grande, K=7. La
précision statique est parfaite lors de la réponse à un échelon de consigne de position (erreur statique
nulle) et le balai d’essui-glace balaye bien toute la largeur du pare-brise sans dépasser sur la carosserie (pas de
dépassement important).

Si K est trop petit, des phénomènes non modélisés tels que les frottements secs (résistance au mouvement)
empèchent l’essui-glace de fonctionner comme nous le verrons en cours/TD AU3 (chapitre 6).

<!-- p. 28 -->

<a id="tp4"></a>

# TP4 – Asservissement de la vitesse d’un Moteur à Courant Continu bouclé avec un régulateur PI série (Proportionel Intégral) au démarrage et en régime permanent.

Expérimentations / Observations et mesure des performances

Simulations avec Matlab/Simulink

Reprenez le même moteur et la même platine de régulation qu’aux TP1 et TP2 .

L’objectif de ce TP4, qui est la suite du TP2, est d’améliorer les performances du système asservi,
notamment la précision qui n’était jamais parfaite : en régime permanent, la mesure de la vitesse était
toujours différente de la consigne quand le régulateur était un régulateur proportionnel, que K soit petit
(K=3,8) ou que K soit grand (K=40). On le remplace ici par un régulateur Proportionnel Intégral (PI).

<a id="tp4-attendus"></a>

**A la fin du TP4, vous devez savoir :**

1. Effectuer le câblage d’un système asservi (moteur de modèle réduit de bateau, ici) en boucle fermée
avec un régulateur PI série avec les platines à disposition en salle B26,

2. Effectuer le réglage des paramètres d’un régulateur PI série par la méthode du placement de
pôles avec ces platines,

3. Effectuer toutes les mesures attestant des performances du système bouclé.
4. Effectuer la simulation d’un convoyeur en boucle fermée avec un régulateur PI série dont on
veut asservir et réguler la vitesse et étudier son démarrage, le régime permanent atteint et son
comportement en cas d’arrivée d’une bouteille.

Le compte-rendu que vous allez faire de ce TP4 doit contenir les courbes obtenues sur l’oscilloscope, avec
les mesures faites avec les Cursors qui sont copiées à l’aide d’une clé USB et les courbes obtenues avec
Matlab avec les mesures faites avec les « Data Cursors ». La réponse aux questions peut être dans le même
fichier ou sur papier.

## I. Etude des performances d’un asservissement de vitesse d’un moteur en boucle fermée avec un régulateur Proportionnel Intégral série (PI série) : expérimentations avec un signal de consigne périodique carré

La figure 1 donne le diagramme fonctionnel de ce système bouclé :

[illisible : figure p. 28]

Figure 1 : Schéma fonctionnel de l’asservissement de vitesse d’un moteur en boucle fermée

<!-- p. 29 -->

**Le cahier des charges du client est :**

La vitesse du moteur doit se stabiliser :

- Avec une précision parfaite, c.à.d. sans erreur statique (m(t→∞) = c(t→∞), t→∞ représentant le
régime permanent).

- Avec un temps de réponse à 5%, TR5%b inférieur à 200 ms.
- Avec un 1ier dépassement inférieur à 5%

Le cablage sera le même que celui du TP2 excepté pour le régulateur. On va remplacer ici le régulateur
proportionnel (P) du TP2 par un régulateur Proportionnel Intégral série (PI série) de fonction de transfert
$R(p) = K\dfrac{1+T_i p}{T_i p}$ dont les 2 paramètres sont réglés avec la méthode du placement de pôles :

- Ti = 0.0091s (environ la plus grande des constantes de temps du moteur),
- K= 25.8 (K réglé environ de telle sorte que le facteur d’amortissement du système bouclé, zb, soit
de 0.7).

<a id="tp4-cablage"></a>

**Câblages à réaliser (en boucle fermée) (platine éteinte) :**

1. Demander à l’enseignant les composants suivants : 2 résistances, R1 de10 kΩ, R2 de 27 kΩ et
1 condensateur, C2 de 330 nF (composants choisis dans les gammes disponibles dans la salle
pour respecter au mieux les valeurs de K et Ti calculées par la méthode du placement de pôles)
2. Effectuer les mêmes cablages que pour le TP2 (page 13) sauf pour le régulateur qui sera cablé et
réglé comme indiqué ci-dessous.
3. Câbler R1, R2 et C2 sur les supports de la platine « régulateur analogique » pour avoir un
régulateur Proportionnel Intégral (PI) série de telle sorte que : Ti = R2 x C2 ≈ 0.0091s et
K=(R2/R1) x G1 x G2 ≈ 25.8. N’hésitez pas à consulter la documentation sur table à votre
disposition (lutin bleu).

a. R1 sera placé à l’emplacement réservé pour Z1,

b. R2 et C2 seront câblés en série à l’emplacement réservé pour Z2 (de la manière la plus
naturelle possible, en « tordant » le moins possible les pattes des composants).

<a id="tp4-reglages"></a>

**Réglages à effectuer (platine éteinte) :**

1. Régler la tension de la sortie MAIN OUT du GBF avec une forme périodique carrée de fréquence
la plus près possible de 4,9 Hz et avec une variation d’amplitude la plus près possible de 0.8V
sans offset sur le GBF (Utilisez l’atténuation d’amplitude 20dB si nécessaire).
2. Sur la platine régulateur, régler « Affichage G1 » à 95 : donc G1 = 0.95,
3. Sur la platine régulateur, régler G2 à 10.

**Mettre sous tension la platine Régulateur**

Si nécessaire, ajustez la tension de la sortie du GBF en vérifiant sur l’écran de l’oscilloscope que la
variation d’amplitude est bien la plus près possible de 0.8V.

Les réglages de l’oscilloscope seront choisis pour que l’on visualise l’échelon positif sur la majeur partie
de l’écran avec des courbes les plus « propres » possible (présentée comme en cours/TD), (Vous devez
suivre les conseils de la fiche oscilloscope pour y arriver).

Dès que vous avez obtenu deux « belles » courbes occupant un maximum de l’écran pour la consigne
(jaune) et la mesure (verte), mettez l’oscilloscope en mode « STOP » puis éteindre la platine
« régulateur analogique » pour ne pas solliciter inutilement le moteur.

**Faire valider les courbes par l’enseignant avant de continuer.**

Prendre en photo le câblage complet pour l’inclure dans votre compte-rendu.

<!-- p. 30 -->

Rappels : toutes les mesures précises que vous allez faire, d’amplitude et de durées, seront des
variations, donc des ΔY=Y2–Y1 ou ΔX=X2-X1.

- ✓ La « valeur finale » de la mesure, m(∞), dont on parle en TD, est la variation de la mesure entre
sa valeur à l’instant de démarrage de l’échelon positif, considérée comme point de départ (Y1),
et la valeur stabilisée de la mesure à la fin de ce même « carré positif », considérée comme
valeur finale (Y2). Donc m(t=∞)=ΔY=Y2–Y1.

- ✓ Le temps de réponse à 5%, TR5%b, d’un système bouclé avec oscillations ou dépassement
soumis à une variation de l’entrée de consigne en échelon, ΔC, est le temps écoulé entre
l’instant de démarrage de l’échelon positif « carré positif », X1, et l’instant auquel la variation
de la mesure atteint 95% ou 105% de sa valeur finale, m(∞) = ΔM, sans jamais s’en éloigner
de plus de 5% ensuite. C’est donc l’instant auquel la mesure atteint 0,95*m(∞) ou 1,05*m(∞),
X2.
Cette définition de TR5%b est valable quelquesoit le système et est différente du temps de montée
car la sortie mesurée m(t) reste dans le tube des ±5% après t = TR5%b c’est-à-dire l’intervalle
[0.95ΔM , 1.05ΔM]
- TR5%b=ΔX=X2-X1 quand :
  - ΔY=Y2–Y1=0,95*m(∞) si la sortie entre dans le tube des 5% par le bas,
  - ou ΔY=Y2–Y1=1,05*m(∞) si la sortie entre dans le tube des 5% par le haut.

Conseil : si la courbe de mesure est bruitée, essayez avec : moyennage = 16

**Mesures et calculs pour quantifier les performances du démarrage du moteur et de la stabilisation
de sa vitesse en régime permanent quand il est en boucle fermée avec un régulateur PI série :**
<a id="tp4-i-q1"></a>
1. Mesurez avec les curseurs la valeur finale de la variation de la mesure, m(∞)=ΔM (en Volts).
<a id="tp4-i-q2"></a>
2. D’après l’observation des courbes m(t) et c(t) en régime statique, donnez le gain statique de la
boucle fermée, G0b et l’erreur statique en %.

<a id="tp4-i-q3"></a>
3. Mesurez le 1ier dépassement, D1 (en Volts)

<a id="tp4-i-q4"></a>
4. Calculez D1/m(∞) (en %).

<a id="tp4-i-q5"></a>
5. Si le dépassement D1/m(∞) (en %) est plus grand que celui fixé par le cahier des charges du client,
diminuez G1 et effectuez à nouveau les mesures quand le cahier des charges du client est
respecté (les valeurs de Ti et K calculées servent à un premier réglage des paramètres du régulateur.
On peut les ajuster ensuite si le résultat expérimental ne répond pas tout à fait au cahier des charges
du client).

<a id="tp4-i-q6"></a>
6. Mesurez avec les curseurs le temps de réponse à 5% de ce système bouclé, TR5%b, en donnant tous
les petits calculs nécessaires (0,95*m(∞), 1,05*m(∞), …).

<a id="tp4-i-q7"></a>
7. Est-ce que le cahier des charges du client est bien respecté (précision, rapidité, dépassement) ?
Expliquez

N’hésitez pas à appelez l’enseignant si vous avez des questions ou pour lui faire vérifier tous vos
résultats. Vous aurez accès à votre compte-rendu pendant le partiel. Il est donc important qu’il soit
complet et juste

<!-- p. 31 -->

## II. Etude des performances d’un asservissement de vitesse d’un moteur en boucle fermée avec un régulateur Proportionnel Intégral série (PI série) : simulations du démarrage et du fonctionnement en régime permanent d’un convoyeur avec MATLAB/SIMULINK

Les convoyeurs de bouteilles motorisés sont les systèmes avec tapis roulant permettant de déplacer les
bouteilles d’un point à un autre d’une usine (vidéo : https://www.youtube.com/watch?v=kLhiETKrY18).
Les bouteilles passent parfois d’un convoyeur à un autre. Les vitesses des deux tapis doivent alors être
strictement identiques. En effet, lorsqu’une bouteille quitte le premier tapis et arrive sur le deuxième, la
vitesse des tapis ne doit pas changer pour que les bouteilles ne tombent pas. Pourtant, sur le premier tapis,
il y une bouteille en moins (charge différente pour le moteur) et sur le deuxième tapis, il y a une bouteille
en plus (charge différente pour le moteur). Cette modification de charge sur le tapis peut être vue comme
une perturbation au niveau du moteur (modification du couple de charge).
Les caractéristiques du moteur du II sont différentes de celles du moteur utilisé lors des expérimentations
dans le I.

[illisible : figure p. 31]

Figure 3 : convoyeur de bouteilles
**Le cahier des charges du client concernant le fonctionnement de ce convoyeur est le suivant :**

- Le convoyeur tourne exactement à la vitesse désirée pour laquelle la mesure de vitesse est égale à
1V en régime permanent (erreur statique nulle).

- Lorsqu’il n’y a aucune bouteille sur le convoyeur, celui-ci s’arrête. Un capteur permet de savoir
(environ 30 ms à l’avance) si de nouvelles bouteilles arrivent. Le temps nécessaire pour
redémarrer le moteur et qu’il atteigne la bonne vitesse doit donc être inférieur à 30 ms.

- L’impact de l’arrivée ou du départ d’une bouteille sur la vitesse du convoyeur doit être le plus faible
possible (en phase transitoire). Pour éviter des à-coups du tapis lorsqu’une bouteille arrive, la
vitesse du tapis doit subir une variation inférieure à 5%.
### II.1

II.1 Copier dans votre dossier de travail, les fichiers TP_MCC_PI_sans_bouteille.m et
TP_MCC_PI_Vitesse.slx présents sur V:\Module_AU3\ 2026_2027_TP_AU3\
TP4_Moteur_Convoyeur_vitesse\
Ces deux fichiers permettent de simuler l’évolution de la vitesse du moteur du convoyeur à chaque
instant.
Sur le schéma du fichier SIMULINK, la vitesse du moteur est appelée Vitesse_Moteur. Le capteur
de vitesse (dynamo tachymétrique (DT)) fournit une tension de sortie MDT proportionnelle à la
vitesse du moteur.
Lorsque les bouteilles avancent sur le convoyeur à la vitesse désirée c’est-à-dire lorsque le moteur
tourne à la vitesse désirée, la sortie du tachymètre MDT est égale à 1V.

<!-- p. 32 -->

Comme la sortie est considérée comme « bruitée », un filtre passe-bas est placé après la dynamo
tachymétrique pour enlever les hautes fréquences et ainsi pour avoir une mesure de vitesse (M)
moins bruitée.
Le schéma bloc Simulink du « convoyeur de bouteilles motorisé » est donné figure 4.

[illisible : figure p. 32]

Figure 4 : Schéma bloc sous Simulink du système « convoyeur de bouteilles motorisé »
(l’inductance d’induit L est négligeable ici et n’apparait pas)
(La variable de Laplace est notée s (et pas p) dans Matlab/Simulink)
### II.2

II.2 Dans le fichier du schéma bloc Simulink :

  - Quelle couleur correspond aux blocs qui représentent le moteur (MCC) ?
  - Quelle couleur correspond aux blocs qui représentent le régulateur ?
  - Quelle couleur correspond au bloc qui représente la dynamo tachymétrique ?
  - Quelle couleur correspond au bloc qui représente le filtre passe-bas ?
  - Quelle couleur correspond aux blocs qui permettront de visualiser les signaux ?
  - Quelle couleur correspond aux signaux de consignes ou de perturbations ?

  - Quel est l’ordre du moteur instrumenté avec la mesure de vitesse filtrée ?
  - Quel est l’ordre du régulateur ?
### II.3

II.3 Vous allez simuler le démarrage du moteur du convoyeur vide (sans bouteilles) :
A t=0, le moteur est arrêté et il n’y a pas de bouteilles sur le tapis (couple de charge Cc nul).

a. Le script MATLAB « TP_MCC_PI_sans_bouteille.m » contient les instructions pour
initialiser les paramètres présents dans le fichier SIMULINK puis effectuer la simulation
et enfin réaliser les tracés des courbes intéressantes. Repérez la ligne avec l’instruction
qui lance la simulation du fichier simulink « TP_MCC_PI_Vitesse.slx » c’est-à-dire du
schéma bloc de la figure 4 : sim('TP_MCC_PI_Vitesse')

b. Lancer l’exécution du script « TP_MCC_PI_sans_bouteille.m » en cliquant sur RUN. La
consigne de vitesse, C (en Volts) et la mesure filtrée de la vitesse, M (en Volts) sont tracées
sur la figure 1 et le signal de commande en sortie du régulateur, U sur la figure 2.
<a id="tp4-ii3-c"></a>

c. D’après l’observation des courbes m(t) et c(t) en régime statique, donnez le gain statique
de la boucle fermée, G0b et l’erreur statique en %. Avez-vous la même précision que lors
des expérimentations du I ?
<a id="tp4-ii3-d"></a>

d. En observant le signal de commande en sortie du régulateur, U sur la figure 2, constatez vous
que U (qui est la tension d’alimentation du moteur) est plus grand au départ pour un
démarrage rapide et est non nul en régime permanent pour que le moteur tourne à la vitesse
souhaitée.

<!-- p. 33 -->
<a id="tp4-ii3-e"></a>

e. Mesures et calculs pour quantifier les performances du démarrage du moteur (sans bouteille)
et de la stabilisation de sa vitesse en régime permanent (avec des « data cursor » sur la figure
1 – pour avoir des mesures précises, faire : clic droit => selection style => Mouse Position) :

  - Mesurez la valeur finale de la mesure de vitesse atteinte par le convoyeur, m(∞) (en
Volts)

  - Mesurez le premier dépassement, D1 (en Volts)
  - Calculez D1/m(∞) (en %).
  - Mesurez le temps de réponse à 5% de ce système bouclé, TR5%b, en donnant tous les
petits calculs nécessaires (0,95*m(∞), 1,05*m(∞), …).
<a id="tp4-ii3-f"></a>

f. Est-ce que le cahier des charges du client est bien respecté concernant le démarrage du
convoyeur (précision, rapidité, dépassement) ? Expliquez
### II.4

II.4 Vous allez simuler le démarrage du moteur du convoyeur vide (sans bouteilles) puis l’arrivée
d’une bouteille (qui perturbe le régime permanent) à t=0.15 s jusqu’à atteindre à nouveau
un régime permanent :

Copier dans votre dossier de travail, les fichiers TP_MCC_PI_avec_bouteille.m et
TP_MCC_PI_Vitesse_avec_bouteille.slx présents sur V:\Module_AU3\ 2026_2027_TP_AU3\
TP4_Moteur_Convoyeur_vitesse\

A t=0, le moteur est arrêté et il n’y a pas de bouteilles sur le tapis (couple de charge Cc nul)

a. Lancer l’exécution du script « TP_MCC_PI_avec_bouteille.m » en cliquant sur RUN.
Sur la figure 1, en haut sont tracées la consigne de vitesse, C (en Volts) et la mesure
filtrée de la vitesse, M (en Volts), en bas est tracé le couple de charge, Cc. Le signal
de commande en sortie du régulateur, U est tracé sur la figure 2.
<a id="tp4-ii4-b"></a>

b. Mesures et calculs pour quantifier les performances de régulation de la vitesse du
moteur après l’arrivée d’une bouteille (avec des « data cursor »). Vous allez observer
comment la mesure de la vitesse du moteur évolue après cette perturbation.

- Mesurez l’écart maximum entre la consigne C et la mesure de vitesse M (positif
ou négatif) après l’arrivée d’une bouteille (en Volts).

- D’après l’observation des courbes m(t) et c(t) lors du nouveau régime statique en fin
de simulation, donnez la nouvelle erreur statique en % en présence d’une
perturbation (bouteille).

$$u(t_1) = K\left[e(t_1) + \frac{1}{T_i}\int_0^{t_1} e(t)\,dt\right]$$ avec K=25,8 et Ti = 0,0091 s.

- En observant le signal de commande en sortie du régulateur, U (qui est la tension
d’alimentation du moteur calculée comme ci-dessus) sur la figure 4, calculé comme
ci-dessus, et en se rappelant qu’une intégrale est une aire, expliquez comment cette
performance peut être atteinte.
<a id="tp4-ii4-c"></a>

c. Est-ce que le cahier des charges du client concernant l’impact de l’arrivée d’une
bouteille sur la mesure de vitesse du convoyeur (en phase transitoire et en régime
permanent) (précision, dépassement) est bien respecté ? Expliquez

<!-- p. 34 -->
### II.5

II.5 Vous allez comparer ce qu’il se passe si le régulateur était seulement un régulateur
proportionnel (comme au TP2) et pas un régulateur PI série.

a. Sauvegarder une copie des 2 fichiers « avec bouteilles » nécessaires à la simulation (.m
et .slx) en remplaçant « PI » par « K » dans leurs nouveaux noms (enlever « copie »).

b. Dans le fichier Simulink, enlever le bloc qui concerne l'action Intégrale du
régulateur PI série (celui juste avant U), pour ne conserver que l'action proportionnelle
(Donc R(p) = K).

c. Dans le fichier .m, modifiez le nom du fichier appelé par la fonction « sim(…) ».
<a id="tp4-ii5-d"></a>

d. Simuler pour observer si le comportement du moteur bouclé avec un régulateur
proportionnel est aussi exemplaire au démarrage et après une perturbation (arrivée d’une
bouteille).
<a id="tp4-ii5-e"></a>

e. Que concluez-vous ?

N’hésitez pas à appelez l’enseignant si vous avez des questions ou pour lui faire vérifier tous vos
résultats. Vous aurez accès à votre compte-rendu pendant le partiel. Il est donc important qu’il soit
complet et juste.
## Conclusions à retenir
Dans ce TP4, vous avez étudié les caractéristiques d’un système du 2e ordre (moteur de modèle
réduit de bateau ou moteur de convoyeur, par exemple dont on veut réguler la vitesse) en boucle
fermée avec un régulateur Proportionnel Intégral série (PI série).

Dans le TP2, vous aviez commandé ce moteur en boucle fermée avec un régulateur Proportionnel.
Vous aviez observé que la mesure de vitesse ne suivait pas bien la consigne de vitesse de forme
périodique carrée, mais qu’elle la suivait d’autant mieux et rapidement que K était grand mais
jamais parfaitement.

Dans ce TP4, vous avez commandé ce moteur en boucle fermée avec un régulateur Proportionnel
Intégral série (PI série). Vous avez observé que la mesure de vitesse suit parfaitement la consigne
de vitesse de forme périodique carrée en régime statique (permanent), après un régime
transitoire dont la durée et la forme dépendent de la valeur de K. Cela vient du fait que la tension
d’alimentation du moteur, U, est non nulle en régime statique, grace à l’action de l’intégrateur
dans le régulateur.

Dans ce TP4, vous avez aussi observé, qu’en présence d’une perturbation (arrivée d’une bouteille
sur un convoyeur par exemple) la mesure de vitesse suit à nouveau parfaitement la consigne de
vitesse de forme périodique carrée en régime statique, après un régime transitoire dont
l’amplitude dépend de la valeur de K. Cela vient du fait que la tension d’alimentation du moteur,
U, a automatiquement augmenté pour tenir compte de la présence d’un couple de charge plus grand.

Le TP4 est presque terminé.

Suivez la procédure suivante avant de finir votre compte-rendu et de partir :

1. Vider la clé USB puis la rendre à l’enseignant,
2. Rendre les 3 composants R1, R2 et C2 à l’enseignant.

