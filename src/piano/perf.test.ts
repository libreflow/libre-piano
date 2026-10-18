// Tests de performance (roadmap #74) : gros fichiers MIDI (>5000 notes).
// Garde-fous de temps d'exécution : si une régression algorithmique
// apparaît (complexité accidentelle), le test échoue.

import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { buildSongFromTracks, summarizeTracks } from "./midi-import";
import { MAX_IMPORTED_EVENTS } from "./constants";
import { liveNodeCount, trackNodeCreate, trackNodeDispose } from "./audio-health";

function buildBigMidi(trackCount: number, notesPerTrack: number): Midi {
  const midi = new Midi();
  for (let t = 0; t < trackCount; t++) {
    const track = midi.addTrack();
    track.name = `Piste ${t + 1}`;
    for (let i = 0; i < notesPerTrack; i++) {
      track.addNote({
        midi: 48 + ((i * 7) % 36),
        time: (i % 500) * 0.25,
        duration: 0.2,
        velocity: 0.3 + (i % 5) * 0.1,
      });
    }
  }
  return midi;
}

describe("performance : gros fichiers MIDI (roadmap #74)", () => {
  it("summarizeTracks traite 6000 notes en moins de 2 s", () => {
    const midi = buildBigMidi(4, 1500); // 6000 notes
    const start = performance.now();
    const summaries = summarizeTracks(midi);
    const elapsed = performance.now() - start;
    expect(summaries).toHaveLength(4);
    expect(summaries[0].noteCount).toBe(1500);
    // Garde-fou large : le poste de CI est lent, mais une complexité
    // accidentelle (O(n²) par exemple) exploserait bien au-delà.
    expect(elapsed).toBeLessThan(2000);
  });

  it("buildSongFromTracks tronque à MAX_IMPORTED_EVENTS sans exploser", () => {
    const midi = buildBigMidi(2, 4000); // 8000 notes
    const start = performance.now();
    const { song, warnings } = buildSongFromTracks(midi, [0, 1], "Big");
    const elapsed = performance.now() - start;
    expect(song.events).toHaveLength(MAX_IMPORTED_EVENTS);
    expect(warnings.some((w) => w.includes("tronqué"))).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("dispose des nœuds audio (roadmap #77)", () => {
  it("le compteur de nœuds vivants retombe après dispose symétrique", () => {
    const before = liveNodeCount();
    trackNodeCreate();
    trackNodeCreate();
    expect(liveNodeCount()).toBe(before + 2);
    trackNodeDispose();
    trackNodeDispose();
    expect(liveNodeCount()).toBe(before);
  });

  it("le compteur ne descend jamais sous zéro (dispose en trop ignoré)", () => {
    trackNodeDispose();
    expect(liveNodeCount()).toBeGreaterThanOrEqual(0);
  });
});
