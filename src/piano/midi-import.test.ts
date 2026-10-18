import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { buildSongFromTracks, summarizeTracks } from "./midi-import";
import { MAX_IMPORTED_EVENTS, MIN_IMPORTED_NOTE_DURATION_SEC } from "./constants";

// Construit un ArrayBuffer MIDI minimal à 2 pistes.
function buildTestMidi(): ArrayBuffer {
  const midi = new Midi();
  const melody = midi.addTrack();
  melody.name = "Melody";
  for (let i = 0; i < 8; i++) {
    melody.addNote({ midi: 72 + (i % 3), time: i * 0.5, duration: 0.4 });
  }
  const chords = midi.addTrack();
  chords.name = "Chords";
  for (let i = 0; i < 4; i++) {
    [48, 52, 55].forEach((p, j) => {
      chords.addNote({ midi: p, time: i * 1 + j * 0.001, duration: 0.9 });
    });
  }
  return midi.toArray().slice().buffer;
}

describe("summarizeTracks", () => {
  it("résume les pistes et détecte la mélodie la plus probable", () => {
    const midi = new Midi(buildTestMidi());
    const tracks = summarizeTracks(midi);
    expect(tracks).toHaveLength(2);
    const melody = tracks.find((t) => t.name === "Melody")!;
    const chords = tracks.find((t) => t.name === "Chords")!;
    expect(melody.noteCount).toBe(8);
    expect(chords.noteCount).toBe(12);
    expect(chords.chordRatio).toBeGreaterThan(0.5);
    expect(melody.chordRatio).toBeLessThan(0.5);
    expect(melody.likelyMelody).toBe(true);
    expect(chords.likelyMelody).toBe(false);
    expect(chords.pitchRange.startsWith("C3")).toBe(true);
  });

  it("gère un MIDI sans notes", () => {
    const empty = new Midi();
    empty.addTrack().name = "Empty";
    const tracks = summarizeTracks(new Midi(empty.toArray().slice().buffer));
    expect(tracks.length).toBeGreaterThanOrEqual(0);
    for (const t of tracks) {
      expect(t.noteCount).toBe(0);
      expect(t.pitchRange).toBe("—");
      expect(t.likelyMelody).toBe(false);
    }
  });
});

describe("buildSongFromTracks", () => {
  it("construit un morceau trié sans transposition (plage 88 touches)", () => {
    const midi = new Midi(buildTestMidi());
    const { song, warnings } = buildSongFromTracks(midi, [0, 1], "Test");
    expect(song.source).toBe("imported");
    expect(song.events.length).toBe(20);
    const times = song.events.map((e) => e.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // Mélodie (72-74) et accords (48-55) tiennent dans A0-C8 : aucune
    // note n'est décalée, l'avertissement de transposition est absent.
    expect(warnings.some((w) => w.includes("décalée"))).toBe(false);
  });

  it("transpose encore les notes hors de la plage A0-C8", () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.addNote({ midi: 126, time: 0, duration: 0.5 }); // F#9 : au-dessus de C8
    const buffer = midi.toArray().slice().buffer;
    const { song, warnings } = buildSongFromTracks(new Midi(buffer), [0], "X");
    expect(song.events[0].note).toBe("F#7"); // redescendu de 2 octaves (F#8 dépasserait C8)
    expect(warnings.some((w) => w.includes("décalée"))).toBe(true);
  });

  it("applique la durée minimale aux notes trop courtes", () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.addNote({ midi: 60, time: 0, duration: 0.001 });
    const buffer = midi.toArray().slice().buffer;
    const { song } = buildSongFromTracks(new Midi(buffer), [0], "T");
    expect(song.events[0].duration).toBeCloseTo(MIN_IMPORTED_NOTE_DURATION_SEC);
  });

  it("tronque au-delà de MAX_IMPORTED_EVENTS", () => {
    const midi = new Midi();
    const track = midi.addTrack();
    for (let i = 0; i < MAX_IMPORTED_EVENTS + 100; i++) {
      track.addNote({ midi: 60, time: i * 0.1, duration: 0.05 });
    }
    const buffer = midi.toArray().slice().buffer;
    const { song, warnings } = buildSongFromTracks(new Midi(buffer), [0], "Big");
    expect(song.events.length).toBe(MAX_IMPORTED_EVENTS);
    expect(warnings.some((w) => w.includes("tronqué"))).toBe(true);
  });

  it("rejette une sélection sans notes", () => {
    const midi = new Midi(buildTestMidi());
    expect(() => buildSongFromTracks(midi, [], "X")).toThrow();
  });
});

describe("roadmap #51 : vélocité des notes importées", () => {
  it("conserve la vélocité de chaque note MIDI", () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.3 });
    track.addNote({ midi: 64, time: 1, duration: 0.5, velocity: 0.9 });
    const buffer = midi.toArray().slice().buffer;
    const { song } = buildSongFromTracks(new Midi(buffer), [0], "V");
    expect(song.events[0].velocity).toBeCloseTo(0.3);
    expect(song.events[1].velocity).toBeCloseTo(0.9);
  });
});
