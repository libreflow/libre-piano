// Tests des hooks extraits en Phase A (refactor Piano.tsx).

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStatusMessage } from "./useStatusMessage";
import { useFavorites, applyBuiltinFavorites, sortLibrary } from "./useFavorites";
import type { Song } from "../songs";

describe("useStatusMessage (Phase A1)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("affiche un message puis l'efface après le timeout", () => {
    const { result } = renderHook(() => useStatusMessage());
    act(() => result.current.setStatusMessageAuto("Bonjour"));
    expect(result.current.statusMessage).toBe("Bonjour");
    act(() => vi.advanceTimersByTime(8000));
    expect(result.current.statusMessage).toBeNull();
  });

  it("ne laisse pas un ancien timer effacer le nouveau message", () => {
    const { result } = renderHook(() => useStatusMessage());
    act(() => result.current.setStatusMessageAuto("Premier"));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.setStatusMessageAuto("Second"));
    // Le timer du « Premier » expire le premier, mais le message courant
    // est « Second » : il ne doit pas être effacé par le mauvais timer.
    act(() => vi.advanceTimersByTime(7900));
    expect(result.current.statusMessage).toBe("Second");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.statusMessage).toBeNull();
  });
});

describe("useFavorites (Phase A3)", () => {
  it("bascule un favori intégré en mémoire", () => {
    const { result } = renderHook(() => useFavorites(["builtin-x"]));
    expect(result.current.builtinFavorites.has("builtin-x")).toBe(true);
    act(() => result.current.toggleFavorite("builtin-y"));
    expect(result.current.builtinFavorites.has("builtin-y")).toBe(true);
    act(() => result.current.toggleFavorite("builtin-y"));
    expect(result.current.builtinFavorites.has("builtin-y")).toBe(false);
  });

  it("applyBuiltinFavorites marque uniquement les morceaux intégrés", () => {
    const songs: Song[] = [
      { id: "b", title: "B", source: "builtin", events: [] },
      { id: "i", title: "I", source: "imported", events: [] },
    ];
    const out = applyBuiltinFavorites(songs, new Set(["b", "i"]));
    expect(out[0].favorite).toBe(true);
    expect(out[1].favorite).toBeUndefined();
  });

  it("sortLibrary met favoris puis imports récents en tête", () => {
    const songs: Song[] = [
      { id: "1", title: "Builtin", source: "builtin", events: [] },
      { id: "2", title: "Imported", source: "imported", events: [] },
      { id: "3", title: "Fav builtin", source: "builtin", events: [], favorite: true },
    ];
    // L'ordre du <select> d'origine : imports en tête, puis tri par
    // favoris À L'INTÉRIEUR de chaque source (comportement préservé).
    const out = sortLibrary(songs);
    expect(out.map((s) => s.id)).toEqual(["2", "3", "1"]);
  });
});
