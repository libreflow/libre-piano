# Contribuer à Libre Piano

Merci de l'intérêt ! Voici comment démarrer.

## Prérequis

- Node.js 18+
- Rust toolchain stable
- Dépendances système Tauri : [prérequis officiels](https://tauri.app/start/prerequisites/)

## Setup

```bash
git clone https://github.com/libreflow/libre-piano
cd libre-piano
npm install
npm run tauri dev
```

## Workflow

1. Crée une branche : `git checkout -b ma-feature`
2. Code ta modification
3. Vérifie **tous** les checks avant de pousser :

```bash
npm run lint      # ESLint (0 erreur attendu)
npm test          # Vitest (88 tests)
npm run build     # tsc + vite build
npx prettier --check .   # formatage
```

4. Ouvre une PR avec une description claire du changement et de la vérification effectuée.

## Conventions

- **TypeScript strict** : pas de `any` implicite, `noUnusedLocals` activé.
- **Commentaires** : en français, pour expliquer le _pourquoi_ (décisions,
  pièges), pas le _quoi_.
- **Tests** : tout module pur (`notes`, `songs`, `midi-import`) doit avoir ses
  tests unitaires. Les hooks/composants sont testés via testing-library avec
  `tone-gate` mocké.
- **Pas de nouvelle dépendance** sans discussion préalable dans une issue.
- **Style** : Prettier gère le formatage (`npm run format`), ne formate pas à la main.

## Signaler un bug

Ouvre une issue avec le modèle « Rapport de bug » : étapes de reproduction,
comportement attendu vs observé, et système d'exploitation. Les logs du dev
(`npm run tauri dev`) sont utiles.

## Sécurité

Ne signale pas de vulnérabilité dans une issue publique : voir
[`SECURITY.md`](./SECURITY.md).

## Roadmap

Les fonctionnalités planifiées sont dans [`ROADMAP.md`](./ROADMAP.md) — les
issues "good first issue" sont un bon point d'entrée.
