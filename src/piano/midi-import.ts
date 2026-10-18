import type { Midi } from "@tonejs/midi";

/** Vue structurelle d'un fichier MIDI : satisfaite aussi bien par l'objet
 * `Midi` de @tonejs/midi que par les plain-objects sérialisés issus du
 * Web Worker (roadmap #75) — les fonctions ci-dessous acceptent les deux. */
export interface MidiLike {
  name?: string;
  tracks: {
    name?: string;
    notes: { midi: number; time: number; duration: number; velocity?: number }[];
    instrument?: { name?: string; percussion?: boolean };
  }[];
}
import { clampMidiToKeyboard, midiToNoteName } from "./notes";
import type { Song, SongEvent } from "./songs";
import {
  CHORD_SIMULTANEITY_THRESHOLD_SEC,
  MELODY_CHORD_RATIO_THRESHOLD,
  MIN_IMPORTED_NOTE_DURATION_SEC,
  MAX_IMPORTED_EVENTS,
} from "./constants";

// Au-delà de ce nombre de notes, le fichier est tronqué pour éviter de
// bloquer l'UI (un morceau de piano "normal" dépasse rarement ça).
const MAX_EVENTS = MAX_IMPORTED_EVENTS;

export interface ParsedMidi {
  song: Song;
  warnings: string[];
}

export interface TrackSummary {
  index: number;
  name: string;
  noteCount: number;
  percussion: boolean;
  instrumentName: string;
  /** Tessiture de la piste, ex: "C3–E4" (aide à repérer mélodie vs basse). */
  pitchRange: string;
  /** Hauteur moyenne en numéro MIDI (plus c'est haut, plus c'est aigu). */
  avgPitch: number;
  /** Part des notes qui se chevauchent avec une autre note de la même
   * piste (accords) : proche de 0 = mélodie monophonique à 1 note à la
   * fois, proche de 1 = accompagnement en accords. */
  chordRatio: number;
  /** Heuristique : cette piste ressemble à la mélodie principale. */
  likelyMelody: boolean;
  /** Main probable (roadmap #37/#52) : "right" pour la mélodie, "left"
   * pour l'accompagnement grave, null si indéterminé. */
  handRole: "left" | "right" | null;
}

/** Lit un fichier .mid/.midi (ArrayBuffer) sans encore rien convertir :
 * on garde l'objet Midi pour laisser l'utilisateur choisir les pistes. */
export async function loadMidi(buffer: ArrayBuffer): Promise<Midi> {
  // Import dynamique : @tonejs/midi est volumineux et ne sert qu'ici,
  // il reste hors du bundle initial (chargé au premier import).
  const { Midi } = await import("@tonejs/midi");
  return new Midi(buffer);
}

/** Résume le contenu de chaque piste pour affichage dans un sélecteur,
 * avec des indices heuristiques pour distinguer mélodie et accompagnement :
 * tessiture (la mélodie est en général la plus aiguë) et taux d'accords
 * (la mélodie joue une note à la fois, l'accompagnement joue des accords). */
