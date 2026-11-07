// Pluie de notes (hors-piste « Synthesia ») : géométrie pure alignée
// sur les touches, et fenêtre de visibilité des événements.

import { describe, expect, it } from "vitest";
import { noteLane, visibleRainEvents, rainCanvasWidth } from "./note-rain";
import type { SongEvent } from "./songs";

describe("noteLane", () => {
  it("une blanche couvre exactement sa largeur de touche", () => {
    // A0 blanche 0 ; C4 est la 24e blanche (index 23) : A0 B0 C1..B3 = 23.
    const lane = noteLane("C4", 60);
    expect(lane).toEqual({ x: 23 * 60, width: 60 });
  });

  it("une noire est plus étroite, chevauchant la frontière des blanches", () => {
    // C#4 suit C4 (index de blanche 23) : bord gauche à 23.69 clés,
    // comme .key.black { left: calc((index + 1) * keyW - 0.31 * keyW) }.
    const lane = noteLane("C#4", 60);
    const expectedLeft = (23 + 0.69) * 60;
    expect(lane?.width).toBeCloseTo(60 * 0.62, 5);
    expect(lane?.x).toBeCloseTo(expectedLeft, 3);
  });

  it("retourne null pour une note inconnue", () => {
    expect(noteLane("Z9", 60)).toBeNull();
  });
});

describe("rainCanvasWidth", () => {
  it("couvre le rang des 52 blanches", () => {
    // A0..C8 : 52 touches blanches.
    expect(rainCanvasWidth(60)).toBeCloseTo(52 * 60, 0);
  });
});

describe("visibleRainEvents", () => {
  const ev = (time: number, duration = 0.5): SongEvent => ({
    time,
    note: "C4",
    duration,
  });

  it("montre les notes qui arrivent et celles qui sonnent", () => {
    const events = [ev(0), ev(1), ev(2), ev(5), ev(10)];
    const now = 2;
    const got = visibleRainEvents(events, now).map((r) => r.event.time);
    // 1 s sonnante (fin à 1.5 passée), 2 s courant, 5 s à venir.
    expect(got).toContain(2);
    expect(got).toContain(5);
    expect(got).not.toContain(10);
  });

  it("ignore les notes trop loin dans le futur", () => {
    const events = [ev(30)];
    expect(visibleRainEvents(events, 0)).toHaveLength(0);
  });

  it("garde une trace des notes juste jouées (queue)", () => {
    // 0.2 s de queue : la note finie à -0.1 est encore un peu visible.
    const events = [ev(0, 1)];
    // now=1.1 : la note s'est éteinte à 1, queue 0.25 -> visible.
    const got = visibleRainEvents(events, 1.1);
    expect(got.map((r) => r.startDelta)).toContain(-1.1);
  });
});
