// Horloge de lecture partagée : position « temps x1 du morceau » à partir
// du temps du Transport (qui avance en temps réduit selon la vitesse) et
// de la fenêtre A-B jouée. Unique source pour le timecode
// (PlaybackOverlay) et la pluie de notes (NoteRain) — la même formule
// pour tous les affichages, sinon ils divergent.

export interface PlaybackWindow {
  enabled: boolean;
  start: number;
  end: number;
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
  const clampedStart = Math.max(0, Math.min(loop.start, songDuration));
  const clampedEnd = Math.max(clampedStart, Math.min(loop.end, songDuration));
  if (!loop.enabled) {
    return Math.min(t, songDuration);
  }
  const sectionLength = Math.max(0, clampedEnd - clampedStart);
  const songRel = sectionLength > 0 ? t % sectionLength : 0;
  return Math.min(clampedStart + songRel, songDuration);
}

/** Bornes de la section jouée (utile pour filtrer les événements
 * affichés : la pluie de notes ne montre que la section jouée). */
export function playbackSection(
  loop: PlaybackWindow,
  songDuration: number
): { start: number; end: number } {
  const clampedStart = Math.max(0, Math.min(loop.start, songDuration));
  const clampedEnd = Math.max(clampedStart, Math.min(loop.end, songDuration));
  return loop.enabled
    ? { start: clampedStart, end: clampedEnd }
    : { start: 0, end: songDuration };
}
