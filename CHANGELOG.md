# Changelog

## Non publié

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
