---

name: 🐛 Rapport de bug
about: Quelque chose ne fonctionne pas comme prévu
title: ""
labels: bug
body:

- type: textarea
  id: description
  attributes:
  label: Description
  description: Décris le bug en une ou deux phrases.
  placeholder: La note C4 continue de sonner après avoir relâché la touche.
  validations:
  required: true
- type: textarea
  id: reproduction
  attributes:
  label: Étapes de reproduction
  description: "Étapes minimales pour reproduire le comportement."
  placeholder: | 1. Lancer l'app 2. Maintenir la touche Espace 3. Jouer C4 puis relâcher
  validations:
  required: true
- type: textarea
  id: expected
  attributes:
  label: Comportement attendu
  description: Ce qui aurait dû se passer.
  validations:
  required: true
- type: textarea
  id: environment
  attributes:
  label: Environnement
  description: OS, version de l'app (voir « À propos » ou release), disposition clavier.
  placeholder: "Windows 11, Libre Piano 0.2.1, AZERTY"
  validations:
  required: true
- type: textarea
  id: logs
  attributes:
  label: Logs pertinents
  description: Sortie de `npm run tauri dev` le cas échéant. Les secrets seront visibles publiquement, masque-les.
  render: shell
