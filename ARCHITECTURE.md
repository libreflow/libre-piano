# Architecture

## Vue d'ensemble

Libre Piano est une application de bureau Tauri 2 : un frontend React/TypeScript
rendu dans une webview, et un backend Rust minimal (aucune commande custom —
tout le métier vit dans le frontend).

```
┌───────────────────────────────┐
│  React (webview)              │
│                               │
│  Piano.tsx (orchestration)    │
│   ├── hooks/ (état UI)        │
│   │    usePianoState ·        │
│   │    useStatusMessage ·     │
│   │    useFavorites ·         │
│   │    useFullscreen          │
│   ├── hooks métier            │
│   │    useAudioEngine ← Sampler Tone.js + volume
│   │    usePlayback ← Transport/Part, boucle A-B
│   │    useKeyboardInput ← clavier PC + pédale sustain
│   │    useMetronome · useRecorder · usePractice ·
│   │    useCallResponse · useVisualizer · …
│   └── components/ (UI)       │
│        PlaybackControls · SoundControls ·
│        KeyboardControls · SettingsMenu ·
│        PianoKeyboard · LoopControls ·
│        TrackPicker · PracticePanel ·
│        EchoPanel · StatusOverlays │
│                               │
│  Modules purs (testés) :      │
│   notes.ts · songs.ts ·       │
│   midi-import.ts · storage.ts │
└───────────────────────────────┬─┘
                │ localStorage + fetch samples
┌───────────────────────────────┴─┐
│  Tauri (Rust)                  │
│  lib.rs : fenêtre + plugin     │
│  opener uniquement             │
└───────────────────────────────┘
```

### Découpage (refactor Piano.tsx)

`Piano.tsx` orchestre : il câble les hooks entre eux et compose les
composants. Règles pour le faire grandir proprement :

- **Composants passifs** (`src/piano/components/`) : valeurs et callbacks
  en props, pas d'état métier local — tout le métier vit dans les hooks.
- **Hooks d'état UI** (`src/piano/hooks/`) : `usePianoState` (chargement
  persisté + callback `persist` stable), `useStatusMessage` (message
  auto-expirant), `useFavorites`, `useFullscreen`.
- **Patterns « adjusting state during render »** (reset de session au
  changement de morceau, octave auto en apprentissage) : ils restent
  chez `Piano.tsx` — un hook déplacé dans un enfant s'exécuterait dans
  un autre ordre d'effets.
- Plan de référence : `docs/plan-refactor-piano.md`.

## Flux de données

### Audio

`tone-gate.ts` est le seul point d'entrée de Tone.js : des imports ciblés
(`instrument/Sampler`, `event/Part`, `core/Global`) plutôt que `import * as Tone`,
pour limiter la taille du bundle (~470 kB au lieu de 518 kB). De même,
`@tonejs/midi` est importé dynamiquement dans `midi-import.ts` (chunk
séparé chargé au premier import MIDI).

- `useAudioEngine` crée le `Sampler` (échantillons Salamander servis depuis
  `public/samples`, donc hors-ligne) et expose `noteOn`/`noteOff`/
  `triggerAttackRelease`. Le volume maître applique une courbe log
  (% → dB) sur `getDestination()`.
- `usePlayback` construit un `Tone.Part` à partir des événements du morceau
  (`SongEvent[]`, temps absolus en secondes), applique le facteur de vitesse,
  la fenêtre A-B, et programme l'arrêt automatique. La surbrillance des
  touches passe par `getDraw().schedule()` (synchronisé au frame).
- `useKeyboardInput` mappe les touches PC (`KEY_TO_NOTE`) aux notes, gère la
  pédale sustain (barre d'espace) et relâche tout au blur de la fenêtre.

### Morceaux

Le modèle unifié `Song` (`songs.ts`) est une liste d'événements à temps absolu.
Deux sources : les morceaux intégrés (notation rythmique convertie en secondes
via `REFERENCE_BPM`) et l'import MIDI (`midi-import.ts` : parsing `@tonejs/midi`,
résumé heuristique des pistes pour distinguer mélodie/accompagnement, transposition
par octaves vers la plage C3–C5, troncature à `MAX_IMPORTED_EVENTS`).

### Persistance

`storage.ts` sérialise l'état complet (morceaux importés, préférences) dans
`localStorage`, avec repli silencieux sur les valeurs par défaut si le stockage
est indisponible ou corrompu.

## Conventions d'état

- **Refs parallèles** : quelques états existent en double — la valeur React
  (`isPlaying`, `sustainOn`) pour le rendu, et une ref synchronisée par effect
  (`isPlayingRef`, `sustainOnRef`) pour les callbacks audio à chaud, qui ont
  besoin de la valeur courante sans recréer les listeners.
- **Ajustement pendant le render** : la réinitialisation de la boucle A-B au
  changement de morceau suit le pattern "adjusting state during render" de React
  (cf. `prevSongIdForLoop`), pas un effect.

## Tests

Vitest + jsdom. Les modules purs ont des tests unitaires directs ; les hooks et
le composant sont testés via `@testing-library/react` avec `tone-gate` mocké
(les tests ne dépendent ni du réseau ni de WebAudio).
