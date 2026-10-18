# Changelog

## 0.4.2 — 2026-10-18

### Corrections de bugs

- **Lecture des fichiers .mid inaudible** : les vélocités quasi nulles du fichier (ghost notes, encodage compressé) rendaient la lecture muette depuis l'introduction des vélocités. Normalisation à l'import (plancher jouable) — les morceaux déjà importés sont réparés automatiquement au chargement.

## 0.4.1 — 2026-10-18

### Corrections de bugs (audit complet)

- **Lecture des fichiers .mid inaudible** : les vélocités quasi nulles du fichier (ghost notes, encodage compressé — une note à vélocité byte 1 sort à 0.008) rendaient la lecture muette. Normalisation à l'import : plancher jouable 0.25, défaut 0.8, nuances relatives conservées au-dessus du seuil. Les morceaux déjà importés sont réparés au chargement (plancher appliqué par le sanitize).

- **Echo** : le mode était inutilisable au-delà de la première phrase (compteur de phrases jamais posé après le refactor du démarrage) — le récap de fin affiche maintenant les fautes **cumulées** sur tout le morceau
- **Apprentissage + transposition** : la touche attendue correspond désormais au morceau transposé, comme la lecture
- **Echo double-démarrage** : `start()` programme la phrase une seule fois (timers doublés supprimés)
- **Remap de raccourci** : appuyer une touche pour la capturer ne joue plus de note parasite (clavier neutralisé pendant la capture)
- **Plein écran** : le bouton reste synchronisé après une sortie native (F11, Échap)
- **Enregistrement clavier PC** : vélocité par défaut explicite capturée (cohérent avec la souris)
- **Paroles** : plus de ligne périmée affichée pendant l'echo (masquées hors lecture auto)
- **Suppression d'un morceau** : ses statistiques d'apprentissage sont nettoyées (plus d'entrées orphelines)
- **Sélecteur de morceau** : désactivé pendant un enregistrement (cohérence d'état)
- Indicateur audio : fréquence d'échantillonnage affichée
- `npm run release` : refuse de poser le tag tant que le bump de version n'est pas commité (l'incident v0.4.0 ne se reproduira plus)

## 0.4.0 — 2026-10-18

### Fonctionnalités

- Profils utilisateurs : plusieurs profils indépendants (morceaux, préférences, progression), sélecteur + création dans la barre de profils
- Bibliothèque élargie : 5 morceaux intégrés supplémentaires (Frère Jacques, Ah vous dirai-je maman, gamme de La mineur, arpège de Do, intervalles)
- Internationalisation FR/EN : infrastructure complète (dictionnaire de 75 clés, détection de la langue du système, bouton FR/EN, préférence persistée) ; les chaînes du composant migrent progressivement vers t()
- Vélocité au clic : plus tu cliques bas sur la touche, plus la note est forte (comme un vrai clavier)
- Visualiseur : forme d'onde du signal, activable depuis les Réglages
- Raccourcis personnalisables : pédale de sustain et lecture/arrêt remappables (bouton dédié, appuie la nouvelle touche), persistés
- Mode echo (call & response) : l'app joue une phrase de 6 notes, à toi de la rejouer — phrase par phrase, avec compteur de fautes
- Paroles synchronisées : les meta events « lyrics » des fichiers MIDI s'affichent pendant la lecture
- Marqueurs de mesures pendant la lecture (piste de points, temps fort accentué)
- Rapport de progression exportable en JSON depuis le panneau apprentissage
- Pédale de sustain réaliste : les notes tenues s'éteignent doucement (release 3,5 s) au lieu d'être coupées net
- Égaliseur 3 bandes (graves/médiums/aigus, ±12 dB), persisté
- Sélecteur d'import : chaque piste est taggée « main droite » ou « main gauche » (heuristique tessiture + densité)
- Bouton Replay : rejoue le dernier enregistrement
- Imports récents en tête du sélecteur
- Layout responsive des contrôles (petits écrans)

### Qualité

- Web Worker pour le parsing MIDI : les gros fichiers ne bloquent plus l'UI, avec repli synchrone automatique
- Indicateur de santé audio (latence, état du contexte) sous les contrôles
- Message d'erreur de chargement des sons avec bouton « Réessayer »

- Accessibilité clavier : les 88 touches sortent de l'ordre de Tabulation (le jeu reste au clavier PC), aria du clavier complété
- Monitoring des nœuds audio : comptage create/dispose, testé (fuites visibles)
- Tests de performance : 6000 et 8000 notes MIDI traitées sous 2 s
- Progression d'apprentissage persistée (finalise #38, roadmap #61)
- Bundle : le parsing MIDI vit dans un chunk worker séparé

## 0.3.1 — 2026-10-18

### Corrections de bugs

- Décalage d'octave : les touches du clavier PC jouent enfin la fenêtre affichée (l'étiquette et le son étaient désynchronisés depuis l'introduction du décalage — le hook ne recevait pas `octaveShift`)

## 0.3.0 — 2026-10-18

### Fonctionnalités (roadmap #23, #27, #33, #38, #42, #46, #48, #50, #51, #53, #60, #62, #64)

- Enregistrement live : bouton ● capture les notes jouées (clavier/souris) avec durées et vélocités, sauvegarde en morceau dans la bibliothèque (titre horodaté)
- Export `.mid` : bouton dédié télécharge le morceau sélectionné en fichier MIDI (relisible, tempo de référence)

- Statistiques de progression par morceau : meilleur score, nombre de sessions, moyenne et dernière date affichés dans le panneau apprentissage, persistés (historique plafonné à 20 sessions)

- Sélecteur d'import : bouton « Écouter » par piste (extrait de 8 s, exclusif, coupé à la fermeture du dialogue)

- Métronome : tick discret (note courte du sampler) sur le Transport, activable pendant la lecture ou seul, tempo réglable 40–240 BPM

- Transposition manuelle de la lecture (± 11 demi-tons, boutons ◀ ▶, persistée) — les notes hors clavier restent en place
- Favoris : étoile sur le morceau sélectionné, tri en tête du sélecteur, persisté pour les morceaux importés

- Réverbe réglable : nœud `Tone.Reverb` inséré entre le sampler et la sortie, slider persisté (0 = sec)
- Import MIDI : la vélocité de chaque note est conservée et jouée (l'accompagnement doux reste doux)

- Thème clair/sombre commutable et persisté (préférences v3, migration automatique)
- Export/import de la configuration complète en JSON (morceaux importés + préférences), validé par le même sanitize que le localStorage

- Mode apprentissage : score de justesse (0–100) affiché en fin de session
- Mode apprentissage : la touche suivante est surlignée en anticipation (liseré discret)
- Import MIDI par glisser-déposer sur la fenêtre, avec overlay visuel

### Corrections de bugs

- Lecture tactile : les touches répondent aux Pointer Events (tablettes/écrans tactiles)
- Sustain : une note rejouée sans pédale ne reste plus affichée « sustain » après relâchement
- `npm run test:midi` : script retiré (le fichier `scripts/` n'existait pas dans le dépôt)
- Morceaux intégrés : une notation rythmique invalide ne produit plus un NaN qui décalait le morceau

### Qualité

- Import dynamique de `@tonejs/midi` : bundle initial 533 → 505 kB (chunk MIDI chargé à l'import)
- Messages de statut auto-effacés après 8 s
- Suite de tests : 141 tests, exécution accélérée (pool vmThreads)

## 0.2.1 — 2026-10-17

### Corrections de bugs

- Session apprentissage : réinitialisation propre au changement/suppression du morceau (plus de session zombie)
- Décalage d'octave pendant une touche maintenue : la bonne note est relâchée (plus de note orpheline)
- Stockage local corrompu : chaque champ est validé au chargement (plus d'échecs silencieux de la lecture)
- Barre d'espace : n'interrompt plus les notes sustain d'une session précédente
- Auto-scroll : position exacte sur les touches noires
- Lecture et apprentissage sont désormais exclusifs

### Qualité

- 78 tests (67), chaque correction couverte par un test de régression

## 0.2.0 — 2026-10-16

### Clavier

- **88 touches** (A0–C8) avec défilement horizontal, centrage initial sur C4,
  repères discrets sous chaque Do
- **Fenêtre clavier PC déplaçable par octaves** (boutons ◀ ▶, C1→C6)
- Molette verticale = défilement du clavier
- Dispositions **QWERTY / AZERTY** commutables (toutes les touches AZERTY
  accessibles sans Shift)
- Étiquettes au choix : **lettres, solfège (Do Ré Mi), les deux, aucune**

### Mode apprentissage

- Session note-à-note : la touche attendue est surlignée, la session n'avance
  que sur la bonne note, fautes comptées, récap de fin
- **Auto-scroll** vers la note attendue

### Audio

- Échantillons Salamander Grand Piano **embarqués** (aucune connexion requise)
- **Latence input→son réduite** (lookAhead 100 ms → 20 ms, démarrage audio
  au montage)
- Barre de progression du chargement (n/30)

### Import MIDI

- Sélection de pistes avec détection heuristique de la mélodie (⭐)
- Plus de transposition forcée : les fichiers jouent dans leur tessiture
  réelle sur 88 touches
- Suppression des morceaux importés (bouton poubelle + confirmation)

### UI/UX

- Refonte complète : design system sombre, logo d'application, icônes SVG,
  segmented controls, clavier premium (halos par état)
- **WCAG 2.2** : contrastes ≥ 4.5:1, cibles ≥ 24 px, aria complets
- Contrôles regroupés en 4 sections (loi de Hick), raccourci **Entrée** =
  lecture/arrêt, **Espace** = pédale de sustain
- Pédale de sustain (notes prolongées en violet)

### Robustesse

- **67 tests** (Vitest), CI GitHub Actions (lint + tests + build + clippy)
- ErrorBoundary avec "Copier l'erreur"
- Persistance localStorage versionnée avec migrations
- Avertissement en cas de quota de stockage dépassé

## 0.1.0

Version initiale : piano 2 octaves, lecture automatique, import MIDI,
pédale de sustain, persistance locale.
