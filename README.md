# Libre Piano

Piano virtuel de bureau (Tauri 2 + React + TypeScript) avec lecture
automatique, import de fichiers MIDI, et mode apprentissage.

[![CI](https://github.com/libreflow/libre-piano/actions/workflows/ci.yml/badge.svg)](https://github.com/libreflow/libre-piano/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/libreflow/libre-piano?include_prereleases)](https://github.com/libreflow/libre-piano/releases)

## Fonctionnalités

- **Clavier** : 88 touches (A0–C8) avec défilement, jouable à la souris, au
  clavier PC ou sur écran tactile (`A S D F G H J L` + `Z X C V B N M 2 3 4`
  pour les touches noires, disposition AZERTY ou QWERTY, fenêtre décalable
  par octaves)
- **Son** : `Tone.Sampler` avec échantillons réels de piano (Salamander Grand
  Piano, échantillons servis localement, aucune dépendance réseau)
- **Lecture automatique** : morceaux de démo intégrés + import de fichiers
  `.mid`/`.midi`, avec sélection de piste (détection heuristique de la
  mélodie vs l'accompagnement), vitesse réglable (50–150 %), boucle A-B
- **Mode apprentissage** : la note attendue est surlignée, la session
  avance à chaque bonne note, compteur de fautes en fin de session
- **Pédale de sustain** : barre d'espace maintenue
- **Plein écran** : pour jouer sans distraction
- **Persistance locale** : morceaux importés et préférences conservés
  entre les sessions (localStorage, aucune donnée envoyée en ligne)

## Installation

Télécharge la dernière version pour ton OS sur la
[page des releases](https://github.com/libreflow/libre-piano/releases)
(Windows, macOS — incl. Apple Silicon, Linux AppImage/deb).

## Développement

```bash
npm install
npm run tauri dev      # lance l'app en mode développement
npm run build          # build frontend (tsc + vite)
npm run tauri build     # build l'exécutable complet
npm run lint           # ESLint
npm run format         # Prettier
npm test               # tests unitaires (Vitest)
```

Voir [`ARCHITECTURE.md`](./ARCHITECTURE.md) pour la structure du code et
[`ROADMAP.md`](./ROADMAP.md) pour le plan d'amélioration détaillé.

## Stack

Tauri 2 · React 19 · TypeScript · Vite · Tone.js · @tonejs/midi

## Prérequis

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (toolchain stable)
- Dépendances système Tauri : voir les
  [prérequis officiels](https://tauri.app/start/prerequisites/)

## Contribuer

Les contributions sont bienvenues ! Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md).
Les fonctionnalités planifiées sont dans [`ROADMAP.md`](./ROADMAP.md) — les
issues « good first issue » sont un bon point d'entrée.

## Licence

[MIT](./LICENSE) — échantillons audio Salamander Grand Piano sous
[CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) (Alexander Holm).
