// Transposition manuelle d'un morceau (roadmap #53) : décalage en demi-tons
// appliqué aux événements à la lecture, en complément du clampage
// automatique à l'import. Module pur, testé.

import { MAX_MIDI, MIN_MIDI, midiToNoteName, noteNameToMidi } from "./notes";
import type { Song, SongEvent } from "./songs";

/** Bornes du décalage en demi-tons (le clavier couvre 88 demi-tons). */
export const TRANSPOSE_MIN = -11;
export const TRANSPOSE_MAX = 11;

/** Ramène un décalage dans les bornes. */
export function clampTranspose(semitones: number): number {
  if (!Number.isFinite(semitones)) return 0;
  return Math.max(TRANSPOSE_MIN, Math.min(TRANSPOSE_MAX, Math.round(semitones)));
}

/**
 * Transpose les événements d'un morceau de `semitones` demi-tons.
 * Les notes qui sortiraient du clavier (A0-C8) restent à leur place
 * plutôt que de disparaître : le morceau reste jouable à l'oreille.
 */
export function transposeSongEvents(events: SongEvent[], semitones: number): SongEvent[] {
  const shift = clampTranspose(semitones);
  if (shift === 0) return events;
  return events.map((e) => {
    const midi = noteNameToMidi(e.note);
    if (midi === null) return e;
    const target = midi + shift;
    if (target < MIN_MIDI || target > MAX_MIDI) return e;
    return { ...e, note: midiToNoteName(target) };
  });
}

/** Applique la transposition à un morceau (nouvelle instance). */
export function transposedSong(song: Song, semitones: number): Song {
  if (clampTranspose(semitones) === 0) return song;
  return { ...song, events: transposeSongEvents(song.events, semitones) };
}
