// Pluie de notes (vision « Synthesia ») : les notes du morceau tombent
// en canvas, alignées sur les vraies touches du clavier — on voit
// arriver la mélodie avant qu'elle sonne. Géométrie pure (testable) :
// chaque note a une couloir (x, largeur) calqué sur la touche.

import { getKeyboardLayout, getWhitePositionOfNote, noteNameToMidi } from "./notes";
import type { SongEvent } from "./songs";

/** Durée de visibilité verticale de la pluie (secondes de morceau x1). */
export const NOTE_RAIN_LOOKAHEAD_SEC = 3;

/** Lueur résiduelle des notes déjà jouées (secondes). */
export const NOTE_RAIN_TAIL_SEC = 0.25;

export interface NoteLane {
  x: number;
  width: number;
}

/** Couloir horizontal d'une note, aligné sur sa touche physique.
 * `keyW` = largeur d'une touche blanche (px), lue depuis --key-w. */
export function noteLane(note: string, keyW: number): NoteLane | null {
  const midi = noteNameToMidi(note);
  if (midi === null) return null;
  const { keys } = getKeyboardLayout();
  const key = keys.find((k) => k.note === note);
  if (!key) return null;
  if (key.isBlack) {
    // Le couloir noir chevauche la frontière entre les deux blanches
    // voisines, comme la touche elle-même (cf. .key.black left).
    const center = getWhitePositionOfNote(note); // blanche précédente + 0.69
    const w = keyW * 0.62;
    return { x: center * keyW - w / 2, width: w };
  }
  return { x: key.whiteIndex * keyW, width: keyW };
}

/** teinte du couloir selon la touche (blanche = accent, noire = indigo). */
export function laneKind(note: string): "white" | "black" {
  return note.includes("#") ? "black" : "white";
}

/** Le canvas doit couvrir exactement la largeur du clavier 88 touches. */
export function rainCanvasWidth(keyW: number): number {
  const { whiteKeyCount } = getKeyboardLayout();
  return whiteKeyCount * keyW;
}

/**
 * Filtre et gère les événements visibles dans la fenêtre de la pluie.
 * Retourne les événements dont le bloc [time, time+duration] intersecte
 * [now - tail, now + lookahead], dans l'ordre du temps — les contrôles
 * appelants peuvent ensuite projeter y = f(time - now).
 */
export function visibleRainEvents(
  events: SongEvent[],
  now: number,
  lookahead = NOTE_RAIN_LOOKAHEAD_SEC,
  tail = NOTE_RAIN_TAIL_SEC
): { event: SongEvent; startDelta: number }[] {
  const first = lowerBound(events, now - tail);
  const out: { event: SongEvent; startDelta: number }[] = [];
  for (let i = first; i < events.length; i++) {
    const e = events[i];
    if (e.time > now + lookahead) break;
    if (e.time - now > lookahead) break;
    if (e.time + e.duration < now - tail) continue;
    out.push({ event: e, startDelta: e.time - now });
  }
  return out;
}

function lowerBound(events: SongEvent[], t: number): number {
  // premier événement possible dont la fin est encore >= t : comme les
  // durées sont bornées par le morceau, un recul linéaire suffit — mais
  // on balaie en arrière depuis une recherche binaire sur time - 12 s
  // (durée max réaliste d'une note) pour rester O(log n).
  let lo = 0;
  let hi = events.length;
  const floor = t - 12;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].time < floor) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
