import { describe, expect, it } from "vitest";
import {
  getKeyboardLayout,
  getKeyToNote,
  getWhitePositionOfNote,
  getWindowKeyMap,
  noteToSolfege,
  MAX_MIDI,
  MIN_MIDI,
  clampMidiToKeyboard,
  midiToNoteName,
} from "./notes";

describe("midiToNoteName", () => {
  it("convertit les notes de référence", () => {
    expect(midiToNoteName(60)).toBe("C4");
    expect(midiToNoteName(61)).toBe("C#4");
    expect(midiToNoteName(48)).toBe("C3");
    expect(midiToNoteName(72)).toBe("C5");
    expect(midiToNoteName(69)).toBe("A4");
  });

  it("gère les octaves extrêmes", () => {
    expect(midiToNoteName(0)).toBe("C-1");
    expect(midiToNoteName(21)).toBe("A0");
    expect(midiToNoteName(108)).toBe("C8");
    expect(midiToNoteName(127)).toBe("G9");
  });
});

describe("clampMidiToKeyboard", () => {
  it(" laisse inchangées les notes déjà dans la plage", () => {
    for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
      expect(clampMidiToKeyboard(m)).toBe(m);
    }
  });

  it("transpose par octaves entières hors A0–C8", () => {
    expect(clampMidiToKeyboard(36)).toBe(36); // C2 : dans la plage 88
    expect(clampMidiToKeyboard(84)).toBe(84); // C6 : dans la plage 88
    expect(clampMidiToKeyboard(0)).toBe(24); // sous A0 -> +12
    expect(clampMidiToKeyboard(127)).toBe(103); // G9 -> descend à G7 (≤ C8)
  });

  it("produit toujours une note jouable sur le clavier 88 touches", () => {
    for (let m = 0; m <= 127; m++) {
      const c = clampMidiToKeyboard(m);
      expect(c).toBeGreaterThanOrEqual(MIN_MIDI);
      expect(c).toBeLessThanOrEqual(MAX_MIDI);
      expect(Math.abs((c - m) % 12)).toBe(0);
    }
  });
});

describe("layout du clavier", () => {
  it("génère les 88 touches du piano (52 blanches, 36 noires)", () => {
    const { keys, whiteKeyCount } = getKeyboardLayout();
    expect(keys).toHaveLength(88);
    expect(whiteKeyCount).toBe(52);
    expect(keys.filter((k) => !k.isBlack)).toHaveLength(52);
    expect(keys[0].note).toBe("A0");
    expect(keys[keys.length - 1].note).toBe("C8");
  });

  it("mappe chaque touche PC à une note unique (qwerty et azerty, 25 touches)", () => {
    for (const layout of ["qwerty", "azerty"] as const) {
      const map = getKeyToNote(layout);
      const notes = Object.values(map);
      expect(new Set(notes).size).toBe(notes.length);
      expect(Object.keys(map).length).toBe(25);
    }
  });

  it("dispose le QWERTY sur la rangée home ASDF", () => {
    const qwerty = getKeyToNote("qwerty");
    expect(qwerty["a"]).toBe("C3");
    expect(qwerty["t"]).toBe("C5");
    expect(qwerty["z"]).toBe("C#3");
    expect(qwerty["2"]).toBe("F#4");
  });

  it("dispose l'AZERTY sur la rangée home QSDF (sans Shift)", () => {
    const azerty = getKeyToNote("azerty");
    expect(azerty["q"]).toBe("C3");
    expect(azerty["t"]).toBe("C5");
    expect(azerty["w"]).toBe("C#3");
    // touches noires aiguîs accessibles sans Shift sur AZERTY français
    expect(azerty["é"]).toBe("F#4");
    expect(azerty['"']).toBe("G#4");
    expect(azerty["'"]).toBe("A#4");
  });

  it("calcule les index de position des touches (géométrie 88)", () => {
    const { keys } = getKeyboardLayout();
    const c4 = keys.find((k) => k.note === "C4")!;
    expect(c4.whiteIndex).toBeLessThan(52);
    // la fenêtre PC couvre bien C3 -> C5 dans les deux dispositions
    expect(getKeyToNote("azerty")["q"]).toBe("C3");
    expect(getKeyToNote("qwerty")["t"]).toBe("C5");
  });
});

describe("noteToSolfege", () => {
  it("convertit les notes naturelles", () => {
    expect(noteToSolfege("C4")).toBe("Do");
    expect(noteToSolfege("D3")).toBe("Ré");
    expect(noteToSolfege("E5")).toBe("Mi");
    expect(noteToSolfege("F4")).toBe("Fa");
    expect(noteToSolfege("G4")).toBe("Sol");
    expect(noteToSolfege("A3")).toBe("La");
    expect(noteToSolfege("B4")).toBe("Si");
  });

  it("convertit les dièses", () => {
    expect(noteToSolfege("C#3")).toBe("Do#");
    expect(noteToSolfege("D#4")).toBe("Ré#");
    expect(noteToSolfege("F#4")).toBe("Fa#");
    expect(noteToSolfege("A#4")).toBe("La#");
  });
});

describe("décalage d'octave de la fenêtre PC", () => {
  it("déplace la fenêtre d'une octave vers le haut", () => {
    const map = getKeyToNote("qwerty", 1);
    expect(map["a"]).toBe("C4");
    expect(map["t"]).toBe("C6");
  });

  it("déplace la fenêtre d'une octave vers le bas", () => {
    const map = getKeyToNote("azerty", -1);
    expect(map["q"]).toBe("C2");
  });

  it("les étiquettes suivent le décalage", () => {
    const labels = getWindowKeyMap("qwerty", 2);
    expect(labels.get("C5")).toBe("A");
  });

  it("trouve la position d'une note pour l'auto-scroll", () => {
    expect(getWhitePositionOfNote("C4")).toBeGreaterThan(0);
    expect(getWhitePositionOfNote("X")).toBe(-1);
  });
});

describe("position exacte des notes (auto-scroll)", () => {
  it("positionne une blanche sur son index", () => {
    const { keys } = getKeyboardLayout();
    const c4 = keys.find((k) => k.note === "C4")!;
    expect(getWhitePositionOfNote("C4")).toBe(c4.whiteIndex);
  });

  it("positionne une noire entre sa blanche et la suivante", () => {
    const { keys } = getKeyboardLayout();
    const cs4 = keys.find((k) => k.note === "C#4")!;
    const pos = getWhitePositionOfNote("C#4");
    expect(pos).toBeGreaterThan(cs4.whiteIndex);
    expect(pos).toBeLessThan(cs4.whiteIndex + 1);
  });

  it("retourne -1 pour une note inexistante", () => {
    expect(getWhitePositionOfNote("X")).toBe(-1);
  });
});
