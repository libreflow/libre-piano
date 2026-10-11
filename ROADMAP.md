# Libre Piano — Plan d'amélioration en 100 étapes

Roadmap organisée en 10 phases, de la plus proche (fondations/qualité) à la plus
exploratoire (fonctionnalités avancées). Chaque étape est pensée comme un
incrément livrable indépendamment.

## Phase 1 — Fondations & qualité de code (1–10)

1. ✅ Ajouter ESLint (config React/TS flat config) — a déjà attrapé 2 vrais bugs React
2. ✅ Ajouter Prettier pour un formatage cohérent
3. Mettre en place Vitest pour les tests unitaires
4. Tests pour `clampMidiToKeyboard` / `midiToNoteName` (cas limites, octaves extrêmes)
5. Tests pour `parseDurSeconds` / `buildSong` (morceaux de démo)
6. Tests pour `buildSongFromTracks` (chordRatio, likelyMelody, troncature)
7. CI GitHub Actions (lint + test + build à chaque push)
8. ✅ Extraire les "magic numbers" en constantes nommées (`constants.ts`)
9. Découper `Piano.tsx` (trop volumineux) en hooks dédiés (`usePlayback`, `useMidiImport`, `useKeyboardInput`)
10. Documenter l'architecture dans un `ARCHITECTURE.md`

## Phase 2 — Clavier & interaction (11–20)

