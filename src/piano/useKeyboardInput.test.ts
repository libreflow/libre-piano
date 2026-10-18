import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardInput } from "./useKeyboardInput";

vi.mock("./notes", () => ({
  // Simule le décalage d'octave : +1 décale les notes d'une octave.
  getKeyToNote: (layout: string, octaveShift = 0) => {
    const shift = (note: string) => {
      const m = note.match(/^([A-G]#?)(\d+)$/);
      return m ? `${m[1]}${parseInt(m[2], 10) + octaveShift}` : note;
    };
    const base =
      layout === "azerty"
        ? { q: "C3", s: "D3", w: "C#3" }
        : { a: "C3", s: "D3", z: "C#3" };
    return Object.fromEntries(Object.entries(base).map(([k, n]) => [k, shift(n)]));
  },
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

describe("raccourci Entrée vs éléments interactifs", () => {
  it("ne lance pas la lecture si le focus est sur un label (dialogue pistes)", () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const onSustainChange = vi.fn();
    const releaseSustained = vi.fn();
    const onTogglePlayback = vi.fn();
    const isPlayingRef = { current: false };
    // Simuler le DOM du sélecteur de pistes : label > input
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.appendChild(input);
    document.body.appendChild(label);
    input.focus();

    renderHook(() =>
      useKeyboardInput({
        layout: "qwerty",
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained,
        onTogglePlayback,
      })
    );
    act(() => {
      const e = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      });
      Object.defineProperty(e, "target", { value: input });
      window.dispatchEvent(e);
    });
    expect(onTogglePlayback).not.toHaveBeenCalled();
    label.remove();
  });

  it("relâche la note au keyup même pendant la lecture (bug note bloquée)", async () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const isPlayingRef = { current: false };
    renderHook(() =>
      useKeyboardInput({
        layout: "qwerty",
        isPlayingRef,
        noteOn,
        noteOff,
        onSustainChange: vi.fn(),
        releaseSustained: vi.fn(),
      })
    );
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }));
      await new Promise((r) => setTimeout(r, 0));
    });
    // La lecture démarre PENDANT que la touche est maintenue
    isPlayingRef.current = true;
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "a", code: "KeyA" }));
    });
    // La note doit être relâchée malgré la lecture active
    expect(noteOff).toHaveBeenCalledWith("C3");
  });
});

describe("régression : décalage d'octave pendant une touche maintenue", () => {
  it("relâche la note du keydown même si la fenêtre a bougé (note orpheline)", async () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const isPlayingRef = { current: false };
    const { result } = renderHook(
      ({ octaveShift }: { octaveShift: number }) =>
        useKeyboardInput({
          layout: "qwerty",
          octaveShift,
          isPlayingRef,
          noteOn,
          noteOff,
          onSustainChange: vi.fn(),
          releaseSustained: vi.fn(),
        }),
      { initialProps: { octaveShift: 0 } }
    );
    void result;
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).toHaveBeenCalledWith("C3");

    // l'utilisateur décale l'octave pendant que la touche est maintenue :
    // le keyup doit relâcher C3 (la note du keydown), pas C4.
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "a", code: "KeyA" }));
    });
    expect(noteOff).toHaveBeenCalledWith("C3");
    expect(noteOff).not.toHaveBeenCalledWith("C4");
  });

  it("keyup Espace sans pédale enfoncée ne relâche rien", () => {
    const releaseSustained = vi.fn();
    renderHook(() =>
      useKeyboardInput({
        layout: "qwerty",
        isPlayingRef: { current: false },
        noteOn: vi.fn(),
        noteOff: vi.fn(),
        onSustainChange: vi.fn(),
        releaseSustained,
      })
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space" }));
    });
    expect(releaseSustained).not.toHaveBeenCalled();
  });
});

