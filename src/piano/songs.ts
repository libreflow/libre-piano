// Modèle unifié des morceaux : une liste d'évènements à temps absolu
// (en secondes, à vitesse normale x1). C'est ce format qui est lu par
// Tone.Part pour la lecture automatique. Il est produit soit à partir
// des morceaux de démo ci-dessous (notation rythmique classique), soit
// par l'import d'un fichier MIDI (voir midi-import.ts).
import { REFERENCE_BPM } from "./constants";

export interface SongEvent {
  time: number; // secondes depuis le début du morceau
  note: string; // ex: "C4", "D#3"
  duration: number; // secondes
}

export interface Song {
  id: string;
  title: string;
  events: SongEvent[];
  source: "builtin" | "imported";
}

// --- Notation d'écriture des morceaux de démo -----------------------------
// Notation Tone.js : "4n" = noire, "8n" = croche, "2n" = blanche, "1n" = ronde,
// "4n." = noire pointée. `note: null` représente un silence.
interface SongNote {
  note: string | null;
  dur: string;
}

// Tempo de référence utilisé pour écrire les morceaux de démo (REFERENCE_BPM
// => une noire dure 60/REFERENCE_BPM secondes). Le multiplicateur de vitesse
// choisi dans l'UI est appliqué plus tard, sur les évènements déjà calculés.
const REFERENCE_QUARTER_SEC = 60 / REFERENCE_BPM;

function parseDurSeconds(dur: string): number {
  const dotted = dur.endsWith(".");
  const base = dotted ? dur.slice(0, -1) : dur;
  const n = parseInt(base, 10); // "4n" -> 4, "8n" -> 8, "1n" -> 1
  const quarters = 4 / n; // noire = 1 quart, blanche = 2, croche = 0.5...
  const seconds = quarters * REFERENCE_QUARTER_SEC;
  return dotted ? seconds * 1.5 : seconds;
}

function buildSong(id: string, title: string, notes: SongNote[]): Song {
  let cursor = 0;
  const events: SongEvent[] = [];
  for (const n of notes) {
    const duration = parseDurSeconds(n.dur);
    if (n.note) {
      events.push({ time: cursor, note: n.note, duration });
    }
    cursor += duration;
  }
  return { id, title, events, source: "builtin" };
}

export function songDuration(song: Song): number {
  return song.events.reduce((max, e) => Math.max(max, e.time + e.duration), 0);
}

export const BUILTIN_SONGS: Song[] = [
  buildSong("au-clair-de-la-lune", "Au clair de la lune", [
    { note: "C4", dur: "4n" },
    { note: "C4", dur: "4n" },
    { note: "C4", dur: "4n" },
    { note: "D4", dur: "4n" },
    { note: "E4", dur: "2n" },
    { note: "D4", dur: "4n" },
    { note: "C4", dur: "4n" },
    { note: "E4", dur: "4n" },
    { note: "D4", dur: "4n" },
    { note: "D4", dur: "2n" },
    { note: "C4", dur: "1n" },
    { note: null, dur: "4n" },
  ]),
  buildSong("ode-to-joy", "Hymne à la joie (extrait)", [
    { note: "E4", dur: "4n" },
    { note: "E4", dur: "4n" },
    { note: "F4", dur: "4n" },
    { note: "G4", dur: "4n" },
    { note: "G4", dur: "4n" },
    { note: "F4", dur: "4n" },
    { note: "E4", dur: "4n" },
    { note: "D4", dur: "4n" },
    { note: "C4", dur: "4n" },
    { note: "C4", dur: "4n" },
    { note: "D4", dur: "4n" },
    { note: "E4", dur: "4n" },
    { note: "E4", dur: "4n." },
    { note: "D4", dur: "8n" },
    { note: "D4", dur: "2n" },
    { note: null, dur: "4n" },
  ]),
  buildSong("gamme-do-majeur", "Gamme de Do majeur", [
    { note: "C4", dur: "8n" },
    { note: "D4", dur: "8n" },
    { note: "E4", dur: "8n" },
    { note: "F4", dur: "8n" },
    { note: "G4", dur: "8n" },
    { note: "A4", dur: "8n" },
    { note: "B4", dur: "8n" },
    { note: "C5", dur: "4n" },
    { note: null, dur: "4n" },
    { note: "C5", dur: "8n" },
    { note: "B4", dur: "8n" },
    { note: "A4", dur: "8n" },
    { note: "G4", dur: "8n" },
    { note: "F4", dur: "8n" },
    { note: "E4", dur: "8n" },
    { note: "D4", dur: "8n" },
    { note: "C4", dur: "2n" },
  ]),
];
