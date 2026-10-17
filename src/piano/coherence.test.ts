import { describe, expect, it } from "vitest";
import { getKeyToNote, getWindowKeyMap } from "./notes";

// Cohérence étiquettes affichées <-> notes jouées pour CHAQUE shift.
// Si la lettre K est affichée sur la touche C4, presser K doit jouer C4.
describe("cohérence labels PC <-> notes jouées par shift", () => {
  it("getWindowKeyMap et getKeyToNote sont inverses pour chaque shift", () => {
    for (let shift = -3; shift <= 3; shift++) {
      const labels = getWindowKeyMap("azerty", shift);
      const map = getKeyToNote("azerty", shift);
      for (const [note, label] of labels) {
        // l'étiquette 'label' affichée sur 'note' doit jouer 'note'
        expect(map[label.toLowerCase()]).toBe(note);
      }
    }
  });
});
