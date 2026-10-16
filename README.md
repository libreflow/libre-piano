# Libre Piano

Piano virtuel de bureau (Tauri 2 + React + TypeScript) avec lecture
automatique, import de fichiers MIDI, et mode apprentissage.

## Fonctionnalités

- **Clavier** : 2 octaves (C3–C5), jouable à la souris ou au clavier PC
  (`A S D F G H J L` + `Z X C V B N M 2 3 4` pour les touches noires)
- **Son** : `Tone.Sampler` avec échantillons réels de piano (Salamander Grand Piano, échantillons servis localement)
- **Lecture automatique** : morceaux de démo intégrés + import de fichiers
  `.mid`/`.midi`, avec sélection de piste (détection heuristique de la
  mélodie vs l'accompagnement), vitesse réglable (50–150 %), boucle A-B
- **Pédale de sustain** : barre d'espace maintenue
- **Persistance locale** : morceaux importés et préférences conservés
  entre les sessions

## Développement

```bash
npm install
npm run tauri dev      # lance l'app en mode développement
npm run build           # build frontend (tsc + vite)
npm run tauri build      # build l'exécutable complet
npm run lint              # ESLint
npm run format             # Prettier
npm test                         # tests unitaires (Vitest)
```

Voir [`ROADMAP.md`](./ROADMAP.md) pour le plan d'amélioration détaillé.

## Stack

Tauri 2 · React 19 · TypeScript · Vite · Tone.js · @tonejs/midi

## Prérequis

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (toolchain stable)
- Dépendances système Tauri : voir les
  [prérequis officiels](https://tauri.app/start/prerequisites/)
