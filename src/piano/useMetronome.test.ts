import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useMetronome,
  makeTickTrigger,
  METRONOME_MAX_BPM,
  METRONOME_MIN_BPM,
} from "./useMetronome";

const { MockLoop } = vi.hoisted(() => {
  class MockLoop {
    static instances: MockLoop[] = [];
    interval = 0;
    start = vi.fn();
    dispose = vi.fn();
    constructor(
      public callback: (time: number) => void,
      interval: number
    ) {
      this.interval = interval;
      MockLoop.instances.push(this);
    }
  }
  return { MockLoop };
});

vi.mock("./tone-gate", () => ({
  Loop: MockLoop,
  getContext: () => ({ state: "running" }),
  getTransport: () => ({ state: "started", start: vi.fn() }),
}));

describe("useMetronome (roadmap #27)", () => {
  beforeEach(() => {
    MockLoop.instances = [];
  });

  it("reste inactif par défaut (aucun nœud créé)", () => {
    const { result } = renderHook(() => useMetronome(vi.fn()));
    expect(result.current.enabled).toBe(false);
    expect(MockLoop.instances).toHaveLength(0);
  });

  it("crée un Loop à l'activation et le dispose à l'arrêt", () => {
    const { result } = renderHook(() => useMetronome(vi.fn()));
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(MockLoop.instances).toHaveLength(1);
    const loop = MockLoop.instances[0];
    expect(loop.start).toHaveBeenCalled();
    expect(loop.interval).toBeCloseTo(60 / 100);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(loop.dispose).toHaveBeenCalled();
  });

  it("le tick callback appelle le trigger avec l'heure du Transport", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useMetronome(trigger));
    act(() => result.current.toggle());
    const loop = MockLoop.instances[0];
    act(() => loop.callback(42.5));
    expect(trigger).toHaveBeenCalledWith(42.5);
  });

  it("setBpm borne la valeur et met à jour l'intervalle du nœud", () => {
    const { result } = renderHook(() => useMetronome(vi.fn()));
    act(() => result.current.setBpm(999));
    expect(result.current.bpm).toBe(METRONOME_MAX_BPM);
    act(() => result.current.setBpm(10));
    expect(result.current.bpm).toBe(METRONOME_MIN_BPM);
    act(() => result.current.toggle());
    const loop = MockLoop.instances[0];
    act(() => result.current.setBpm(120));
    expect(loop.interval).toBeCloseTo(60 / 120);
  });
});

describe("makeTickTrigger (roadmap #27)", () => {
  it("ne fait rien sans sampler", () => {
    const trigger = makeTickTrigger({ current: null });
    expect(() => trigger(1)).not.toThrow();
  });

  it("déclenche une note courte à l'heure donnée", () => {
    const triggerAttackRelease = vi.fn();
    const trigger = makeTickTrigger({ current: { triggerAttackRelease } });
    trigger(7.25);
    expect(triggerAttackRelease).toHaveBeenCalledWith(
      "C8",
      0.03,
      7.25,
      expect.any(Number)
    );
  });
});
