// Test direct de la logique d'import MIDI par piste, hors UI (Node, ESM).
// Reproduit summarizeTracks() + buildSongFromTracks() de src/piano/midi-import.ts
import { readFileSync } from "node:fs";
import pkg from "@tonejs/midi";
const { Midi } = pkg;

const MIN_MIDI = 48; // C3
const MAX_MIDI = 72; // C5
const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = SHARP_NAMES[((midi % 12) + 12) % 12];
  return `${name}${octave}`;
}
function clampMidiToKeyboard(midi) {
  let m = midi;
  while (m < MIN_MIDI) m += 12;
  while (m > MAX_MIDI) m -= 12;
  return m;
}
function summarizeTracks(midi) {
  const raw = midi.tracks.map((track, index) => {
    const notes = track.notes;
    let avgPitch = 0, minPitch = 0, maxPitch = 0, chordRatio = 0;
    if (notes.length > 0) {
      const pitches = notes.map((n) => n.midi);
      minPitch = Math.min(...pitches);
      maxPitch = Math.max(...pitches);
      avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
      const sorted = [...notes].sort((a, b) => a.time - b.time);
      let chordNotes = 0;
      for (let i = 0; i < sorted.length; i++) {
        const prevClose = i > 0 && sorted[i].time - sorted[i - 1].time < 0.03;
        const nextClose = i < sorted.length - 1 && sorted[i + 1].time - sorted[i].time < 0.03;
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
      pitchRange: notes.length > 0 ? `${midiToNoteName(minPitch)}–${midiToNoteName(maxPitch)}` : "—",
      avgPitch,
      chordRatio,
      likelyMelody: false,
    };
  });
  const candidates = raw.filter((t) => t.noteCount > 0 && !t.percussion && t.chordRatio < 0.5);
  const melodyTrack = candidates.sort((a, b) => b.avgPitch - a.avgPitch)[0];
  if (melodyTrack) melodyTrack.likelyMelody = true;
  return raw;
}
function buildSongFromTracks(midi, trackIndices, title) {
  const warnings = [];
  const selected = new Set(trackIndices);
  let transposedCount = 0;
  const rawEvents = [];
  midi.tracks.forEach((track, index) => {
    if (!selected.has(index)) return;
    for (const note of track.notes) {
      const clamped = clampMidiToKeyboard(note.midi);
      if (clamped !== note.midi) transposedCount++;
      rawEvents.push({ time: note.time, note: midiToNoteName(clamped), duration: Math.max(note.duration, 0.05) });
    }
  });
  rawEvents.sort((a, b) => a.time - b.time);
  if (transposedCount > 0) warnings.push(`${transposedCount} note(s) transposée(s)`);
  return { song: { title, events: rawEvents }, warnings };
}

const path = process.argv[2];
const buffer = readFileSync(path);
const midi = new Midi(buffer);

const tracks = summarizeTracks(midi).filter((t) => t.noteCount > 0);
console.log("Pistes disponibles :");
for (const t of tracks) {
  console.log(`  [${t.index}] ${t.name} — ${t.noteCount} notes · tessiture ${t.pitchRange} · ${t.chordRatio > 0.3 ? "accords" : "monophonique"}${t.likelyMelody ? " ⭐ probable mélodie" : ""}${t.percussion ? " (percussion)" : ""}${t.instrumentName ? " · " + t.instrumentName : ""}`);
}

// Simule la sélection par défaut de l'UI : toutes les pistes non-percussion.
const defaultSelection = tracks.filter((t) => !t.percussion);
const toSelect = (defaultSelection.length > 0 ? defaultSelection : tracks).map((t) => t.index);
console.log("\nSélection par défaut (indices) :", toSelect);

const { song, warnings } = buildSongFromTracks(midi, toSelect, "test");
console.log("Notes importées :", song.events.length);
console.log("Avertissements :", warnings.join(" ") || "(aucun)");

// Test : importer UNE seule piste (la première) pour vérifier le filtrage.
if (tracks.length > 1) {
  const single = buildSongFromTracks(midi, [tracks[0].index], "test-single-track");
  console.log(`\nImport piste unique [${tracks[0].index}] seule :`, single.song.events.length, "notes");
}
