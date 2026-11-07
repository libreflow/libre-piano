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
 * En boucle A-B, la position défile DANS la section jouée et
 * revient au début de section à chaque tour. */
export function playbackSeconds(
  transportSeconds: number,
  speedPercent: number,
  loop: PlaybackWindow,
  songDuration: number
): number {
  const speedFactor = speedPercent / 100;
  const clampedStart = Math.max(0, Math.min(loop.start, songDuration));
  const clampedEnd = Math.max(clampedStart, Math.min(loop.end, songDuration));
  const sectionStart = loop.enabled ? clampedStart : 0;
  const sectionEnd = loop.enabled ? clampedEnd : songDuration;
  const inSection = Math.min(
    Math.max(transportSeconds * speedFactor, 0),
    Math.max(0, sectionEnd - sectionStart)
  );
  return Math.min(inSection + sectionStart, songDuration);
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
