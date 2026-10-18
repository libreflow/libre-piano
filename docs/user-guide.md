# Guide utilisateur — Libre Piano

Piano virtuel de bureau : jouable à la souris, au clavier PC ou sur écran
tactile, avec lecture automatique, import MIDI et mode apprentissage.

## Installation

Télécharge l'installeur de ton OS sur la
[page des releases](https://github.com/libreflow/libre-piano/releases) :

- **Windows** : `.exe` (NSIS, installation utilisateur, FR/EN) ;
- **macOS** : `.dmg` (Intel et Apple Silicon) ;
- **Linux** : `.AppImage` ou `.deb`.

Aucune connexion n'est requise après l'installation : les échantillons de
piano (Salamander Grand Piano) sont embarqués.

## Jouer

- **Souris/tactile** : clique (ou touche) une touche du clavier 88 touches ;
  glisse hors de la touche pour la relâcher.
- **Clavier PC** : la rangée du milieu est mappée sur 2 octaves. En AZERTY :
  `Q S D F G H J K L M` pour les blanches, `W X C V B N , É " '` pour les
  noires. Bascule AZERTY/QWERTY dans la barre d'outils.
- **Décaler la fenêtre clavier** : boutons ◀ ▶ « C3 … C6 » pour monter ou
  descendre d'une octave.
- **Pédale de sustain** : maintiens la barre d'**espace** — les notes
  relâchées continuent de sonner jusqu'au relâchement.
- **Entrée** : lance/arrête la lecture du morceau sélectionné.

## Réglages

- **Vitesse** de lecture 50–150 %, **volume** maître, **réverbe** réglable ;
- **Transposition** ◀ ▶ : décale la lecture en demi-tons (±11) ;
- **Métronome** : case à cocher + tempo 40–240 BPM ;
- **Thème** clair/sombre, plein écran, étiquettes des touches
  (lettres, solfège, les deux, aucune) ;
- Tout est sauvegardé automatiquement entre les sessions.

## Morceaux

- **Lecture** : sélectionne un morceau → ▶ Lecture (ou `Entrée`). La
  **boucle A-B** répète une section : coche-la, règle début/fin en secondes.
- **Import MIDI** : bouton Importer ou glisse-dépose un `.mid`/`.midi` sur la
  fenêtre. Choisis les pistes : une étoile signale la mélodie probable, le
  bouton **Écouter** pré-écoute 8 secondes de chaque piste.
- **Favoris** : l'étoile à côté du sélecteur épingle un morceau en tête.
- **Suppression** : corbeille sur un morceau importé.
- **Export `.mid`** : bouton dédié, télécharge le morceau sélectionné.

## Enregistrement

Le bouton **● Enregistrer** capture ce que tu joues (durées et nuances
incluses). **■ Stopper** sauvegarde la performance dans la bibliothèque
(titre horodaté) — elle devient un morceau ordinaire : lisible, exportable,
persisté.

## Mode apprentissage

1. Sélectionne un morceau, clique **Apprentissage**.
2. La touche attendue est surlignée en vert, la **suivante** en liseré bleu
   (anticipation) ; le clavier suit automatiquement.
3. Joue la bonne note pour avancer ; une faute est comptée.
4. Fin de session : score de justesse sur 100 + tes statistiques
   (meilleur score, nombre de sessions, moyenne, dernière date).

## Sauvegarde et transfert

Tout vit dans le stockage local de l'app. **Exporter** (groupe Affichage)
télécharge un fichier JSON avec morceaux + préférences : **Importer**
le restaure sur une autre machine.

## Raccourcis

| Touche              | Action                      |
| ------------------- | --------------------------- |
| `Espace` (maintenu) | Pédale de sustain           |
| `Entrée`            | Lecture / arrêt             |
| Rangée du milieu    | Notes de la fenêtre clavier |

## Problèmes fréquents

- **Aucun son** : clique une touche une première fois (les navigateurs
  exigent une interaction avant de démarrer l'audio).
- **Sons introuvables** : réinstalle l'app (échantillons embarqués manquants).
- **Un réglage a disparu** : le stockage local était peut-être plein —
  supprime des morceaux importés, puis Exporter ta configuration.
