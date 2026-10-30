# AGENTS.md — libre-piano

Règles de référence pour tout agent de code IA travaillant sur ce repo.

## Projet
Piano virtuel de bureau — Tauri 2 + React + TypeScript, audio via Tone.js, import MIDI via @tonejs/midi. UI en français.

## Commandes
- `npm run dev` — dev (Vite + Tauri)
- `npm run build` — `tsc && vite build`
- `npm run lint` — eslint
- `npm run test` — vitest run
- `npm run format` — prettier --write .
- Release : `npm run release` (ne pas déclencher sans accord explicite)

## Règles Tauri 2 (non négociables)
- Toute commande IPC Rust est `async fn` et déclarée dans `generate_handler!`.
- Capabilities au moindre privilège : pas d'élargissement de permissions ni de wildcard sans justification dans la PR.
- Ne pas modifier `tauri.conf.json` sans accord explicite du mainteneur.
- Plugins officiels privilégiés (dialog, fs, opener, log) plutôt que du custom.

## Sécurité
- Jamais de secret ni de clé d'API dans le code front ou le back.
- Toute nouvelle dépendance (npm ou crate) doit être auditée avant ajout (commits récents, maintenance, alertes sécurité).

## Workflow
- Une tâche = une issue = une petite PR focalisée.
- Spécification courte (contexte + critères d'acceptation) écrite avant de coder.
- CI verte obligatoire avant tout merge ; `npm run tauri dev` manuel requis avant toute release.
