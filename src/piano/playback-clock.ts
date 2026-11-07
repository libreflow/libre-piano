// Horloge de lecture partagée : position « temps x1 du morceau » à partir
// du temps du Transport (qui avance en temps réduit selon la vitesse) et
// de la fenêtre A-B jouée. Unique source pour le timecode
// (PlaybackOverlay) et la pluie de notes (NoteRain) — la même formule
// pour tous les affichages, sinon ils divergent.

import { MIN_LOOP_SECTION_SEC } from "./constants";

export interface PlaybackWindow {
  enabled: boolean;
  start: number;
  end: number;
}

/** Normalise la fenêtre de boucle A-B (unique vérité, partagée par la
 * lecture réelle — usePlayback — et les affichages — playbackSeconds /
 * playbackSection ; avant, chaque côté réécrivait ses propres bornes et
 * une micro-boucle divergeait entre ce qui était joué et affiché) :
 * - bornes clampées à [0, durée du morceau] ;
 * - bornes jamais réglées (<= 0) ou section dégénérée : morceau entier ;
 * - bornes croisées : échangées (comme joué) ;
 * - section trop courte (< MIN_LOOP_SECTION_SEC) : élargie à ce minimum,
 *   plafonnée à la fin du morceau (sinon la boucle gigs en cycle vide). */
export function resolvePlaybackSection(
  loop: PlaybackWindow,
  songDuration: number
): { start: number; end: number } {
  if (!loop.enabled) return { start: 0, end: songDuration };
  const clampedStart = Math.max(
    0,
    Math.min(Number.isFinite(loop.start) ? loop.start : 0, songDuration)
  );
  const clampedEnd = Math.max(
    0,
    Math.min(Number.isFinite(loop.end) ? loop.end : 0, songDuration)
  );
  let start = clampedStart;
  let end = clampedEnd;
  if (start > end) [start, end] = [end, start];
  // Bornes jamais réglées : jouer le morceau entier en boucle.
  if (end <= 0) return { start: 0, end: songDuration };
  // Section trop courte pour être jouable : élargir, plafonné au morceau.
  if (end - start < MIN_LOOP_SECTION_SEC) {
    end = Math.min(start + MIN_LOOP_SECTION_SEC, songDuration);
    if (end <= start) return { start: 0, end: songDuration };
  }
  return { start, end };
}

/** Position (secondes, temps x1 du morceau) pendant la lecture.
 * En boucle A-B, la lecture tourne sur la section : le Transport,
 * lui, avance indéfiniment (Tone.js rejoue le Part en boucle), donc la
 * position CYCLE dans la section au lieu d'être plafonnée. */
export function playbackSeconds(
  transportSeconds: number,
  speedPercent: number,
  loop: PlaybackWindow,
  songDuration: number
): number {
  const speedFactor = speedPercent / 100;
  const t = Math.max(0, transportSeconds * speedFactor);
  const section = resolvePlaybackSection(loop, songDuration);
  if (!loop.enabled) return Math.min(t, songDuration);
  const sectionLength = section.end - section.start;
  const songRel = sectionLength > 0 ? t % sectionLength : 0;
  return Math.min(section.start + songRel, songDuration);
}

/** Bornes de la section jouée (utile pour filtrer les événements
 * affichés : la pluie de notes ne montre que la section jouée). */
export function playbackSection(
  loop: PlaybackWindow,
  songDuration: number
): { start: number; end: number } {
  return resolvePlaybackSection(loop, songDuration);
}
