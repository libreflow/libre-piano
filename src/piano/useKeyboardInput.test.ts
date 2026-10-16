import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardInput } from "./useKeyboardInput";

vi.mock("./notes", () => ({
  getKeyToNote: (layout: string) =>
    layout === "azerty" ? { q: "C3", s: "D3", w: "C#3" } : { a: "C3", s: "D3", z: "C#3" },
}));
vi.mock("./tone-gate", () => ({
  ensureAudioStarted: vi.fn().mockResolvedValue(undefined),
  getContext: () => ({ state: "running" }),
}));

function press(type: "keydown" | "keyup", key: string, opts?: KeyboardEventInit) {
  const e = new KeyboardEvent(type, {
    key,
    code: key === " " ? "Space" : key,
    bubbles: true,
    ...opts,
  });
  window.dispatchEvent(e);
}

describe("useKeyboardInput", () => {
  let noteOn: ReturnType<typeof vi.fn>;
  let noteOff: ReturnType<typeof vi.fn>;
  let onSustainChange: ReturnType<typeof vi.fn>;
  let releaseSustained: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    noteOn = vi.fn();
    noteOff = vi.fn();
    onSustainChange = vi.fn();
    releaseSustained = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("déclenche noteOn sur une touche mappée", async () => {
    const isPlayingRef = { current: false };
    renderHook(() =>
      useKeyboardInput({
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
      })
    );
    await act(async () => {
      press("keydown", "a");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).toHaveBeenCalledWith("C3");
  });

  it("ignore les touches non mappées", async () => {
    const isPlayingRef = { current: false };
    renderHook(() =>
      useKeyboardInput({
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
      })
    );
    await act(async () => {
      press("keydown", "y");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).not.toHaveBeenCalled();
  });

  it("ignore les répétitions automatiques (e.repeat)", async () => {
    const isPlayingRef = { current: false };
    renderHook(() =>
      useKeyboardInput({
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
      })
    );
    await act(async () => {
      press("keydown", "a", { repeat: true });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).not.toHaveBeenCalled();
  });

  it("ne joue pas pendant la lecture automatique", async () => {
    const isPlayingRef = { current: true };
    renderHook(() =>
      useKeyboardInput({
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
      })
    );
    await act(async () => {
      press("keydown", "a");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).not.toHaveBeenCalled();
  });

  it("relâche la note au keyup", async () => {
    const isPlayingRef = { current: false };
    renderHook(() =>
      useKeyboardInput({
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
      })
    );
    await act(async () => {
      press("keydown", "a");
      await new Promise((r) => setTimeout(r, 0));
    });
    act(() => press("keyup", "a"));
    expect(noteOff).toHaveBeenCalledWith("C3");
  });

  it("active la pédale sur Espace maintenue et la relâche au keyup", () => {
    const isPlayingRef = { current: false };
    renderHook(() =>
      useKeyboardInput({
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
      })
    );
    act(() => press("keydown", " "));
    expect(onSustainChange).toHaveBeenCalledWith(true);
    expect(noteOn).not.toHaveBeenCalled();
    act(() => press("keyup", " "));
    expect(onSustainChange).toHaveBeenCalledWith(false);
    expect(releaseSustained).toHaveBeenCalled();
  });

  it("relâche tout au blur de la fenêtre", () => {
    const isPlayingRef = { current: false };
    renderHook(() =>
      useKeyboardInput({
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
      })
    );
    act(() => press("keydown", " "));
    act(() => window.dispatchEvent(new Event("blur")));
    expect(releaseSustained).toHaveBeenCalled();
  });
});
