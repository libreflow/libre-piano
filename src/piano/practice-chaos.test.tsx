import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import Piano from "./Piano";

// Chaos testing : événements désordonnés et invalides.
// keydown sans keyup, keyup multiples, double keydown, keyup sans keydown,
// pendant des sessions d'apprentissage — l'app ne doit jamais crasher
// ni se retrouver dans un état incohérent (touche muette, panneau zombie).

const { MockSampler, MockPart, MockToneAudioBuffer } = vi.hoisted(() => {
  class MockSampler {
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    triggerAttackRelease = vi.fn();
    toDestination = vi.fn().mockReturnThis();
    dispose = vi.fn();
    constructor(options?: { onload?: () => void }) {
      // le vrai Sampler appelle onload une fois prêt : indispensable
      // pour que le status passe à "ready" et que noteOn fonctionne.
      setTimeout(() => options?.onload?.(), 0);
    }
  }
  class MockPart {
    start = vi.fn();
    dispose = vi.fn();
    loop = false;
    constructor(_cb: unknown, _events: unknown[]) {}
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

function press(key: string) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key, code: `Key${key.toUpperCase()}` })
    );
  });
}
function release(key: string) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keyup", { key, code: `Key${key.toUpperCase()}` })
    );
  });
}

describe("chaos : événements clavier désordonnés en apprentissage", () => {
  it("keydown redondants / keyup orphelins ne corrompent pas l'état", async () => {
    const { container, unmount } = render(<Piano />);
    // attendre le chargement du sampler (30 buffers mockés -> ready)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const practiceBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Apprentissage")
    );
    fireEvent.click(practiceBtn!);

    // double keydown (répétition système sans e.repeat)
    press("a");
    press("a");
    press("a");
    release("a");
    release("a"); // keyup orphelin
    release("x"); // touche inconnue

    // frappes rapides mélangées en pleine session
    for (const k of ["s", "d", "f", "g", "h", "j"]) {
      press(k);
    }
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    // keyup après blur (jamçs reçus en vrai, mais si)
    for (const k of ["s", "d", "f", "g", "h", "j"]) {
      release(k);
    }

    // l'app doit rester jouable : un keydown->keyup propre fait sonner
    // la touche (la surbrillance .active apparaît puis disparaît).
    press("a");
    const keyButtons = Array.from(container.querySelectorAll(".key"));
    const activeWhilePressed = keyButtons.filter((k) => k.className.includes("active"));
    expect(activeWhilePressed.length).toBeGreaterThan(0);
    release("a");

    // le panneau d'apprentissage est toujours cohérent
    expect(container.querySelector(".practice-panel")).not.toBeNull();
    unmount();
    cleanup();
  });
});
