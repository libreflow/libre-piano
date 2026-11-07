// Horloge de lecture partagée (timecode + pluie de notes) : la position
// doit être IDENTIQUE partout, boucle A-B comprise.

import { describe, expect, it } from "vitest";
import { playbackSeconds, playbackSection } from "./playback-clock";

const full = { enabled: false, start: 0, end: 0 };
const ab = { enabled: true, start: 10, end: 20 };

describe("playbackSeconds", () => {
  it("retourne le temps x1 hors boucle (vitesse 50% = temps doublé)", () => {
    // Transport tourne deux fois plus vite en 50% : 6 s réelles = 3 s morceau.
    expect(playbackSeconds(6, 50, full, 30)).toBe(3);
    expect(playbackSeconds(6, 100, full, 30)).toBe(6);
  });

  it("défile DANS la section en boucle A-B et CYCLE à chaque tour", () => {
    // Transport avance indéfiniment (Tone rejoue le Part en boucle) :
    // la position doit replier dans [10, 20], pas rester plafonnée à 20.
    expect(playbackSeconds(0, 100, ab, 60)).toBe(10);
    expect(playbackSeconds(5, 100, ab, 60)).toBe(15);
    expect(playbackSeconds(9.5, 100, ab, 60)).toBe(19.5);
    // Frontière exacte (t = sectionLength) : repli au début de section.
    expect(playbackSeconds(10, 100, ab, 60)).toBe(10);
    // Tour bouclé : 12 s de transport = 10 s de section + repli de 2 s.
    expect(playbackSeconds(12, 100, ab, 60)).toBe(12);
    expect(playbackSeconds(22, 100, ab, 60)).toBe(12);
  });

  it("borne la position à la durée du morceau", () => {
    expect(playbackSeconds(999, 100, full, 30)).toBe(30);
  });
});

describe("playbackSection", () => {
  it("section A-B clampée à la durée", () => {
    expect(playbackSection(ab, 60)).toEqual({ start: 10, end: 20 });
    expect(playbackSection({ enabled: true, start: 50, end: 80 }, 60)).toEqual({
      start: 50,
      end: 60,
    });
    expect(playbackSection(full, 60)).toEqual({ start: 0, end: 60 });
  });
});
