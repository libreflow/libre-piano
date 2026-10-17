import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import Piano from "./Piano";

// Fuzz du COMPOSANT Piano complet en mode apprentissage : séquences
// aléatoires mêlant session d'apprentissage, frappes clavier, décalages
// d'octave, changements de morceau et pédale, pour attraper les crashes
// et incohérences d'affichage/état.

const { MockSampler, MockPart, MockToneAudioBuffer } = vi.hoisted(() => {
  class MockSampler {
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    triggerAttackRelease = vi.fn();
    toDestination = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class MockPart {
    events: unknown[] = [];
    start = vi.fn();
    dispose = vi.fn();
    loop = false;
    constructor(_cb: unknown, events: unknown[]) {
      this.events = events;
    }
  }
  class MockToneAudioBuffer {
    loaded = Promise.resolve();
    constructor(
      _url?: string,
      onload?: (b: never) => void,
      _onerror?: (e: never) => void
    ) {
      setTimeout(() => onload?.(this as never), 0);
    }
    dispose() {}
  }
  return { MockSampler, MockPart, MockToneAudioBuffer };
});

vi.mock("./tone-gate", () => ({
  Sampler: MockSampler,
  Part: MockPart,
  ToneAudioBuffer: MockToneAudioBuffer,
  getContext: () => ({ state: "running", lookAhead: 0.1 }),
  getTransport: () => ({
    stop: vi.fn(),
    cancel: vi.fn(),
    start: vi.fn(),
    scheduleOnce: vi.fn(),
  }),
  getDestination: () => ({ volume: { value: 0 } }),
  getDraw: () => ({ schedule: vi.fn() }),
  tuneForLowLatency: vi.fn(),
  ensureAudioStarted: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setFullscreen: vi.fn().mockRejectedValue(new Error("no tauri")),
  }),
}));

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PC_KEYS = [
  "a",
  "s",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  ";",
  "q",
  "w",
  "e",
  "r",
  "t",
];

describe("fuzz intégration : mode apprentissage du composant Piano", () => {
  it("séquences aléatoires ne crashent pas", () => {
    const rand = mulberry32(7);
    for (let iter = 0; iter < 60; iter++) {
      const { container, unmount } = render(<Piano />);
      const actions = 3 + Math.floor(rand() * 12);
      try {
        // démarrer l'apprentissage
        const practiceBtn = Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Apprentissage")
        );
        if (rand() < 0.9 && practiceBtn) fireEvent.click(practiceBtn);

        for (let a = 0; a < actions; a++) {
          const op = rand();
          if (op < 0.5) {
            // frappe clavier
            const key = PC_KEYS[Math.floor(rand() * PC_KEYS.length)];
            act(() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key, code: `Key${key.toUpperCase()}` })
              );
            });
            act(() => {
              window.dispatchEvent(
                new KeyboardEvent("keyup", { key, code: `Key${key.toUpperCase()}` })
              );
            });
          } else if (op < 0.6) {
            // pédale
            act(() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: " ", code: "Space" })
              );
            });
            act(() => {
              window.dispatchEvent(
                new KeyboardEvent("keyup", { key: " ", code: "Space" })
              );
            });
          } else if (op < 0.75) {
            // clic souris sur une touche au hasard
            const keys = container.querySelectorAll(".key");
            const key = keys[Math.floor(rand() * keys.length)];
            fireEvent.mouseDown(key);
            fireEvent.mouseUp(key);
          } else if (op < 0.9) {
            // changer de morceau via le select
            const select = container.querySelector("select");
            if (select && select.options.length > 1) {
              const idx = Math.floor(rand() * select.options.length);
              fireEvent.change(select, { target: { value: select.options[idx].value } });
            }
          } else {
            // blur de fenêtre (Alt-Tab en pleine session)
            act(() => {
              window.dispatchEvent(new Event("blur"));
            });
          }
        }
        // le composant doit toujours être dans un état rendu cohérent
        expect(container.querySelectorAll(".key").length).toBe(88);
        // panneau présent si session active
        const panel = container.querySelector(".practice-panel");
        const active = practiceBtn?.getAttribute("aria-pressed") === "true";
        if (active) expect(panel).not.toBeNull();
      } finally {
        unmount();
        cleanup();
      }
    }
  });
});
