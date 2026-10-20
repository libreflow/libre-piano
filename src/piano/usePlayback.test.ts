import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayback, LoopState } from "./usePlayback";
import type { Song } from "./songs";

// Tone est mocké : on teste la logique (fenêtrage A-B, vitesse, arrêt),
// pas l'audio. On capture ce qui est envoyé au Part pour l'inspecter.
const { MockPart } = vi.hoisted(() => {
  class MockPart {
    static instances: {
      events: unknown[];
      start: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
      loop: boolean;
    }[] = [];
    events: unknown[];
    start = vi.fn();
    dispose = vi.fn();
    loop = false;
    constructor(_callback: unknown, events: unknown[]) {
      this.events = events;
      MockPart.instances.push(this);
    }
  }
  return { MockPart };
});
vi.mock("./tone-gate", () => ({
  ensureAudioStarted: vi.fn().mockResolvedValue(undefined),
  Part: MockPart,
  getTransport: () => ({
    stop: vi.fn(),
    cancel: vi.fn(),
    clear: vi.fn(),
    start: vi.fn(),
    scheduleOnce: vi.fn(),
  }),
  getDraw: () => ({ schedule: vi.fn() }),
}));

const song: Song = {
  id: "test",
  title: "Test",
  source: "builtin",
  events: [
    { time: 0, note: "C4", duration: 0.5 },
    { time: 1, note: "E4", duration: 0.5 },
    { time: 2, note: "G4", duration: 0.5 },
  ],
};

const noLoop: LoopState = { loopEnabled: false, loopStart: 0, loopEnd: 3 };

async function play(hook: ReturnType<typeof renderHook>) {
  await act(async () => {
    const { playSong } = hook.result.current as ReturnType<typeof usePlayback> & {
      playSong: () => Promise<void>;
    };
    await playSong();
  });
}

describe("usePlayback", () => {
  beforeEach(() => {
    MockPart.instances.length = 0;
    vi.clearAllMocks();
  });

  function setup(overrides?: { speed?: number; loop?: LoopState }) {
    const triggerNote = vi.fn();
    const on = vi.fn();
    const off = vi.fn();
    const hook = renderHook(() =>
      usePlayback(
        true,
        song,
        overrides?.speed ?? 100,
        overrides?.loop ?? noLoop,
        triggerNote,
        on,
        off
      )
    );
    return { hook, triggerNote, on, off };
  }

  it("ne joue pas si le sampler n'est pas prêt", async () => {
    const triggerNote = vi.fn();
    const hook = renderHook(() =>
      usePlayback(false, song, 100, noLoop, triggerNote, vi.fn(), vi.fn())
    );
    await act(async () => {
      await (hook.result.current as { playSong: () => Promise<void> }).playSong();
    });
    expect(MockPart.instances).toHaveLength(0);
  });

  it("construit un Part avec tous les événements à vitesse x1", async () => {
    const { hook } = setup();
    await play(hook);
    expect(MockPart.instances).toHaveLength(1);
    const part = MockPart.instances[0];
    expect(part.events).toEqual(song.events);
    expect(part.loop).toBe(false);
  });

  it("applique le facteur de vitesse (50% = durées doublées)", async () => {
    const { hook } = setup({ speed: 50 });
    await play(hook);
    const part = MockPart.instances[0];
    expect(part.events).toEqual([
      { time: 0, note: "C4", duration: 1 },
      { time: 2, note: "E4", duration: 1 },
      { time: 4, note: "G4", duration: 1 },
    ]);
  });

  it("fenêtre la boucle A-B sur la section choisie, retimée à 0", async () => {
    const { hook } = setup({
      loop: { loopEnabled: true, loopStart: 1, loopEnd: 2.5 },
    });
    await play(hook);
    const part = MockPart.instances[0];
    // événements dans [1, 2.5) retimés à 0 : E4 (t=1) et G4 (t=2)
    expect(part.events).toEqual([
      { time: 0, note: "E4", duration: 0.5 },
      { time: 1, note: "G4", duration: 0.5 },
    ]);
    expect(part.loop).toBe(true);
  });

  it("échange les bornes inversées plutôt que de jouer une boucle vide", async () => {
    const { hook } = setup({
      loop: { loopEnabled: true, loopStart: 2, loopEnd: 0.5 },
    });
    await play(hook);
    const part = MockPart.instances[0];
    // bornes échangées -> section [0.5, 2) : E4 (t=1) uniquement
    expect(part.events).toEqual([{ time: 0.5, note: "E4", duration: 0.5 }]);
  });

  it("ramène une borne NaN à 0 sans crash", async () => {
    const { hook } = setup({
      loop: { loopEnabled: true, loopStart: Number.NaN, loopEnd: 2 },
    });
    await play(hook);
    const part = MockPart.instances[0];
    expect(part.events.length).toBe(2); // C4 (t=0) et E4 (t=1)
  });

  it("arrête la lecture : isPlaying passe à false", async () => {
    const { hook } = setup();
    await play(hook);
    expect((hook.result.current as { isPlaying: boolean }).isPlaying).toBe(true);
    act(() => {
      (hook.result.current as { stopPlayback: () => void }).stopPlayback();
    });
    expect((hook.result.current as { isPlaying: boolean }).isPlaying).toBe(false);
  });

  it("stop n'appelle pas transport.cancel() : le métronome survit à l'arrêt", async () => {
    const { hook } = setup();
    await play(hook);
    act(() => {
      (hook.result.current as { stopPlayback: () => void }).stopPlayback();
    });
    const transport = (await import("./tone-gate")).getTransport() as {
      cancel: ReturnType<typeof vi.fn>;
    };
    expect(transport.cancel).not.toHaveBeenCalled();
  });

  it("expose la durée du morceau sélectionné", () => {
    const { hook } = setup();
    expect(
      (hook.result.current as { selectedSongDuration: number }).selectedSongDuration
    ).toBe(2.5);
  });
});

describe("bug M2 : boucle activée avec bornes à 0", () => {
  it("joue le morceau entier, pas une micro-boucle de 0.1 s", async () => {
    const triggerNote = vi.fn();
    const hook = renderHook(() =>
      usePlayback(
        true,
        song,
        100,
        { loopEnabled: true, loopStart: 0, loopEnd: 0 },
        triggerNote,
        vi.fn(),
        vi.fn()
      )
    );
    await play(hook);
    const part = MockPart.instances.at(-1) as unknown as {
      events: { time: number }[];
      loop: boolean;
      loopEnd?: number;
    };
    // Tous les événements du morceau sont dans la boucle
    expect(part.events).toHaveLength(3);
    expect(part.loop).toBe(true);
    const last = part.events.at(-1) as { time: number };
    expect(last.time).toBeCloseTo(2);
  });
});
