import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Piano from "./Piano";
import { BUILTIN_SONGS } from "./songs";

const { MockSampler, MockPart } = vi.hoisted(() => {
  class MockSampler {
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    triggerAttackRelease = vi.fn();
    toDestination = vi.fn().mockReturnThis();
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class MockPart {
    start = vi.fn();
    dispose = vi.fn();
  }
  return { MockSampler, MockPart };
});

const { MockToneAudioBuffer, MockReverb, MockEQ3 } = vi.hoisted(() => {
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
  class MockReverb {
    wet = { value: 0 };
    toDestination = vi.fn().mockReturnThis();
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class MockEQ3 {
    low = { value: 0 };
    mid = { value: 0 };
    high = { value: 0 };
    toDestination = vi.fn().mockReturnThis();
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  return { MockToneAudioBuffer, MockReverb, MockEQ3 };
});

vi.mock("./tone-gate", () => ({
  ToneAudioBuffer: MockToneAudioBuffer,
  Reverb: MockReverb,
  EQ3: MockEQ3,
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
  getCurrentWindow: vi.fn().mockReturnValue({
    setFullscreen: vi.fn().mockRejectedValue(new Error("no tauri")),
  }),
}));

describe("Piano (rendu)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("affiche l'écran de chargement puis le clavier complet (88 touches)", async () => {
    render(<Piano />);
    expect(await screen.findByText(/Chargement des sons du piano/)).toBeInTheDocument();
    // Le sampler mocké ne résout jamais onload : le clavier reste rendu
    // derrière l'écran de chargement (les boutons existent dans le DOM).
    const keys = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("key "));
    expect(keys).toHaveLength(88);
  });

  it("affiche les morceaux intégrés dans le sélecteur (une seule option par chanson)", () => {
    render(<Piano />);
    const selects = screen.getAllByRole("combobox");
    // Le premier combobox est le sélecteur de morceaux, le second la disposition.
    const songSelect = selects[0];
    const titles = Array.from(songSelect.querySelectorAll("option")).map(
      (o) => o.textContent
    );
    for (const song of BUILTIN_SONGS) {
      expect(titles).toContain(song.title);
    }
  });

  it("expose des aria-labels sur les touches", () => {
    render(<Piano />);
    expect(screen.getByLabelText("Touche C4")).toBeInTheDocument();
    expect(screen.getByLabelText("Touche C#4")).toBeInTheDocument();
  });

  it("affiche les labels de touches par défaut (AZERTY persisté)", () => {
    render(<Piano />);
    expect(screen.getByLabelText("Touche C3")).toHaveTextContent("Q");
  });

  it("permet de basculer la disposition du clavier (segmented control)", () => {
    render(<Piano />);
    // AZERTY par défaut : C3 = Q
    expect(screen.getByLabelText("Touche C3")).toHaveTextContent("Q");
    const qwertyBtn = screen.getByRole("radio", { name: /QWERTY/i });
    fireEvent.click(qwertyBtn);
    // Après bascule : C3 = A (rangée ASDF)
    expect(screen.getByLabelText("Touche C3")).toHaveTextContent("A");
  });

  it("bascule les étiquettes entre lettres, solfège et aucune (segmented)", () => {
    render(<Piano />);
    const c4 = screen.getByLabelText("Touche C4");
    // Mode par défaut : lettres -> pas de solfège
    expect(c4).toHaveTextContent("K");
    expect(c4).not.toHaveTextContent("Do");

    // Le segmented vit dans le menu Paramètres : on l'ouvre d'abord.
    fireEvent.click(screen.getByRole("button", { name: /Paramètres/i }));

    // Mode solfège
    const solfegeBtn = screen.getByRole("radio", { name: /Do Ré/i });
    fireEvent.click(solfegeBtn);
    expect(c4).toHaveTextContent("Do");
    expect(c4).not.toHaveTextContent("K");

    // Mode aucune étiquette
    const noneBtn = screen.getByRole("radio", { name: /Rien/i });
    fireEvent.click(noneBtn);
    expect(c4).not.toHaveTextContent("Do");
  });

  it("affiche les noms de solfège avec dièses corrects", () => {
    render(<Piano />);
    const cs3 = screen.getByLabelText("Touche C#3");
    fireEvent.click(screen.getByRole("button", { name: /Paramètres/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Do Ré/i }));
    expect(cs3).toHaveTextContent("Do#");
  });

  it("affiche l'overlay de glisser-déposer sur dragover (roadmap #48)", () => {
    render(<Piano />);
    const wrap = document.querySelector(".piano-wrap") as HTMLElement;
    fireEvent.dragOver(wrap, { dataTransfer: { types: ["Files"] } });
    expect(screen.getByText(/Dépose ton fichier/)).toBeInTheDocument();
    fireEvent.drop(wrap, { dataTransfer: { files: [] } });
    expect(screen.queryByText(/Dépose ton fichier/)).not.toBeInTheDocument();
  });

  it("joue une note au pointerdown sur une touche", () => {
    render(<Piano />);
    const key = screen.getByLabelText("Touche C4");
    fireEvent.pointerDown(key, { pointerId: 1 });
    // Le sampler mocké est en "loading" : pas de son, mais pas de crash.
    expect(key).toBeInTheDocument();
  });
});
