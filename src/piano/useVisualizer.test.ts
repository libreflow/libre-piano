import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisualizer } from "./useVisualizer";

const { MockAnalyser, mockDestination } = vi.hoisted(() => {
  class MockAnalyser {
    static last: MockAnalyser | null = null;
    disposed = false;
    getValue = vi.fn(() => new Float32Array([0, 0.5, -0.5, 0.25]));
    constructor() {
      MockAnalyser.last = this;
    }
    dispose() {
      this.disposed = true;
    }
  }
  const mockDestination = { connect: vi.fn() };
  return { MockAnalyser, mockDestination };
});

vi.mock("./tone-gate", () => ({
  Analyser: MockAnalyser,
  getDestination: () => mockDestination,
}));

describe("useVisualizer (roadmap #30)", () => {
  it("inactif par défaut : aucun analyser créé", () => {
    MockAnalyser.last = null;
    const { result } = renderHook(() => useVisualizer(false));
    expect(result.current.getLevels()).toBeNull();
    expect(MockAnalyser.last).toBeNull();
  });

  it("activé : analyser branché et niveaux lisibles", () => {
    MockAnalyser.last = null;
    const { result } = renderHook(() => useVisualizer(true));
    expect(mockDestination.connect).toHaveBeenCalled();
    const levels = result.current.getLevels();
    expect(levels).not.toBeNull();
    expect(levels!.length).toBe(4);
    expect(Math.abs(levels![1])).toBeCloseTo(0.5);
  });

  it("désactivé : dispose l'analyser et repasse inactif", () => {
    MockAnalyser.last = null;
    const { rerender } = renderHook(({ on }) => useVisualizer(on), {
      initialProps: { on: true },
    });
    const instance = MockAnalyser.last;
    act(() => rerender({ on: false }));
    expect(instance?.disposed).toBe(true);
    expect(MockAnalyser.last?.disposed).toBe(true);
  });
});
