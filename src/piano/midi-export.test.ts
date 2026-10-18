import { describe, expect, it } from "vitest";
import { songToMidiBytes } from "./midi-export";
import { Midi } from "@tonejs/midi";
import type { Song } from "./songs";

const song: Song = {
  id: "s",
  title: "Test",
  source: "builtin",
  events: [
    { time: 0, note: "C4", duration: 0.5, velocity: 0.6 },
    { time: 1, note: "E4", duration: 0.5 },
    { time: 2, note: "G4", duration: 0.5 },
  ],
};

describe("midi-export (roadmap #46)", () => {
  it("produit un fichier MIDI relisible avec les mêmes notes", async () => {
    const bytes = await songToMidiBytes(song);
    expect(bytes.length).toBeGreaterThan(50);
    const reread = new Midi(bytes.buffer as ArrayBuffer);
    expect(reread.tracks).toHaveLength(1);
    const notes = reread.tracks[0].notes;
    expect(notes).toHaveLength(3);
    expect(notes[0].midi).toBe(60);
    expect(notes[1].midi).toBe(64);
    expect(notes[2].midi).toBe(67);
    // Durées arrondies aux ticks : approximativement conservées.
    expect(notes[0].duration).toBeGreaterThan(0.4);
    expect(notes[0].duration).toBeLessThan(0.6);
    // Vélocité capturée.
    expect(notes[0].velocity).toBeGreaterThan(0.5);
    expect(notes[0].velocity).toBeLessThan(0.7);
  });

  it("ignore les notes au nom invalide sans planter", async () => {
    const weird: Song = {
      ...song,
      events: [{ time: 0, note: "X#9", duration: 0.5 } as never],
    };
    const bytes = await songToMidiBytes(weird);
    const reread = new Midi(bytes.buffer as ArrayBuffer);
    expect(reread.tracks[0].notes).toHaveLength(0);
  });
});
