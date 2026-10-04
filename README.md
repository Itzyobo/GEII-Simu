# TP-Sim — simulateur des TP d'ENER3

Site React 100 % front qui reproduit trois TP d'électrotechnique : moteur pas à pas, alimentation à découpage isolée, machine asynchrone.
Chaque page comporte un câblage simplifié, des instruments et les questions de l'énoncé, corrigées et notées.
Les valeurs simulées sont calées sur les comptes rendus (CR). Toutes les constantes vivent dans `src/data/reference.ts`.

## Lancement

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest : modèles, barème, progression, câblage, oscilloscope
npm run build    # vérification TypeScript stricte + bundle de production dans dist/
```

Node 20 ou plus récent. Le dossier `dist/` se sert comme un site statique. Il faut prévoir un repli vers `index.html` pour les routes `/tp/...` et `/examen-blanc`.

## Utilisation

- **Entraînement** (par défaut) : chaque réponse reçoit un verdict immédiat, avec l'explication et la formule utilisée.
- **Examen 30 min** : bouton dans le bandeau de chaque TP.
  - Les réponses sont enregistrées sans verdict, et les tableaux sont notés comme des questions (fraction de cases justes).
  - Note sur 20 avec une répartition égale entre les questions du TP.
  - Chaque TP (et chaque partie de l'alim) a une ligne « Câblage » qui vaut autant qu'une question : entière si « Faire vérifier » valide au premier essai, la moitié au deuxième, 0 ensuite. Une fois le montage validé, cette note est figée.
  - Pénalités : −0,5 par vérification de câblage refusée (au plus −3), −1 par modification tentée sous tension (câblage, barrettes, micro-switches, D2/C, sélecteur réseau/variateur). La note ne descend pas sous 0.
  - Les résultats détaillent chaque question (ta réponse, l'attendu, l'écart, l'explication) et donnent un lien « Revoir » vers chaque question ratée.
  - Une question jamais affichée (onglet non ouvert, TP non visité) apparaît « non traitée ». Sa réponse attendue et son explication sont calculées à la remise depuis les clés de correction (`src/lib/answerKeys.ts`).
  - Le chrono, les réponses et les pénalités sont sauvegardés dans sessionStorage (`tp-sim:exam:<TP>`) et survivent à un rechargement de la page. L'état du banc (câblage, réglages), lui, repart de zéro.
- **Examen blanc 1 h 30** (depuis l'accueil) : les 3 TP dans un ordre aléatoire, note finale = moyenne des trois notes sur 20.
- **Progression** : un seul objet versionné en localStorage, `tp-sim:progress`. Il garde les tentatives et la réussite par question (lignes « Câblage » comprises), ainsi que l'historique des examens. L'accueil affiche le pourcentage réussi par TP, la dernière note, les attendus officiels (acquis / à revoir / non couvert) et un bouton de réinitialisation avec confirmation.
- **Valeur non vérifiée** : un badge signale chaque question dont la réponse dépend d'une constante marquée « hypothèse » dans `reference.ts`. La liste est `UNVERIFIED` dans `src/data/questions.ts`, complétée par `UNVERIFIED_BY_MODE` pour les dépendances liées au mode réglé sur le driver. Règle retenue : la réponse changerait si la constante s'écartait de ±50 % de sa valeur.

## Structure

```
docs/enonce.md            énoncés officiels des 3 TP (extraits de pdf/Cours_TD_TP-2026.pdf)
src/data/reference.ts     SEULE source des constantes physiques (unité + source en commentaire)
src/data/questions.ts     registre des questions notées (lignes « Câblage » comprises), attendus officiels, questions « valeur non vérifiée »
src/models/               modèles purs, testés sans React
  stepper.ts              moteur pas à pas + TB6600 (Euler 1 µs, hystérésis, f.c.é.m. calée)
  pulseTransformer.ts     transformateur d'impulsions IT237 (flux, saturation, D2 / Rs / C)
  flyback.ts              flyback MAX17691B (modèle moyen, conduction continue / discontinue, formes d'onde)
  asyncMotor.ts           machine asynchrone (interpolation des relevés, étoile, variateur, pertes, bilan)
src/lib/                  oscilloscope (trigger, mesures), câblage, notation, examen (barème, clés de correction, session), progression, formats
src/components/           instruments et commandes (oscilloscope, bouton rotatif, afficheurs, câblage, feuilles de calcul notées, coquille d'examen…)
src/pages/                accueil, démo, pages TP et leurs questions / feuilles de calcul
```

## Questions couvertes

| TP | Questions (identifiants dans `src/data/questions.ts`) |
|---|---|
| Moteur pas à pas | Câblage · Q4 vitesse à 20 Hz · Q5 vitesse à 180 Hz · Q6 Freq2 · Q7 mode courant / tension · Q8 déphasage · Q9 inversion DIR · Q10 périodes d'horloge par période de courant · Q11 séquence des courants · Q12 inductance |
| Alim à découpage, partie 1 | Câblage · Q1 période et rapport cyclique · Q3 Vz · Q4 Lm (comparaison au constructeur) · Q5 aire maxi sans saturation · Q6 action sur ΔV |
| Alim à découpage, partie 2 | Câblage · Q1 plage d'entrée, Vs, Is, f, η nominal, isolation galvanique · Q2 tableau des 5 relevés (Ve, Ie, Vs, Is à ±5 % du banc ; Pin, Pout, η à ±3 % des mesures saisies ; erreur « Vs/Ve au lieu de Ps/Pe » détectée) et rendement à 0,5 A · Q3 rendement de l'alim linéaire · Q5 m et fréquence de découpage · Complément conduction continue / discontinue : QCM sur ce que montre V2 à faible charge, et courant de basculement (±30 %) |
| Machine asynchrone | Câblage · Q1 Cu nominal, p, Ns · Q2 couplage · Q3 tableau des essais en charge · Q4 Rs · Q5 P'0 et I's0 · Q6 lecture des courbes (×3) · Q7 tableau du variateur, U/f, utilité du variateur · Q8 séparation des pertes et α · bilan de puissance au point nominal et QCM « méthode la plus fiable » |

Les intitulés reprennent mot pour mot `docs/enonce.md`. Les précisions propres au simulateur sont ajoutées après « — Ici : ».
Les réponses attendues sont calculées depuis les modèles, jamais codées en dur.

## Attendus couverts

Liste officielle des attendus, reliée aux questions qui la couvrent (`ATTENDUS` dans `src/data/questions.ts`).
Un attendu est « acquis » quand toutes ses questions ont été réussies au moins une fois. Une ligne sans exercice serait affichée « non couvert » ; il n'y en a plus.
Les lignes « Savoir câbler… » sont couvertes par la ligne « Câblage » du TP, réussie quand « Faire vérifier » valide le montage.

| TP | Attendu | Couvert par |
|---|---|---|
| Alim | Savoir câbler les platines hacheurs. | câblage partie 1, câblage partie 2 |
| Alim | Savoir câbler / mesurer / calculer un rendement d'une platine hacheur. | câblage partie 2, P2 Q2 (tableau et rendement à 0,5 A), P2 Q3 |
| Alim | Savoir régler / mesurer / retrouver le rapport cyclique, fréquence de fonctionnement sur les deux platines. | P1 Q1 (période, rapport cyclique), P2 Q1 (fréquence), P2 Q5 (fréquence) |
| Alim | Savoir différencier / régler un fonctionnement conduction continu / discontinu. | Complément P2 : mode vu sur V2, courant de basculement |
| Alim | Savoir mesurer / calculer l'inductance du primaire du transformateur. | P1 Q4 |
| Pas à pas | Savoir câbler les platines moteurs pas à pas. | câblage du TB6600 |
| Pas à pas | Savoir calculer la vitesse de rotation à partir d'une fréquence d'impulsion. | Q4, Q5 |
| Pas à pas | Savoir mesurer une tension et courant dans un enroulement et expliquer le fonctionnement mode courant. | Q7 |
| Pas à pas | Déterminer le mode courant et mode tension, trouver les fréquences correspondantes. | Q6, Q7 |
| Pas à pas | Savoir différencier un mode demi pas d'un mode pas complet. | Q5, Q10, Q11 |
| Pas à pas | Savoir expliquer l'inversion de sens de fonctionnement par des relevés. | Q8, Q9 |
| Asynchrone | Savoir câbler un couplage étoile ou triangle, identifier la tension aux bornes d'un enroulement. | câblage, Q2 |
| Asynchrone | Savoir relever les informations d'une plaque signalétique, calculer un couple utile, calculer le nombre de paires de pôles. | Q1 (Cu, p, Ns) |
| Asynchrone | Savoir câbler une machine asynchrone sur le réseau ou à l'aide d'un variateur. | câblage, Q7 (tableau du variateur) |
| Asynchrone | Savoir mesurer puissances absorbées actives, réactives et apparentes, courant tension aux bornes d'une phase. | Q3 |
| Asynchrone | Savoir mesurer / calculer un bilan de puissance et rendement. | Q3, bilan de puissance, QCM du bilan |
| Asynchrone | Savoir mesurer / calculer les pertes joules statoriques Pjs. | Q4, Q8 (séparation des pertes), bilan de puissance |
| Asynchrone | Savoir exploiter les courbes Cu=f(N) et Cu = f(g). | Q6 (Cu = f(g)) |
| Asynchrone | Montrer que la relation V/f est constante pour une alimentation par variateur de fréquence. | Q7 (tableau, U/f) |

## Valeurs « hypothèse » et « calé » de `reference.ts`

| Constante | Valeur | Statut | Rôle |
|---|---|---|---|
| `PAP.lReelle` | 6,885 mH | calé | Inductance réelle d'une phase, calée avec `ke` pour que l'inductance apparente mesurée à 1 kHz (15·Δt/Δi) vaille 9,7 mH comme au labo |
| `PAP.ke` | 0,1366 V·s/rad | calé | Constante de f.c.é.m. e = Ke·Ω·signe(consigne), calée pour Freq2 ≈ 1425 Hz (passage en mode tension, pas entier) |
| `PAP.rPhase` | 1,5 Ω | hypothèse | Résistance d'une phase (terme R·i de l'équation du courant) |
| `PAP.fDecrochage` | 2,5 kHz | hypothèse | Au-delà, le rotor décroche (N = 0) mais les courants restent |
| `ALIM.vd` | 0,7 V | hypothèse | Seuil de la diode D2 : vs = max(v2 − Vd, 0) |
| `ALIM.facteurSaturation` | 20 | hypothèse | Lm est divisée par ce facteur au-delà de l'aire de saturation, et le courant s'emballe |
| `ALIM.iLimite` | 5 A | hypothèse | Courant primaire maximal (alim 5 V à travers le shunt 1 Ω), borne de l'emballement |
| `FLYBACK.m` | 1/3 | hypothèse | Rapport de transformation n2/n1 : V2 = −m·Ve en conduction |
| `FLYBACK.vd` | 0,7 V | hypothèse | Seuil de la diode de sortie : V2 = Vs + Vd en démagnétisation, et calcul de α |
| `FLYBACK.iDiscontinu` | 0,15 A | hypothèse | Seuil de conduction discontinue : sous ce courant, α ∝ √Is et palier oscillant sur V2 |
| `FLYBACK.isMin` | 0,05 A | hypothèse (PRD) | Courant au rhéostat en valeur maximale |
| `FLYBACK.formeOnde` | 1,2 MHz, τ 0,35 µs, pic 35 %, 18 MHz, τ 60 ns, bruit 1,5 % | hypothèse | Aspect des formes d'onde du flyback uniquement : oscillation discontinue, pic au blocage, bruit |
| `MAS.variateurUh` | 200 V | hypothèse pédagogique | Composante harmonique ajoutée en mesure RMS : U/f n'apparaît pas constant hors mode harmonique |
| `BRUIT` | ±1 à 2 % | hypothèse (PRD) | Bruit des lectures (±1,5 % utilisé ; la vitesse de la machine asynchrone à ±0,1 %) |
| `PINCE_SENSIBILITE` | 100 mV/A | hypothèse | Pince ampèremétrique de l'oscilloscope (réglage sonde V/div ou A/div) |
| `TB6600_MODES` | S1–S3 → pas entier / demi / 1/4 | énoncé, hypothèse à vérifier | Table des modes du driver (ligne 1/4 de pas en particulier) |

Les autres constantes viennent du CR, de l'énoncé ou de la datasheet, comme indiqué en commentaire dans `reference.ts`.
Questions affichant le badge « valeur non vérifiée » :

| Question | Constante(s) |
|---|---|
| Pas à pas Q6, Q7 | `PAP.rPhase`, `PAP.fDecrochage` |
| Pas à pas Q12 | `PAP.rPhase` |
| Pas à pas Q10, Q11, seulement en 1/4 de pas | `TB6600_MODES` (table S1–S3, à vérifier sur l'étiquette du driver) |
| Alim P1 Q5 | `ALIM.facteurSaturation` |
| Alim P2 Q5 (m) | `FLYBACK.m` |
| Alim P2, conduction continue / discontinue (×2) | `FLYBACK.iDiscontinu` (seuil de conduction discontinue) |

`MAS.variateurUh` n'intervient dans aucune réponse attendue : U/f est demandé sur le fondamental (mode harmonique du wattmètre), Uh ne sert qu'à l'affichage RMS.
D'autres hypothèses de modèle sont documentées en commentaire dans `src/models/`, par exemple le bilan simple en étoile ou le maintien des pertes au variateur.