describe("régression : blur fenêtre pendant des touches maintenues", () => {
  it("relâche toutes les notes actives au blur (bug note bloquée)", async () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    renderHook(() =>
      useKeyboardInput({
        layout: "qwerty",
        isPlayingRef: { current: false },
        noteOn,
        noteOff,
        onSustainChange: vi.fn(),
        releaseSustained: vi.fn(),
      })
    );
    // deux touches maintenues
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", code: "KeyS" }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).toHaveBeenCalledWith("C3");
    expect(noteOn).toHaveBeenCalledWith("D3");

    // Alt-Tab : blur de la fenêtre, keyup jamais reçus
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(noteOff).toHaveBeenCalledWith("C3");
    expect(noteOff).toHaveBeenCalledWith("D3");

    // les touches redeviennent jouables au retour
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).toHaveBeenCalledTimes(3);
  });
});

describe("régression : décalage d'octave et notes jouées synchrones", () => {
  it("un keydown après le décalage joue la note de la NOUVELLE fenêtre", async () => {
    const noteOn = vi.fn();
    const { result, rerender } = renderHook(
      ({ octaveShift }: { octaveShift: number }) =>
        useKeyboardInput({
          layout: "qwerty",
          octaveShift,
          isPlayingRef: { current: false },
          noteOn,
          noteOff: vi.fn(),
          onSustainChange: vi.fn(),
          releaseSustained: vi.fn(),
        }),
      { initialProps: { octaveShift: 0 } }
    );
    void result;
    // fenêtre C3 : A = C3
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).toHaveBeenNthCalledWith(1, "C3");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "a", code: "KeyA" }));
    });

    // décalage +1 (fenêtre C4) puis keydown immédiat :
    // doit jouer C4, pas l'ancien C3
    await act(async () => {
      rerender({ octaveShift: 1 });
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(noteOn).toHaveBeenNthCalledWith(2, "C4");
  });
});

describe("régression : octaveShift passé au hook (bug affichage ≠ clavier)", () => {
  it("un octaveShift non nul décale bien les notes jouées", () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const { result, rerender } = renderHook(
      (props: { octaveShift?: number }) =>
        useKeyboardInput({
          layout: "azerty",
          octaveShift: props.octaveShift,
          isPlayingRef: { current: false },
          noteOn,
          noteOff,
          onSustainChange: vi.fn(),
          releaseSustained: vi.fn(),
        }),
      { initialProps: { octaveShift: 0 } }
    );
    void result;
    // Sans décalage : Q = C3
    press("keydown", "q");
    press("keyup", "q");
    expect(noteOn).toHaveBeenCalledWith("C3");
    // Décalage +1 octave : Q doit jouer C4, comme l'étiquette affichée.
    act(() => {
      rerender({ octaveShift: 1 });
    });
    press("keydown", "q");
    press("keyup", "q");
    expect(noteOn).toHaveBeenCalledWith("C4");
  });
});

describe("roadmap #65 : raccourcis personnalisables", () => {
  it("les touches remappées pilotent sustain et lecture", () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const onSustainChange = vi.fn();
    const onTogglePlayback = vi.fn();
    renderHook(() =>
      useKeyboardInput({
        layout: "azerty",
        shortcuts: { sustain: "ShiftLeft", togglePlayback: "KeyP" },
        isPlayingRef: { current: false },
        noteOn,
        noteOff,
        onSustainChange,
        releaseSustained: vi.fn(),
        onTogglePlayback,
      })
    );
    // ShiftLeft = pédale (au lieu de Space)
    press("keydown", " ", { code: "ShiftLeft" });
    expect(onSustainChange).toHaveBeenCalledWith(true);
    press("keyup", " ", { code: "ShiftLeft" });
    expect(onSustainChange).toHaveBeenCalledWith(false);
    // P = lecture (au lieu de Enter)
    press("keydown", "p", { code: "KeyP" });
    expect(onTogglePlayback).toHaveBeenCalled();
    // Space ne fait plus la pédale
    press("keydown", " ", { code: "Space" });
    expect(onSustainChange).toHaveBeenCalledTimes(2);
  });
});
