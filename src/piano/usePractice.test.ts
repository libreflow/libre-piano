import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePractice } from "./usePractice";
import type { Song } from "./songs";

const song: Song = {
  id: "t",
  title: "T",
  source: "builtin",
  events: [
    { time: 0, note: "C4", duration: 0.5 },
    { time: 1, note: "E4", duration: 0.5 },
    { time: 2, note: "G4", duration: 0.5 },
  ],
};

describe("usePractice", () => {
  it("reste inactif avant start", () => {
    const { result } = renderHook(() => usePractice(song, vi.fn()));
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.expectedNote).toBeNull();
  });

  it("attend la première note au démarrage", () => {
    const { result } = renderHook(() => usePractice(song, vi.fn()));
    act(() => result.current.start());
    expect(result.current.state.active).toBe(true);
    expect(result.current.state.expectedNote).toBe("C4");
    expect(result.current.state.step).toBe(0);
  });

  it("avance sur la bonne note, compte les fautes sinon", () => {
    const { result } = renderHook(() => usePractice(song, vi.fn()));
    act(() => result.current.start());

    act(() => result.current.handlePlayedNote("E4")); // mauvaise
    expect(result.current.state.mistakes).toBe(1);
    expect(result.current.state.step).toBe(0);

    act(() => result.current.handlePlayedNote("C4")); // correcte
    expect(result.current.state.step).toBe(1);
    expect(result.current.state.expectedNote).toBe("E4");

    act(() => result.current.handlePlayedNote("E4"));
    act(() => result.current.handlePlayedNote("G4"));
    expect(result.current.state.done).toBe(true);
    expect(result.current.state.expectedNote).toBeNull();
  });

  it("ne réagit pas aux notes hors session", () => {
    const onPlayed = vi.fn();
    const { result } = renderHook(() => usePractice(song, onPlayed));
    // pas de start : les notes jouées ne changent rien
    act(() => result.current.handlePlayedNote("C4"));
    expect(result.current.state.active).toBe(false);
    expect(onPlayed).toHaveBeenCalledWith("C4");
  });

  it("stop réinitialise la session", () => {
    const { result } = renderHook(() => usePractice(song, vi.fn()));
    act(() => result.current.start());
    act(() => result.current.handlePlayedNote("C4"));
    act(() => result.current.stop());
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.step).toBe(0);
    expect(result.current.state.mistakes).toBe(0);
  });

  it("refuse de démarrer sur un morceau sans événements", () => {
    const empty: Song = { id: "e", title: "E", source: "builtin", events: [] };
    const { result } = renderHook(() => usePractice(empty, vi.fn()));
    act(() => result.current.start());
    expect(result.current.state.active).toBe(false);
  });
});
