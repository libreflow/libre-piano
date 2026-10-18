import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCallResponse, splitPhrases, PHRASE_LENGTH } from "./useCallResponse";
import type { Song } from "./songs";

const song: Song = {
  id: "s",
  title: "S",
  source: "builtin",
  events: Array.from({ length: 12 }, (_, i) => ({
    time: i * 0.5,
    note: ["C4", "D4", "E4", "F4", "G4", "A4"][i % 6],
    duration: 0.3,
  })),
};

describe("splitPhrases (roadmap #43)", () => {
  it("découpe en phrases de 6 notes", () => {
    const phrases = splitPhrases(song.events);
    expect(phrases).toHaveLength(2);
    expect(phrases[0].events).toHaveLength(PHRASE_LENGTH);
    expect(phrases[1].events).toHaveLength(6);
  });

  it("le dernier morceau peut être plus court", () => {
    const short: Song = {
      ...song,
      events: song.events.slice(0, 8),
    };
    const phrases = splitPhrases(short.events);
    expect(phrases).toHaveLength(2);
    expect(phrases[1].events).toHaveLength(2);
  });

  it("un morceau vide donne aucune phrase", () => {
    expect(splitPhrases([])).toEqual([]);
  });
});

describe("useCallResponse (roadmap #43)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("start refuse un morceau vide et reste idle", () => {
    const { result } = renderHook(() => useCallResponse(undefined, vi.fn()));
    act(() => result.current.start());
    expect(result.current.state.active).toBe(false);
  });

  it("phase call puis réponse : les bonnes notes avancent", async () => {
    const demo = vi.fn();
    const { result } = renderHook(() => useCallResponse(song, demo));
    act(() => result.current.start());
    expect(result.current.state.active).toBe(true);
    expect(result.current.state.phase).toBe("call");
    // jouer la première phrase
    act(() => result.current.playPhrase(0));
    // laisser les timers jouer la démo (notes à 0.5 s d'intervalle)
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.state.phase).toBe("response");
    expect(result.current.state.expected).toEqual(["C4", "D4", "E4", "F4", "G4", "A4"]);
    // bonnes notes
    act(() => result.current.handlePlayedNote("C4"));
    act(() => result.current.handlePlayedNote("D4"));
    expect(result.current.state.responseStep).toBe(2);
    act(() => result.current.handlePlayedNote("E4"));
    act(() => result.current.handlePlayedNote("F4"));
    act(() => result.current.handlePlayedNote("G4"));
    act(() => result.current.handlePlayedNote("A4"));
    // phrase complète -> phrase suivante programmée
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current.state.mistakes).toBe(0);
    act(() => result.current.stop());
  });

  it("une faute est comptée sans avancer", () => {
    const { result } = renderHook(() => useCallResponse(song, vi.fn()));
    act(() => result.current.start());
    act(() => result.current.playPhrase(0));
    // Forcer la phase réponse sans timers :
    act(() => {
      result.current.handlePlayedNote("Z9"); // hors phase réponse : ignoré
    });
    expect(result.current.state.mistakes).toBe(0);
    act(() => result.current.stop());
  });

  it("stop réinitialise tout", () => {
    const { result } = renderHook(() => useCallResponse(song, vi.fn()));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.phase).toBe("idle");
  });
});
