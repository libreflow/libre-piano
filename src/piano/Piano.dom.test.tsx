// Test de non-régression DOM (refactor Phase C) : verrouille les rôles
// et labels de l'UI. Une extraction de composant qui casse un aria-label
// ou retire un contrôle doit échouer ici, indépendamment des tests de
// comportement.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import Piano from "./Piano";

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
      setTimeout(() => onerror?.(new Error("x") as never), 100000);
    }
    dispose() {}
    get() {
      return null;
    }
  }
  class MockReverb {
    wet = { value: 0 };
    connect = vi.fn().mockReturnThis();
    dispose() {}
  }
  class MockEQ3 {
    low = { value: 0 };
    mid = { value: 0 };
    high = { value: 0 };
    toDestination = vi.fn().mockReturnThis();
    dispose() {}
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
    clear: vi.fn(),
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

describe("Piano : non-régression du DOM (rôles et labels)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("la toolbar expose ses quatre groupes étiquetés", () => {
    render(<Piano />);
    const toolbar = screen.getByRole("toolbar", { name: "Contrôles du piano" });
    expect(within(toolbar).getByLabelText("Lecture")).toBeTruthy();
    expect(within(toolbar).getByLabelText("Réglages")).toBeTruthy();
    expect(within(toolbar).getByLabelText("Disposition du clavier")).toBeTruthy();
    expect(within(toolbar).getByLabelText("Affichage")).toBeTruthy();
  });

  it("les contrôles de lecture et d'enregistrement sont présents", () => {
    render(<Piano />);
    const lecture = screen.getByRole("button", { name: /Lecture/ });
    expect(lecture).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Enregistrer/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importer/ })).toBeInTheDocument();
  });

  it("le bouton Paramètres ouvre un menu avec ses sections", () => {
    render(<Piano />);
    const settingsBtn = screen.getByRole("button", { name: /Paramètres/ });
    expect(settingsBtn).toHaveAttribute("aria-haspopup", "menu");
    expect(settingsBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(settingsBtn);
    const menu = screen.getByRole("menu", { name: "Paramètres" });
    expect(within(menu).getByRole("radiogroup", { name: "Étiquettes des touches" })).toBeTruthy();
    expect(within(menu).getByLabelText("Switch language (FR/EN)")).toBeTruthy();
    expect(within(menu).getByLabelText("Exporter la configuration")).toBeTruthy();
    expect(within(menu).getByLabelText("Importer la configuration")).toBeTruthy();
  });

  it("le bouton thème flottant est en haut à droite (aria-label)", () => {
    render(<Piano />);
    const themeBtn = screen.getByRole("button", { name: "Activer le thème clair" });
    expect(themeBtn.className).toContain("theme-toggle");
  });

  it("la boucle A-B expose ses trois champs", () => {
    render(<Piano />);
    expect(screen.getByText("Boucle A-B")).toBeInTheDocument();
    expect(screen.getByText(/s au total/)).toBeInTheDocument();
  });

  it("le clavier 88 touches est rendu avec ses labels accessibles", () => {
    render(<Piano />);
    const keyboard = screen.getByRole("group", {
      name: /Clavier de piano 88 touches/,
    });
    expect(within(keyboard).getByLabelText("Touche C4")).toBeTruthy();
    expect(within(keyboard).getByLabelText("Touche A0")).toBeTruthy();
    expect(within(keyboard).getByLabelText("Touche C8")).toBeTruthy();
  });

  it("les radios AZERTY/QWERTY et l'octave sont dans la toolbar", () => {
    render(<Piano />);
    expect(
      screen.getByRole("radio", { name: /AZERTY/i })
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /QWERTY/i })).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Octave de la fenêtre clavier PC" })
    ).toBeTruthy();
    expect(screen.getByText("C3")).toBeInTheDocument();
  });
});
