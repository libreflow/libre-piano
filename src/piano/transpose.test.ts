import { describe, expect, it } from "vitest";
import { clampTranspose, transposedSong, transposeSongEvents } from "./transpose";
import type { Song, SongEvent } from "./songs";

const events: SongEvent[] = [
  { time: 0, note: "C4", duration: 0.5 },
  { time: 1, note: "A4", duration: 0.5 },
];

describe("transpose (roadmap #53)", () => {
  it("décale les notes du nombre de demi-tons demandé", () => {
    const out = transposeSongEvents(events, 2);
    expect(out[0].note).toBe("D4");
    expect(out[1].note).toBe("B4");
  });

  it("décale vers le grave", () => {
    const out = transposeSongEvents(events, -1);
    expect(out[0].note).toBe("B3");
  });

  it("shift 0 retourne les événements inchangés (même référence)", () => {
    expect(transposeSongEvents(events, 0)).toBe(events);
  });

  it("les notes hors clavier restent en place plutôt que de disparaître", () => {
    const low: SongEvent[] = [{ time: 0, note: "A0", duration: 1 }];
    expect(transposeSongEvents(low, -1)[0].note).toBe("A0");
    const high: SongEvent[] = [{ time: 0, note: "C8", duration: 1 }];
    expect(transposeSongEvents(high, 1)[0].note).toBe("C8");
  });

  it("clampTranspose borne et arrondit", () => {
    expect(clampTranspose(99)).toBe(11);
    expect(clampTranspose(-99)).toBe(-11);
    expect(clampTranspose(NaN)).toBe(0);
    expect(clampTranspose(3.7)).toBe(4);
  });

  it("transposedSong préserve le reste du morceau", () => {
    const song: Song = { id: "s", title: "S", events, source: "builtin" };
    const out = transposedSong(song, 11);
    expect(out.id).toBe("s");
    expect(out.events[0].note).toBe("B4");
    expect(song.events[0].note).toBe("C4");
  });
});
