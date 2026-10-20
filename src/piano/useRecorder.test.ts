import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecorder, recordedSongTitle } from "./useRecorder";

vi.mock("./tone-gate", () => ({
  getContext: () => ({ now: () => fakeNow }),
}));

let fakeNow = 0;

describe("useRecorder (roadmap #46)", () => {
  it("ne capture rien hors enregistrement", () => {
    const { result } = renderHook(() => useRecorder());
    act(() => {
      result.current.captureNoteOn("C4");
      result.current.captureNoteOff("C4");
    });
    act(() => {
      const song = result.current.stop();
      expect(song).toBeNull();
    });
  });

  it("capture une note avec durée réelle et produit un morceau", () => {
    fakeNow = 10;
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.start());
    fakeNow = 11;
    act(() => result.current.captureNoteOn("C4", 0.6));
    fakeNow = 12.5;
    act(() => result.current.captureNoteOff("C4"));
    fakeNow = 13;
    let song: unknown = null;
    act(() => {
      song = result.current.stop();
    });
    const s = song as {
      events: { note: string; time: number; duration: number; velocity?: number }[];
      source: string;
    } | null;
    expect(s).not.toBeNull();
    expect(s!.events).toHaveLength(1);
    expect(s!.events[0].note).toBe("C4");
    // temps relatif au start : 1 s, durée 1.5 s
    expect(s!.events[0].time).toBeCloseTo(1);
    expect(s!.events[0].duration).toBeCloseTo(1.5);
    expect(s!.events[0].velocity).toBeCloseTo(0.6);
    expect(s!.source).toBe("imported");
  });

  it("ferme les notes ouvertes à l'arrêt avec durée plafonnée", () => {
    fakeNow = 0;
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.start());
    fakeNow = 1;
    act(() => result.current.captureNoteOn("E4"));
    fakeNow = 100; // très longtemps après : plafond 12 s
    let song: unknown = null;
    act(() => {
      song = result.current.stop();
    });
    const s = song as { events: { duration: number }[] };
    expect(s!.events[0].duration).toBeCloseTo(12);
  });

  it("plusieurs notes triées par temps", () => {
    fakeNow = 0;
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.start());
    fakeNow = 2;
    act(() => result.current.captureNoteOn("G4"));
    fakeNow = 3;
    act(() => result.current.captureNoteOff("G4"));
    fakeNow = 1;
    act(() => result.current.captureNoteOn("C4"));
    fakeNow = 2;
    act(() => result.current.captureNoteOff("C4"));
    let song: unknown = null;
    act(() => {
      song = result.current.stop();
    });
    const s = song as { events: { note: string }[] };
    expect(s!.events.map((e) => e.note)).toEqual(["C4", "G4"]);
  });

  it("recommencer un enregistrement repart de zéro", () => {
    fakeNow = 0;
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.start());
    act(() => result.current.captureNoteOn("C4"));
    act(() => result.current.captureNoteOff("C4"));
    act(() => result.current.stop());
    act(() => result.current.start());
    let song: unknown = null;
    act(() => {
      song = result.current.stop();
    });
    expect(song).toBeNull();
  });
});

describe("recordedSongTitle", () => {
  it("produit un titre horodaté unique", () => {
    const t1 = recordedSongTitle();
    expect(t1).toMatch(/^Enregistrement \d{4}-\d{2}-\d{2} \d{2}h\d{2}$/);
  });
});

describe("bug M1 : durée des notes tenues à l'arrêt (temps relatif)", () => {
  it("une note tenue jusqu'au stop a la durée réelle écoulée, pas un plafond artificiel", () => {
    fakeNow = 0;
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.start());
    fakeNow = 5;
    act(() => result.current.captureNoteOn("C4"));
    fakeNow = 7.5;
    let song: unknown = null;
    act(() => {
      song = result.current.stop();
    });
    const s = song as { events: { note: string; time: number; duration: number }[] } | null;
    expect(s).not.toBeNull();
    expect(s!.events).toHaveLength(1);
    expect(s!.events[0].time).toBeCloseTo(5);
    // durée = elapsed (7.5) - time relatif (5) = 2.5 s
    expect(s!.events[0].duration).toBeCloseTo(2.5);
  });
});
