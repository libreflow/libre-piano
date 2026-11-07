// Timbres (roadmap #21) : validation des ids, du repli sur le piano et
// de la présence des libellés i18n — le sélecteur ne doit jamais rendre
// une clé brute ("voiceEpiano") à l'utilisateur.

import { describe, expect, it } from "vitest";
import { VOICES, DEFAULT_VOICE, getVoice, sanitizeVoice } from "./voices";
import { DICTIONARIES } from "./i18n";

describe("voices (roadmap #21)", () => {
  it("les ids sont uniques et le piano est la voix par défaut", () => {
    const ids = VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_VOICE).toBe("piano");
    expect(VOICES[0].id).toBe("piano");
  });

  it("le piano est le seul sampler ; les autres voix sont des synthés configurés avec un gain de normalisation", () => {
    for (const v of VOICES) {
      if (v.id === "piano") {
        expect(v.engine).toBe("sampler");
        expect(v.options).toBeNull();
      } else {
        expect(v.engine === "fm" || v.engine === "partials").toBe(true);
        expect(v.options).not.toBeNull();
        // Roadmap #29 : gain de normalisation, jamais un boost absurde.
        expect(v.gainDb).toBeLessThanOrEqual(0);
        expect(v.gainDb).toBeGreaterThanOrEqual(-24);
        // Release de la voix défini (restauré après la pédale).
        expect(v.releaseSec).toBeGreaterThan(0);
      }
    }
  });

  it("getVoice résout chaque id que sanitizeVoice accepte", () => {
    for (const v of VOICES) {
      expect(getVoice(v.id).id).toBe(v.id);
      expect(sanitizeVoice(v.id)).toBe(v.id);
    }
  });

  it("sanitizeVoice : toute valeur inconnue retombe sur le piano", () => {
    expect(sanitizeVoice("quitepasunvoice")).toBe("piano");
    expect(sanitizeVoice(42)).toBe("piano");
    expect(sanitizeVoice(null)).toBe("piano");
    expect(sanitizeVoice(undefined)).toBe("piano");
    expect(sanitizeVoice({ id: "organ" })).toBe("piano");
  });

  it("chaque voix expose un libellé présent dans les deux dictionnaires", () => {
    for (const v of VOICES) {
      expect(DICTIONARIES.fr[v.labelKey]).toBeTruthy();
      expect(DICTIONARIES.en[v.labelKey]).toBeTruthy();
    }
    expect(DICTIONARIES.fr.voiceGroup).toBeTruthy();
    expect(DICTIONARIES.en.voiceGroup).toBeTruthy();
  });
});
