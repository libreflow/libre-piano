import { describe, expect, it } from "vitest";
import { DICTIONARIES, detectLanguage, translate, type Language } from "./i18n";

describe("i18n (roadmap #82)", () => {
  it("les deux langues couvrent exactement les mêmes clés", () => {
    const frKeys = Object.keys(DICTIONARIES.fr).sort();
    const enKeys = Object.keys(DICTIONARIES.en).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it("aucune valeur vide", () => {
    for (const lang of Object.keys(DICTIONARIES) as Language[]) {
      for (const [key, value] of Object.entries(DICTIONARIES[lang])) {
        expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("translate renvoie la traduction de la langue demandée", () => {
    expect(translate("en", "play")).toBe("Play");
    expect(translate("fr", "play")).toBe("Lecture");
  });

  it("translate replie sur FR puis sur la clé pour une clé inconnue", () => {
    expect(translate("en", "__inconnue__")).toBe("__inconnue__");
  });

  it("detectLanguage suit la langue du navigateur", () => {
    // jsdom : navigator.language existe ; on teste la cohérence du résultat.
    const lang = detectLanguage();
    expect(["fr", "en"]).toContain(lang);
  });
});
