// Détection d'accords (hors-piste) : reconnaissance par classes de
// hauteur, indépendante des octaves et des renversements.

import { describe, expect, it } from "vitest";
import { detectChord, pitchClasses } from "./chords";

describe("pitchClasses", () => {
  it("ignore les octaves et dédoublonne", () => {
    expect(pitchClasses(["C4", "E4", "G4", "C5", "E3"])).toEqual([0, 4, 7]);
  });

  it("ignore les notes inconnues", () => {
    expect(pitchClasses(["C4", "Z9"])).toEqual([0]);
  });
});

describe("detectChord", () => {
  it("triades majeures et mineures", () => {
    expect(detectChord(["C4", "E4", "G4"])).toBe("C");
    expect(detectChord(["A3", "C4", "E4"])).toBe("Am");
  });

  it("renversements : mêmes classes de hauteur, même accord", () => {
    expect(detectChord(["E4", "G4", "C5"])).toBe("C");
  });

  it("septièmes", () => {
    expect(detectChord(["G3", "B3", "D4", "F4"])).toBe("G7");
    expect(detectChord(["C4", "E4", "G4", "B4"])).toBe("Cmaj7");
    expect(detectChord(["E4", "G4", "B4", "D5"])).toBe("Em7");
  });

  it("sus, sixtes et diminuées", () => {
    expect(detectChord(["C4", "F4", "G4"])).toBe("Csus4");
    expect(detectChord(["C4", "E4", "G4", "A4"])).toBe("C6");
    expect(detectChord(["B3", "D4", "F4"])).toBe("Bdim");
  });

  it("null pour moins de trois notes ou ensembles non recognized", () => {
    expect(detectChord(["C4", "G4"])).toBeNull(); // power chord : ambigu
    expect(detectChord([])).toBeNull();
    // Cluster chromatique : pas un accord usuel.
    expect(detectChord(["C4", "C#4", "D4", "D#4", "E4"])).toBeNull();
  });
});
