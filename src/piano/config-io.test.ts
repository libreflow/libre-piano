import { describe, expect, it } from "vitest";
import { buildConfigFile, parseConfigFile } from "./config-io";
import { sanitizeState } from "./storage";

const baseState = {
  importedSongs: [
    {
      id: "i1",
      title: "Ma chanson",
      source: "imported" as const,
      events: [{ time: 0, note: "C4", duration: 0.5 }],
    },
  ],
  selectedSongId: "i1",
  speed: 110,
  volume: 70,
  showKeyLabels: true,
  labelMode: "lettres" as const,
  keyboardLayout: "azerty" as const,
  theme: "dark" as const,
};

describe("config-io (roadmap #62)", () => {
  it("buildConfigFile produit un export marqué libre-piano", () => {
    const cfg = buildConfigFile(baseState);
    expect(cfg.app).toBe("libre-piano");
    expect(cfg.version).toBe(1);
    expect(cfg.state.speed).toBe(110);
    expect(cfg.state.importedSongs).toHaveLength(1);
  });

  it("parseConfigFile accepte un export valide", () => {
    const cfg = buildConfigFile(baseState);
    expect(parseConfigFile(JSON.parse(JSON.stringify(cfg)))).not.toBeNull();
  });

  it("parseConfigFile rejette un JSON arbitraire", () => {
    expect(parseConfigFile({ hello: "world" })).toBeNull();
    expect(parseConfigFile(null)).toBeNull();
    expect(parseConfigFile("texte")).toBeNull();
  });

  it("un état importé passe par sanitize (vitesse hors bornes recalée)", () => {
    const clean = sanitizeState({ ...baseState, speed: 999, volume: "abc" });
    expect(clean.speed).toBe(150);
    expect(clean.volume).toBe(80);
    expect(clean.importedSongs).toHaveLength(1);
  });
});
