import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import App from "./App";

const { MockSampler, MockPart } = vi.hoisted(() => {
  class MockSampler {
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    triggerAttackRelease = vi.fn();
    toDestination = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class MockPart {
    start = vi.fn();
    dispose = vi.fn();
  }
  return { MockSampler, MockPart };
});

// WebAudio n'existe pas en jsdom : on mocke la couche audio pour valider
// le rendu complet de l'App (header, contrôles, clavier) sans crash.

const { MockToneAudioBuffer } = vi.hoisted(() => {
  class MockToneAudioBuffer {
    loaded = Promise.resolve();
    constructor(
      _url?: string,
      onload?: (b: never) => void,
      onerror?: (e: never) => void
    ) {
      setTimeout(() => onload?.(this as never), 0);
      void onerror;
    }
    dispose() {}
  }
  return { MockToneAudioBuffer };
});

vi.mock("./piano/tone-gate", () => ({
  ToneAudioBuffer: MockToneAudioBuffer,
  start: vi.fn().mockResolvedValue(undefined),
  getContext: () => ({ state: "running", lookAhead: 0.1 }),
  tuneForLowLatency: vi.fn(),
  ensureAudioStarted: vi.fn().mockResolvedValue(undefined),
  Sampler: MockSampler,
  getTransport: () => ({
    stop: vi.fn(),
    cancel: vi.fn(),
    start: vi.fn(),
    schedule: vi.fn(),
    scheduleOnce: vi.fn(),
  }),
  getDestination: () => ({ volume: { value: 0 } }),
  getDraw: () => ({ schedule: vi.fn() }),
  Part: MockPart,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setFullscreen: vi.fn().mockRejectedValue(new Error("no tauri")),
  }),
}));

describe("App (rendu complet)", () => {
  it("affiche le header, les contrôles et les 88 touches", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".app-header")).toBeInTheDocument();
    expect(container.querySelector(".playback-controls")).toBeInTheDocument();
    expect(container.querySelectorAll(".key").length).toBe(88);
  });

  it("affiche le logo dans le header", () => {
    render(<App />);
    const img = document.querySelector<HTMLImageElement>(".app-header img");
    expect(img?.alt).toBe("Logo Libre Piano");
  });
});
