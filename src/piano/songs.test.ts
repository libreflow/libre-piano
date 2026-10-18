import { describe, expect, it } from "vitest";
import { BUILTIN_SONGS, songDuration } from "./songs";

describe("BUILTIN_SONGS", () => {
  it("a au moins un morceau jouable", () => {
    expect(BUILTIN_SONGS.length).toBeGreaterThan(0);
    for (const song of BUILTIN_SONGS) {
      expect(song.events.length).toBeGreaterThan(0);
      expect(song.id).toBeTruthy();
      expect(song.title).toBeTruthy();
    }
  });

  it("a des événements cohérents (durée > 0, temps croissant ou triables)", () => {
    for (const song of BUILTIN_SONGS) {
      for (const e of song.events) {
        expect(e.duration).toBeGreaterThan(0);
        expect(e.time).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("songDuration", () => {
  it("retourne le temps de fin du dernier événement", () => {
    expect(
      songDuration({
        id: "t",
        title: "T",
        events: [
          { time: 0, note: "C4", duration: 0.5 },
          { time: 1, note: "E4", duration: 2 },
        ],
        source: "builtin",
      })
    ).toBe(3);
  });

  it("retourne 0 pour un morceau vide", () => {
    expect(songDuration({ id: "t", title: "T", events: [], source: "builtin" })).toBe(0);
  });
});

describe("roadmap #55 : bibliothèque de presets élargie", () => {
  it("contient au moins 8 morceaux intégrés avec ids uniques", () => {
    expect(BUILTIN_SONGS.length).toBeGreaterThanOrEqual(8);
    const ids = new Set(BUILTIN_SONGS.map((s) => s.id));
    expect(ids.size).toBe(BUILTIN_SONGS.length);
  });

  it("les presets ont des événements valides (notes sur le clavier)", () => {
    for (const song of BUILTIN_SONGS) {
      expect(song.events.length).toBeGreaterThan(0);
      for (const ev of song.events) {
        expect(ev.duration).toBeGreaterThan(0);
        expect(ev.note).toMatch(/^[A-G]#?\d$/);
      }
    }
  });
});
