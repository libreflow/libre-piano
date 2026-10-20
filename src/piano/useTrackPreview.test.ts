import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useTrackPreview,
  buildPreviewEvents,
  PREVIEW_DURATION_SEC,
} from "./useTrackPreview";

const { MockPart } = vi.hoisted(() => {
  class MockPart {
    static instances: MockPart[] = [];
    events: unknown[] = [];
    start = vi.fn();
    dispose = vi.fn();
    constructor(_cb: unknown, events: unknown[]) {
      this.events = events;
      MockPart.instances.push(this);
    }
  }
  return { MockPart };
});

vi.mock("./tone-gate", () => ({
  Part: MockPart,
  getTransport: () => ({ state: "stopped", start: vi.fn(), stop: vi.fn() }),
}));

const notes = [
  { midi: 60, time: 0, duration: 0.5 },
  { midi: 62, time: 3, duration: 0.4 },
  { midi: 64, time: 12, duration: 0.4 },
];

describe("buildPreviewEvents (roadmap #50)", () => {
  it("ne garde que les notes des 8 premières secondes", () => {
    const events = buildPreviewEvents(notes);
    expect(events).toHaveLength(2);
    expect(events[0].note).toBe("C4");
    expect(events[1].note).toBe("D4");
  });

  it("les notes hors clavier sont ramenées dedans", () => {
    const events = buildPreviewEvents([{ midi: 200, time: 0, duration: 0.5 }]);
    expect(events[0].note).toBe("G#7");
  });

  it("une piste vide avant 8 s donne un extrait vide", () => {
    expect(
      buildPreviewEvents([{ midi: 60, time: PREVIEW_DURATION_SEC + 1, duration: 0.5 }])
    ).toHaveLength(0);
  });
});

describe("useTrackPreview (roadmap #50)", () => {
  beforeEach(() => {
    MockPart.instances = [];
    vi.useFakeTimers();
  });

  it("pré-écoute une piste et s'arrête au bout de 8 s", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useTrackPreview(trigger));
    act(() => result.current.preview(1, notes));
    expect(result.current.previewingTrack).toBe(1);
    expect(MockPart.instances).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(PREVIEW_DURATION_SEC * 1000);
    });
    expect(result.current.previewingTrack).toBeNull();
    expect(MockPart.instances[0].dispose).toHaveBeenCalled();
  });

  it("une nouvelle pré-écoute remplace la précédente", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useTrackPreview(trigger));
    act(() => result.current.preview(1, notes));
    const first = MockPart.instances[0];
    act(() => result.current.preview(2, notes));
    expect(first.dispose).toHaveBeenCalled();
    expect(result.current.previewingTrack).toBe(2);
    act(() => result.current.stop());
  });

  it("audit .mid inaudibles : la pré-écoute normalise la vélocité (plancher 0.25)", () => {
    // Ghost note à vélocité byte 1 (0.008 après parsing) : doit être
    // ramenée au plancher jouable, pas passée telle quelle au sampler.
    const events = buildPreviewEvents([
      { midi: 60, time: 0, duration: 0.5, velocity: 0.008 },
      { midi: 64, time: 0.5, duration: 0.5, velocity: 0.9 },
      { midi: 67, time: 1, duration: 0.5, velocity: 0 },
    ]);
    expect(events[0].velocity).toBe(0.25);
    expect(events[1].velocity).toBe(0.9);
    expect(events[2].velocity).toBe(0.8);
  });

  it("une piste sans notes avant 8 s ne démarre rien", () => {
    const trigger = vi.fn();
    const { result } = renderHook(() => useTrackPreview(trigger));
    act(() => result.current.preview(0, [{ midi: 60, time: 20, duration: 0.5 }]));
    expect(result.current.previewingTrack).toBeNull();
    expect(MockPart.instances).toHaveLength(0);
  });
});
