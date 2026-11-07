// Détection d'accords (hors-piste) : reconnaît l'accord joué à partir
// des classes de hauteur des notes actives — magique quand on joue :
// l'app affiche « Gm7 » pendant que tes doigts le tiennent.
// Notation universelle des lead sheets (anglo-saxonne).

import { noteNameToMidi } from "./notes";

const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Intervalles (demi-tons depuis la fondamentale) -> suffixe d'accord.
 * Ordre de priorité : le premier match gagne. */
const CHORD_TYPES: { intervals: number[]; suffix: string }[] = [
  { intervals: [0, 3, 6, 9], suffix: "dim7" },
  { intervals: [0, 3, 6, 10], suffix: "m7♭5" },
  { intervals: [0, 3, 6], suffix: "dim" },
  { intervals: [0, 4, 8], suffix: "aug" },
  { intervals: [0, 3, 7, 11], suffix: "mMaj7" },
  { intervals: [0, 3, 7, 10], suffix: "m7" },
  { intervals: [0, 3, 7], suffix: "m" },
  { intervals: [0, 4, 7, 11], suffix: "maj7" },
  { intervals: [0, 4, 7, 10], suffix: "7" },
  { intervals: [0, 4, 7, 9], suffix: "6" },
  { intervals: [0, 3, 7, 9], suffix: "m6" },
  { intervals: [0, 4, 7], suffix: "" },
  { intervals: [0, 2, 7], suffix: "sus2" },
  { intervals: [0, 5, 7], suffix: "sus4" },
  { intervals: [0, 4], suffix: "maj" },
  { intervals: [0, 3], suffix: "m" },
];

/** Classes de hauteur uniques et triées d'un ensemble de noms de
 * notes ("C4", "G3"...) — les octaves ne comptent pas pour un accord. */
export function pitchClasses(notes: Iterable<string>): number[] {
  const set = new Set<number>();
  for (const n of notes) {
    const midi = noteNameToMidi(n);
    if (midi !== null) set.add(((midi % 12) + 12) % 12);
  }
  return [...set].sort((a, b) => a - b);
}

/** Nom de l'accord reconnu ("Gm7"), ou null si indéterminé.
 * Essaie chaque classe de hauteur comme fondamentale : un accord matche
 * quand les intervalles depuis elle correspondent exactement. Les
 * renversements donnent le même ensemble de classes de hauteur, donc
 * aucun tri de basse n'est nécessaire. */
export function detectChord(notes: Iterable<string>): string | null {
  const pcs = pitchClasses(notes);
  if (pcs.length < 2 || pcs.length > 5) return null;
  for (const root of pcs) {
    const rel = pcs
      .map((pc) => ((pc - root) % 12 + 12) % 12)
      .sort((a, b) => a - b);
    for (const type of CHORD_TYPES) {
      if (type.intervals.length !== rel.length) continue;
      if (type.intervals.every((iv, i) => iv === rel[i])) {
        return PC_NAMES[root] + type.suffix;
      }
    }
  }
  return null;
}
