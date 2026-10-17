# Changelog

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