export function summarizeTracks(midi: MidiLike): TrackSummary[] {
  const raw: TrackSummary[] = midi.tracks.map((track, index): TrackSummary => {
    const notes = track.notes;
    let avgPitch = 0;
    let minPitch = 0;
    let maxPitch = 0;
    let chordRatio = 0;

    if (notes.length > 0) {
      const pitches = notes.map((n) => n.midi);
      minPitch = Math.min(...pitches);
      maxPitch = Math.max(...pitches);
      avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;

      // Deux notes sont considérées "simultanées" (un accord) si elles
      // démarrent à moins de CHORD_SIMULTANEITY_THRESHOLD_SEC l'une de l'autre.
      const sorted = [...notes].sort((a, b) => a.time - b.time);
      let chordNotes = 0;
      for (let i = 0; i < sorted.length; i++) {
        const prevClose =
          i > 0 && sorted[i].time - sorted[i - 1].time < CHORD_SIMULTANEITY_THRESHOLD_SEC;
        const nextClose =
          i < sorted.length - 1 &&
          sorted[i + 1].time - sorted[i].time < CHORD_SIMULTANEITY_THRESHOLD_SEC;
        if (prevClose || nextClose) chordNotes++;
      }
      chordRatio = chordNotes / sorted.length;
    }

    return {
      index,
      name: track.name?.trim() || `Piste ${index + 1}`,
      noteCount: notes.length,
      percussion: Boolean(track.instrument?.percussion),
      instrumentName: track.instrument?.name || "",
      pitchRange:
        notes.length > 0
          ? `${midiToNoteName(minPitch)}–${midiToNoteName(maxPitch)}`
          : "—",
      avgPitch,
      chordRatio,
      likelyMelody: false,
      handRole: null,
    };
  });

  // La piste "mélodie" la plus probable : parmi les pistes mélodiques
  // (non percussion, pas que des accords), celle qui est la plus aiguë.
  const candidates = raw.filter(
    (t) => t.noteCount > 0 && !t.percussion && t.chordRatio < MELODY_CHORD_RATIO_THRESHOLD
  );
  const melodyTrack = candidates.sort((a, b) => b.avgPitch - a.avgPitch)[0];
  if (melodyTrack) {
    melodyTrack.likelyMelody = true;
    melodyTrack.handRole = "right";
  }
  // Main gauche (roadmap #37) : parmi les pistes restantes non-percussion,
  // la plus grave pondérée par sa densité — l'accompagnement typique
  // (basse/accords) vit sous la mélodie.
  const leftCandidates = raw.filter(
    (t) => t.noteCount > 0 && !t.percussion && t !== melodyTrack
  );
  const leftTrack = leftCandidates.sort(
    (a, b) =>
      // score : grave et dense d'abord (pitch plus petit = plus grave)
      b.noteCount / (b.avgPitch + 1) - a.noteCount / (a.avgPitch + 1)
  )[0];
  if (leftTrack) leftTrack.handRole = "left";

  return raw;
}

/** Construit notre morceau interne à partir des pistes sélectionnées
 * (indices dans midi.tracks), jouable sur le clavier à 2 octaves affiché. */
export function buildSongFromTracks(
  midi: MidiLike,
  trackIndices: number[],
  title: string
): ParsedMidi {
  const warnings: string[] = [];
  const selected = new Set(trackIndices);

  let transposedCount = 0;
  const rawEvents: SongEvent[] = [];

  midi.tracks.forEach((track, index) => {
    if (!selected.has(index)) return;
    for (const note of track.notes) {
      const clamped = clampMidiToKeyboard(note.midi);
      if (clamped !== note.midi) transposedCount++;
      rawEvents.push({
        time: note.time,
        note: midiToNoteName(clamped),
        duration: Math.max(note.duration, MIN_IMPORTED_NOTE_DURATION_SEC),
        // Vélocité réelle de la note MIDI (0-1) : l'accompagnement joué
        // doux dans le fichier le restera à la lecture (roadmap #51).
        velocity: note.velocity,
      });
    }
  });

  rawEvents.sort((a, b) => a.time - b.time);

  let events = rawEvents;
  if (events.length > MAX_EVENTS) {
    events = events.slice(0, MAX_EVENTS);
    warnings.push(
      `Fichier tronqué aux ${MAX_EVENTS} premières notes (${rawEvents.length} au total).`
    );
  }
  if (transposedCount > 0) {
    warnings.push(
      `${transposedCount} note(s) décalée(s) d'une ou plusieurs octaves pour tenir sur le clavier (A0–C8).`
    );
  }
  if (events.length === 0) {
    throw new Error("Aucune note exploitable dans la ou les piste(s) sélectionnée(s).");
  }

  return {
    song: {
      // Anti-collision : deux imports dans la même milliseconde
      // (ex. double-clic rapide) produiraient le même id et le second
      // écraserait le premier dans le sélecteur.
      id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: midi.name?.trim() || title,
      events,
      source: "imported",
    },
    warnings,
  };
}
