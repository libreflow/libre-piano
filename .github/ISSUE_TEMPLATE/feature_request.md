---

name: ✨ Proposition de fonctionnalité
about: Suggérer une amélioration ou une nouvelle fonctionnalité
title: ""
labels: enhancement
body:

- type: textarea
  id: problem
  attributes:
  label: Problème ou motivation
  description: Quel besoin cette fonctionnalité résoudrait-elle ?
  placeholder: Je voudrais pratiquer une section difficile en boucle sans re-cliquer à chaque fois.
  validations:
  required: true
- type: textarea
  id: solution
  attributes:
  label: Solution proposée
  description: Décris ce que tu voudrais voir. Consulte ROADMAP.md — la fonctionnalité y est peut-être déjà planifiée.
  validations:
  required: true
- type: textarea
  id: alternatives
  attributes:
  label: Alternatives envisagées
  description: Autres solutions ou contournements déjà testés.
