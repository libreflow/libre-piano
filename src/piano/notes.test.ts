import { describe, expect, it } from "vitest";
import {
  getKeys,
  getKeyToNote,
  noteToSolfege,
  MAX_MIDI,
  MIN_MIDI,
  WHITE_KEY_COUNT,
  blackKeyAfterIndex,
  clampMidiToKeyboard,
  midiToNoteName,
  whiteKeyIndex,
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

  it("transpose par octaves entières", () => {
    expect(clampMidiToKeyboard(36)).toBe(48);
    expect(clampMidiToKeyboard(84)).toBe(72);
    expect(clampMidiToKeyboard(0)).toBe(48);
    expect(clampMidiToKeyboard(127)).toBe(67);
  });

  it("produit toujours une note jouable sur le clavier", () => {
    for (let m = 0; m <= 127; m++) {
      const c = clampMidiToKeyboard(m);
      expect(c).toBeGreaterThanOrEqual(MIN_MIDI);
      expect(c).toBeLessThanOrEqual(MAX_MIDI);
      expect(Math.abs((c - m) % 12)).toBe(0);
    }
  });
});

describe("layout du clavier", () => {
  it("a 15 touches blanches et 10 noires (C3–C5) pour chaque disposition", () => {
    expect(WHITE_KEY_COUNT).toBe(15);
    for (const layout of ["qwerty", "azerty"] as const) {
      const keys = getKeys(layout);
      expect(keys.filter((k) => !k.isBlack)).toHaveLength(15);
      expect(keys.filter((k) => k.isBlack)).toHaveLength(10);
    }
  });

  it("mappe chaque touche PC à une note unique (qwerty et azerty)", () => {
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

  it("calcule les index de position", () => {
    expect(whiteKeyIndex("C3")).toBe(0);
    expect(whiteKeyIndex("C4")).toBe(7);
    expect(whiteKeyIndex("C5")).toBe(14);
    expect(whiteKeyIndex("X")).toBe(-1);
    expect(blackKeyAfterIndex("C#3")).toBe(0);
    expect(blackKeyAfterIndex("A#4")).toBe(12);
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
