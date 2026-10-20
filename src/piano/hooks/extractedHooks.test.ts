// Tests des hooks extraits du refactor de Piano.tsx : useActiveNotes,
// useSongLibrary, usePracticeStats, useSettingsMenuState, usePersistSnapshot.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActiveNotes } from "./useActiveNotes";
import { useSongLibrary } from "./useSongLibrary";
import { usePracticeStats } from "./usePracticeStats";
import { useSettingsMenuState } from "./useSettingsMenuState";
import { usePersistSnapshot } from "./usePersistSnapshot";
import type { Song } from "../songs";

const song = (id: string, title: string): Song => ({
  id,
  title,
  source: "imported",
  events: [{ time: 0, note: "C4", duration: 0.5 }],
});

describe("useActiveNotes (refactor Piano.tsx)", () => {
  it("marque et relâche une note active", () => {
    const { result } = renderHook(() => useActiveNotes());
    act(() => result.current.markNoteOn("C4"));
    expect(result.current.activeNotes.has("C4")).toBe(true);
    const release = vi.fn();
    act(() => result.current.routeNoteOff("C4", release));
    expect(release).toHaveBeenCalledWith("C4");
    expect(result.current.activeNotes.has("C4")).toBe(false);
    expect(result.current.sustainedNotes.size).toBe(0);
  });

  it("routage sustain : pédale enfoncée, la note rejoint les sustained", () => {
    const { result } = renderHook(() => useActiveNotes());
    act(() => result.current.setSustainOn(true));
    act(() => result.current.markNoteOn("E4"));
    const release = vi.fn();
    act(() => result.current.routeNoteOff("E4", release));
    expect(release).not.toHaveBeenCalled();
    expect(result.current.sustainedNotes.has("E4")).toBe(true);
    // Relâchement de la pédale : clearSustained vide la liste.
    act(() => result.current.clearSustained());
    expect(result.current.sustainedNotes.size).toBe(0);
  });

  it("clearAutoNotes vide les notes de lecture automatique", () => {
    const { result } = renderHook(() => useActiveNotes());
    act(() => result.current.markAutoNoteOn("G4"));
    expect(result.current.autoActiveNotes.has("G4")).toBe(true);
    act(() => result.current.clearAutoNotes());
    expect(result.current.autoActiveNotes.size).toBe(0);
  });
});

describe("useSongLibrary (refactor Piano.tsx)", () => {
  it("sélectionne le premier morceau builtin par défaut", () => {
    const { result } = renderHook(() => useSongLibrary([], null));
    expect(result.current.selectedSongId).toBeTruthy();
    expect(result.current.allSongs.length).toBeGreaterThan(0);
  });

  it("valide l'id sélectionné initial : id inconnu -> défaut", () => {
    const { result } = renderHook(() => useSongLibrary([], "inexistant"));
    expect(result.current.selectedSongId).not.toBe("inexistant");
  });

  it("addImportedSong ajoute et sélectionne le morceau", () => {
    const { result } = renderHook(() => useSongLibrary([], null));
    const s = song("imported-1", "Mon import");
    act(() => result.current.addImportedSong(s));
    expect(result.current.allSongs.some((x) => x.id === "imported-1")).toBe(true);
    expect(result.current.selectedSongId).toBe("imported-1");
  });

  it("suppression : la modale mémorise, la confirmation supprime + callback de purge", () => {
    const { result } = renderHook(() => useSongLibrary([song("a", "A")], "a"));
    const purged: string[] = [];
    act(() => result.current.requestDeleteSong("a"));
    expect(result.current.deleteTarget?.id).toBe("a");
    act(() => result.current.confirmDeleteSong((id) => purged.push(id)));
    expect(result.current.deleteTarget).toBeNull();
    expect(purged).toEqual(["a"]);
    expect(result.current.allSongs.some((x) => x.id === "a")).toBe(false);
    // La sélection retombe sur un morceau builtin.
    expect(result.current.selectedSongId).not.toBe("a");
  });

  it("annulation de la suppression : rien ne change", () => {
    const { result } = renderHook(() => useSongLibrary([song("a", "A")], "a"));
    act(() => result.current.requestDeleteSong("a"));
    act(() => result.current.cancelDeleteSong());
    expect(result.current.deleteTarget).toBeNull();
    expect(result.current.allSongs.some((x) => x.id === "a")).toBe(true);
  });
});

describe("usePracticeStats (refactor Piano.tsx)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enregistre une session quand practice passe à done, puis purge", () => {
    const s = song("song-1", "S");
    const { result, rerender } = renderHook(
      (props: { song: Song; p: { done: boolean; score: number | null; mistakes: number } }) =>
        usePracticeStats(props.song, props.p),
      {
        initialProps: {
          song: s,
          p: { done: false, score: null, mistakes: 0 },
        },
      }
    );
    expect(result.current.stats["song-1"]).toBeUndefined();
    // Session terminée : 100 avec 2 fautes -> score 33.
    rerender({ song: s, p: { done: true, score: 100, mistakes: 2 } });
    expect(result.current.stats["song-1"]).toHaveLength(1);
    expect(result.current.stats["song-1"][0].score).toBe(100);
    // Purge (B10).
    act(() => result.current.purgeSong("song-1"));
    expect(result.current.stats["song-1"]).toBeUndefined();
    // La session est persistée dans localStorage.
    rerender({ song: s, p: { done: false, score: null, mistakes: 0 } });
    expect(localStorage.getItem("libre-piano:practice-stats:v1")).not.toBeNull();
  });
});

describe("useSettingsMenuState (refactor Piano.tsx)", () => {
  it("état initial fermé, shortcuts par défaut", () => {
    const { result } = renderHook(() =>
      useSettingsMenuState({ sustain: "Space", togglePlayback: "Enter" })
    );
    expect(result.current.settingsOpen).toBe(false);
    expect(result.current.remapping).toBeNull();
    expect(result.current.shortcuts.sustain).toBe("Space");
  });
});

describe("usePersistSnapshot (refactor Piano.tsx)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persiste après le debounce de 300 ms, une seule fois", () => {
    const persist = vi.fn().mockReturnValue(true);
    const snapshot = { speed: 100 } as never;
    const { result } = renderHook(() =>
      usePersistSnapshot(snapshot, persist, vi.fn())
    );
    void result;
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(persist).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("avertit du quota une seule fois par session de dépassement", () => {
    const persist = vi.fn().mockReturnValue(false);
    const onQuotaFull = vi.fn();
    renderHook(() => usePersistSnapshot({} as never, persist, onQuotaFull));
    act(() => {
      vi.advanceTimersByTime(310);
    });
    expect(onQuotaFull).toHaveBeenCalledTimes(1);
  });
});
