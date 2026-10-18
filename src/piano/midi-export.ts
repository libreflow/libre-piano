// Export MIDI (roadmap #46) : écrit un morceau (Song interne) dans un
// fichier .mid téléchargeable, via le writer de @tonejs/midi (import
// dynamique : la bibliothèque ne rejoint pas le bundle initial).
// BPM de référence : celui des morceaux de démo, les temps internes
// étant en secondes absolues.

import type { Song } from "./songs";
import { noteNameToMidi } from "./notes";
import { REFERENCE_BPM } from "./constants";

/** Génère les octets MIDI d'un morceau. */
export async function songToMidiBytes(song: Song): Promise<Uint8Array> {
  const { Midi } = await import("@tonejs/midi");
  const midi = new Midi();
  midi.header.setTempo(REFERENCE_BPM);
  const track = midi.addTrack();
  track.name = song.title;
  for (const ev of song.events) {
    const midiNote = noteNameToMidi(ev.note);
    if (midiNote === null) continue;
    track.addNote({
      midi: midiNote,
      time: ev.time,
      duration: ev.duration,
      velocity: ev.velocity ?? 0.8,
    });
  }
  return midi.toArray();
}

/** Télécharge le morceau en .mid (nom de fichier dérivé du titre). */
export async function downloadSongAsMidi(song: Song): Promise<boolean> {
  try {
    const bytes = await songToMidiBytes(song);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.title.replace(/[\\/:*?"<>|]/g, "_")}.mid`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
