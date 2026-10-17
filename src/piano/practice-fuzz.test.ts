import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePractice } from "./usePractice";
import type { Song } from "./songs";

// Fuzzing du mode apprentissage : séquences aléatoires d'actions
// (notes justes/fausses, start/stop, changements de morceau, notes
// inexistantes) pour vérifier qu'aucune combinaison ne crashe ni ne
// produit un état invalide.

// PRNG déterministe pour reproductibilité
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "X9", ""];

const songs: (Song | undefined)[] = [
  {
    id: "a",
    title: "A",
    source: "builtin",
    events: [
      { time: 0, note: "C4", duration: 0.5 },
      { time: 1, note: "E4", duration: 0.5 },
      { time: 2, note: "G4", duration: 0.5 },
    ],
  },
  {
    id: "b",
    title: "B",
    source: "builtin",
    events: [{ time: 0, note: "A4", duration: 1 }],
  },
  // morceau dégénéré : événements avec notes hors clavier / dupliqués
  {
    id: "c",
    title: "C",
    source: "builtin",
    events: [
      { time: 0, note: "C9", duration: 0.5 }, // hors clavier 88
      { time: 0.5, note: "C4", duration: 0.5 },
      { time: 0.5, note: "C4", duration: 0.5 }, // doublon même temps
    ],
  },
  undefined, // morceau supprimé
];

function invariants(state: ReturnType<typeof usePractice>["state"], eventsLen: number) {
  // invariants structurels quel que soit le scénario
  expect(typeof state.active).toBe("boolean");
  expect(Number.isInteger(state.step)).toBe(true);
  expect(state.step).toBeGreaterThanOrEqual(0);
  expect(state.mistakes).toBeGreaterThanOrEqual(0);
  if (state.active && !state.done) {
    expect(state.expectedNote === null || typeof state.expectedNote).toBe("string");
    if (state.expectedNote !== null) {
      expect(state.step).toBeLessThan(Math.max(1, eventsLen));
    }
  }
  if (state.done) {
    expect(state.active).toBe(true); // done implique session vivante
  }
}

describe("fuzz : mode apprentissage", () => {
  it("300 séquences aléatoires ne crashent pas et respectent les invariants", () => {
    const rand = mulberry32(42);
    for (let iter = 0; iter < 300; iter++) {
      let songIdx = Math.floor(rand() * songs.length);
      const { result, rerender } = renderHook(
        ({ song }: { song: Song | undefined }) => usePractice(song, vi.fn()),
        { initialProps: { song: songs[songIdx] } }
      );
      const actions = 1 + Math.floor(rand() * 15);
      try {
        for (let a = 0; a < actions; a++) {
          const op = rand();
          const current = result.current.state;
          const eventsLen = songs[songIdx]?.events.length ?? 0;
          invariants(current, eventsLen);
          if (op < 0.25) {
            act(() => result.current.start());
          } else if (op < 0.35) {
            act(() => result.current.stop());
          } else if (op < 0.45) {
            // changement de morceau (ou suppression)
            songIdx = Math.floor(rand() * songs.length);
            act(() => {
              rerender({ song: songs[songIdx] });
            });
          } else if (op < 0.9 && current.active && !current.done) {
            // jouer une note : parfois la bonne (pour avancer), souvent autre
            const rightNote = current.expectedNote;
            const pick =
              rightNote !== null && rand() < 0.5
                ? rightNote
                : notes[Math.floor(rand() * notes.length)];
            act(() => result.current.handlePlayedNote(pick));
          } else {
            // notes jouées hors session / après done
            act(() =>
              result.current.handlePlayedNote(notes[Math.floor(rand() * notes.length)])
            );
          }
        }
        invariants(result.current.state, songs[songIdx]?.events.length ?? 0);
      } finally {
        // le test échouera si un act() throw ; le finally assure le diagnostic
      }
    }
  });
});
