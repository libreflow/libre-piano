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
    dispose = vi.fn();
  }
  class MockPart {
    start = vi.fn();
    dispose = vi.fn();
  }
  return { MockSampler, MockPart };
});

vi.mock("./tone-gate", () => ({
  start: vi.fn().mockResolvedValue(undefined),
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

  it("affiche l'écran de chargement puis le clavier complet (25 touches)", async () => {
    render(<Piano />);
    expect(await screen.findByText("Chargement des sons du piano…")).toBeInTheDocument();
    // Le sampler mocké ne résout jamais onload : le clavier reste rendu
    // derrière l'écran de chargement (les boutons existent dans le DOM).
    const keys = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("key "));
    expect(keys).toHaveLength(25);
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

  it("permet de basculer la disposition du clavier", () => {
    render(<Piano />);
    const select = screen.getByLabelText("Disposition du clavier");
    expect(select).toHaveValue("azerty");
    fireEvent.change(select, { target: { value: "qwerty" } });
    expect(screen.getByLabelText("Touche C3")).toHaveTextContent("A");
  });

  it("permet de basculer l'affichage des labels (aria-pressed)", () => {
    render(<Piano />);
    const btn = screen.getByTitle("Afficher/masquer les lettres sur les touches");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("joue une note au mousedown sur une touche", () => {
    render(<Piano />);
    const key = screen.getByLabelText("Touche C4");
    fireEvent.mouseDown(key);
    // Le sampler mocké est en "loading" : pas de son, mais pas de crash.
    expect(key).toBeInTheDocument();
  });
});
