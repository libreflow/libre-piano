// Horloge de lecture partagée (timecode + pluie de notes) : la position
// doit être IDENTIQUE partout, boucle A-B comprise.

import { describe, expect, it } from "vitest";
import {
  playbackSeconds,
  playbackSection,
  resolvePlaybackSection,
} from "./playback-clock";

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

describe("resolvePlaybackSection (audit : bornes partagées lecture/affichage)", () => {
  it("bornes croisées : échangées comme joué (start 5 / end 3 -> section 3-5)", () => {
    expect(resolvePlaybackSection({ enabled: true, start: 5, end: 3 }, 60)).toEqual({
      start: 3,
      end: 5,
    });
  });

  it("bornes jamais réglées : morceau entier", () => {
    expect(resolvePlaybackSection({ enabled: true, start: 0, end: 0 }, 60)).toEqual({
      start: 0,
      end: 60,
    });
  });

  it("micro-section (< 0.1 s) : élargie au minimum, plafonnée au morceau", () => {
    // 42 -> 42.1 : la boucle joue au moins 0.1 s (cycle vide interdit).
    expect(resolvePlaybackSection({ enabled: true, start: 42, end: 42.001 }, 60)).toEqual(
      {
        start: 42,
        end: 42.1,
      }
    );
    // Bornes collées à la fin du morceau : le plafond l'emporte, on
    // retombe sur le morceau entier plutôt qu'une section vide.
    expect(resolvePlaybackSection({ enabled: true, start: 60, end: 60 }, 60)).toEqual({
      start: 0,
      end: 60,
    });
  });

  it("bornes au-delà de la durée : clampées", () => {
    expect(resolvePlaybackSection({ enabled: true, start: 50, end: 80 }, 60)).toEqual({
      start: 50,
      end: 60,
    });
  });

  it("hors boucle : morceau entier", () => {
    expect(resolvePlaybackSection({ enabled: false, start: 10, end: 20 }, 60)).toEqual({
      start: 0,
      end: 60,
    });
  });

  it("playbackSeconds suit la même résolution que la lecture (micro-boucle)", () => {
    // Boucle 42-42.1 : le timecode doit cycler dedans, pas sur 42-60.
    const loop = { enabled: true, start: 42, end: 42.001 };
    expect(playbackSeconds(0, 100, loop, 60)).toBe(42);
    expect(playbackSeconds(0.05, 100, loop, 60)).toBeCloseTo(42.05);
    expect(playbackSeconds(0.15, 100, loop, 60)).toBeCloseTo(42.05, 5);
  });

  it("playbackSeconds cycle sur les bornes croisées échangées", () => {
    const loop = { enabled: true, start: 5, end: 3 };
    // Section jouée : 3-5. t=1.5 -> 4.5 ; t=2.5 -> repli à 3+0.5=3.5.
    expect(playbackSeconds(1.5, 100, loop, 60)).toBe(4.5);
    expect(playbackSeconds(2.5, 100, loop, 60)).toBe(3.5);
  });
});