11. Étendre le clavier à 3–4 octaves (ou 88 touches) avec défilement horizontal
12. Bouton pour décaler l'octave de base du mapping clavier PC
13. Support tactile (touch events) pour tablette
14. ✅ Mode plein écran du piano
15. Support de la vélocité (variation de volume au clic/maintien)
16. ✅ Pédale de sustain (barre d'espace maintenue = pédale forte)
17. ✅ Affichage du nom de la note au survol d'une touche (tooltip natif)
18. ✅ Option pour afficher/masquer les labels clavier sur les touches
19. Layout responsive (le piano est actuellement à largeur fixe)
20. ✅ Distinguer visuellement notes jouées (manuel = bleu / lecture auto = ambre / pédale sustain = violet)

## Phase 3 — Moteur audio (21–30)

21. Sélecteur d'instrument (piano, e-piano, orgue… via plusieurs `Tone.Sampler`)
22. ✅ Contrôle de volume maître
23. Réverbe réglable (`Tone.Reverb`)
24. Égaliseur simple (graves/médiums/aigus)
25. Barre de progression réelle du chargement des échantillons (actuellement binaire)
26. Bundler les échantillons en local (fallback hors-ligne, pas de dépendance au CDN)
27. Métronome audible pendant lecture/pratique
28. Pédale sustain avec release réellement prolongé (pas juste visuel)
29. Normalisation du volume entre instruments
30. Visualiseur audio simple (spectre/waveform) en option

## Phase 4 — Mode apprentissage avancé (31–45)

31. Mode "notes qui défilent" façon Synthesia avant d'atteindre le clavier
32. Mode "attendre la bonne touche" (la lecture se met en pause sans la bonne note)
33. Score/précision affiché après une session de pratique
34. ✅ Boucle A-B sur une section choisie du morceau
35. Ralentissement automatique des passages denses détectés
36. Affichage d'une partition simplifiée en parallèle du clavier
37. Mode "main gauche seule" / "main droite seule" si deux pistes identifiées
38. Statistiques de progression par morceau (temps passé, dernière session, score)
39. Leçons progressives (du plus simple au plus complexe)
40. Export d'un rapport de session (notes ratées, tempo réel vs cible)
41. Marqueurs de mesures / repères visuels pendant la lecture
42. Highlight de la touche suivante à jouer (anticipation, pas juste la note en cours)
43. Mode "call & response" (l'app joue une phrase, l'utilisateur la rejoue)
44. Suggestion de doigté (données approximatives, en option)
45. Replay instantané d'une performance enregistrée par l'utilisateur

## Phase 5 — Import/Export MIDI avancé (46–55)

46. Enregistrement de ce que joue l'utilisateur en live + export `.mid`
47. Export audio (WAV/MP3) d'un morceau joué en lecture automatique
48. Glisser-déposer un fichier MIDI directement sur la fenêtre
49. Support des fichiers MusicXML en plus du MIDI
50. Pré-écoute rapide de chaque piste dans le sélecteur avant de cocher
51. Mélange de pistes avec volume individuel par piste (pas juste tout/rien)
52. Affiner l'heuristique main gauche/droite (au-delà de tessiture + chordRatio)
53. Transposition manuelle (+/- demi-tons) en plus du clampage automatique
54. Historique des imports récents avec rechargement rapide
55. Bibliothèque de presets élargie (20–30 morceaux domaine public inclus)

## Phase 6 — Persistance & configuration (56–65)

56. ✅ Sauvegarder les morceaux importés entre les sessions (localStorage)
57. Utiliser le plugin Tauri Store ou SQLite pour la persistance locale (plus robuste que localStorage)
58. ✅ Sauvegarder les préférences utilisateur (vitesse par défaut, dernier morceau, volume, labels)
59. Import d'un dossier entier de fichiers `.mid`
60. Favoris/tags pour organiser les morceaux importés
61. Sauvegarde locale de la progression d'apprentissage
62. Export/import de la configuration complète (changement de machine)
63. Profils utilisateurs multiples
64. Thème clair/sombre avec préférence sauvegardée
65. Raccourcis clavier personnalisables

## Phase 7 — Entrée MIDI matérielle (66–72)

66. Support clavier MIDI physique (`tauri-plugin-midi` ou `midir`, cf. recommandation initiale)
67. Détection automatique de connexion/déconnexion du port MIDI
68. Distinction visuelle note MIDI physique vs souris/clavier PC
69. Calibration de la vélocité du clavier MIDI physique
70. Support pédale sustain MIDI physique (CC64)
71. Enregistrement direct depuis l'entrée MIDI physique
72. Mesure et affichage de la latence audio, bouton de calibration

## Phase 8 — Qualité, performance, robustesse (73–82)

73. Gestion d'erreur réseau si le CDN de samples est injoignable (message clair + retry)
74. Tests de performance sur gros fichiers MIDI (>5000 notes)
75. Web Worker pour le parsing MIDI lourd (hors thread principal)
76. Monitoring des glitches/underruns audio
77. Dispose Tone.js systématique vérifié par tests (fuites mémoire)
78. Tests end-to-end automatisés (Playwright/WebDriver pour Tauri)
79. Gestion multi-fenêtre (plusieurs morceaux ouverts en parallèle)
80. Optimisation du bundle (code splitting, lazy loading)
81. Audit d'accessibilité clavier (navigation Tab, lecteurs d'écran)
82. Internationalisation (FR/EN)

## Phase 9 — Packaging & distribution (83–90)

83. Icônes et métadonnées complètes de l'app (actuellement valeurs par défaut)
84. Build de release signée (certificat Windows, éviter l'alerte SmartScreen)
85. Auto-update via le plugin Tauri updater
86. Build cross-platform (macOS, Linux) + tests de compatibilité
87. Installeur MSI/NSIS personnalisé avec branding
88. Site web / documentation utilisateur
89. Publication sur un store (Microsoft Store) si pertinent
90. Changelog versionné et process de release (semver)

## Phase 10 — Fonctionnalités sociales & avancées (91–100)

91. Partage d'un morceau importé via lien/fichier exportable
92. Mode duo : deux instances synchronisées en réseau local
93. Défi/classement hebdomadaire local sur un morceau donné
94. Génération de variations harmoniques simples (accompagnement auto)
95. Reconnaissance de morceau joué (suggérer le titre depuis une mélodie)
96. Mode composition : enregistrer et rejouer ses propres morceaux
97. Export vidéo (capture piano + audio) d'une performance
98. Intégration avec un service de partitions en ligne (recherche depuis l'app)
99. Affichage de paroles synchronisées si présentes dans le MIDI (lyrics meta events)
100.  Assistant IA : suggestions d'exercices adaptées au niveau détecté
