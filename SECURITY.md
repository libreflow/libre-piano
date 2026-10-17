# Politique de sécurité

## Versions prises en charge

Libre Piano est un projet communautaire ; seule la dernière version publiée
reçoit des correctifs de sécurité.

| Version | Prise en charge |
| ------- | --------------- |
| 0.2.x   | ✅              |
| < 0.2   | ❌              |

## Signaler une vulnérabilité

**Merci de ne pas ouvrir d'issue publique pour les vulnérabilités de
sécurité.**

Utilise plutôt l'outil de signalement privé de GitHub :
**Security → Report a vulnerability** sur ce dépôt. Inclue si possible :

- une description du problème et de son impact potentiel ;
- les étapes de reproduction ou un proof-of-concept ;
- la ou les versions affectées.

Tu recevras un accusé de réception sous quelques jours. Merci de laisser un
délai raisonnable (90 jours) avant toute divulgation publique.

## Portée

- **Dans le périmètre** : l'application (frontend React/TypeScript, shell
  Tauri/Rust, configuration de build, workflows CI du dépôt).
- **Hors périmètre** : vulnérabilités des dépendances déjà connues et
  publiquement documentées (signale-les plutôt via Dependabot/les issues),
  problèmes nécessitant un accès physique à la machine de l'utilisateur.
