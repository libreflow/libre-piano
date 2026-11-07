// Boucle A-B (audit Studio) : clamp des bornes à la saisie et
// pré-remplissage à l'activation — verrouille le comportement du tiroir.

import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import LoopControls from "./LoopControls";
import type { Language } from "../i18n";

const fr: Language = "fr";

const props = {
  loopEnabled: true,
  loopStart: 0,
  loopEnd: 0,
  songDuration: 30,
  isPlaying: false,
  language: fr,
  onToggle: vi.fn(),
  onStartChange: vi.fn(),
  onEndChange: vi.fn(),
};

function renderLoop(overrides: Partial<typeof props> = {}) {
  return render(<LoopControls {...props} {...overrides} />);
}

describe("LoopControls (audit Studio)", () => {
  it("clampe une borne saisie au-delà de la durée du morceau", () => {
    const onEndChange = vi.fn();
    const { getByLabelText } = renderLoop({ onEndChange });
    const end = getByLabelText("Fin") as HTMLInputElement;
    // L'utilisateur tape 999 alors que le morceau dure 30 s : la valeur
    // affichée/saisie doit être clampée, pas passée telle quelle.
    fireEvent.change(end, { target: { value: "999" } });
    expect(onEndChange).toHaveBeenCalledWith(30);
  });

  it("clampe une borne négative à 0", () => {
    const onStartChange = vi.fn();
    const { getByLabelText } = renderLoop({ onStartChange });
    const start = getByLabelText("Début") as HTMLInputElement;
    fireEvent.change(start, { target: { value: "-5" } });
    expect(onStartChange).toHaveBeenCalledWith(0);
  });

  it("passe la valeur valide telle quelle (pas de clamp parasites)", () => {
    const onEndChange = vi.fn();
    const { getByLabelText } = renderLoop({ onEndChange });
    const end = getByLabelText("Fin") as HTMLInputElement;
    fireEvent.change(end, { target: { value: "12.5" } });
    expect(onEndChange).toHaveBeenCalledWith(12.5);
  });

  it("n'ignore pas une saisie vide ou non numérique", () => {
    const onEndChange = vi.fn();
    const { getByLabelText } = renderLoop({ onEndChange });
    const end = getByLabelText("Fin") as HTMLInputElement;
    fireEvent.change(end, { target: { value: "" } });
    fireEvent.change(end, { target: { value: "abc" } });
    expect(onEndChange).not.toHaveBeenCalled();
  });
});
