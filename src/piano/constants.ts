// Constantes nommées pour remplacer les valeurs magiques dispersées dans le
// code (cf. roadmap #8). Centralisées ici pour être réglables en un seul
// endroit et documentées.

/** Tempo de référence (BPM) utilisé pour écrire les morceaux de démo en
 * notation rythmique ("4n", "8n"...). Le facteur de vitesse choisi dans
 * l'UI est appliqué ensuite, sur les évènements déjà calculés. */
export const REFERENCE_BPM = 100;

/** Deux notes MIDI importées sont considérées comme un "accord" (jouées
 * simultanément) si leurs débuts sont distants de moins de ce seuil. */
export const CHORD_SIMULTANEITY_THRESHOLD_SEC = 0.03;

/** Au-delà de ce taux d'accords, une piste est considérée comme de
 * l'accompagnement plutôt qu'une mélodie candidate. */
export const MELODY_CHORD_RATIO_THRESHOLD = 0.5;

/** Seuil d'affichage "accords/accompagnement" vs "monophonique" dans le
 * sélecteur de pistes (purement indicatif pour l'utilisateur). */
export const DISPLAY_CHORD_RATIO_THRESHOLD = 0.3;

/** Durée minimale appliquée à une note importée depuis un fichier MIDI,
 * pour éviter des notes quasi inaudibles (staccato extrême / erreurs). */
export const MIN_IMPORTED_NOTE_DURATION_SEC = 0.05;

/** Nombre maximal de notes conservées à l'import d'un fichier MIDI, pour
 * éviter de bloquer l'UI sur des fichiers démesurés. */
export const MAX_IMPORTED_EVENTS = 3000;

/** Fraction de la durée d'une note à laquelle on éteint visuellement la
 * touche surlignée pendant la lecture automatique (légèrement avant la fin
 * réelle, pour un rendu plus net). */
export const NOTE_HIGHLIGHT_RELEASE_FRACTION = 0.92;

/** Marge de sécurité (secondes) ajoutée après la fin calculée d'un morceau
 * avant de déclencher l'arrêt automatique de la lecture. */
export const PLAYBACK_END_BUFFER_SEC = 0.1;

/** Bornes du slider de vitesse de lecture automatique, en pourcentage. */
export const SPEED_MIN_PERCENT = 50;
export const SPEED_MAX_PERCENT = 150;
export const SPEED_STEP_PERCENT = 5;
export const SPEED_DEFAULT_PERCENT = 100;

/** Bornes du volume maître, en pourcentage (converti en dB pour Tone.js). */
export const VOLUME_MIN_PERCENT = 0;
export const VOLUME_MAX_PERCENT = 100;
export const VOLUME_DEFAULT_PERCENT = 80;

/** Durée d'affichage d'un message de statut (import, quota...) avant
 * effacement automatique, en millisecondes. */
export const STATUS_MESSAGE_TIMEOUT_MS = 8000;
