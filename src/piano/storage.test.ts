import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadPersistedState,
  savePersistedState,
  DEFAULT_STATE,
  type PersistedState,
} from "./storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retourne l'état par défaut sans sauvegarde", () => {
    expect(loadPersistedState()).toEqual(DEFAULT_STATE);
  });

  it("sauvegarde et recharge un état complet", () => {
    const state: PersistedState = {
      ...DEFAULT_STATE,
      speed: 120,
      volume: 50,
      labelMode: "solfege",
      keyboardLayout: "qwerty",
      selectedSongId: "au-clair-de-la-lune",
    };
    expect(savePersistedState(state)).toBe(true);
    expect(loadPersistedState()).toEqual(state);
  });

  it("retourne false quand le quota est dépassé", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(savePersistedState(DEFAULT_STATE)).toBe(false);
    setItem.mockRestore();
  });

  it("migre l'ancien format v1 (showKeyLabels booléen, sans version)", () => {
    localStorage.setItem(
      "libre-piano:state:v1",
      JSON.stringify({ speed: 90, showKeyLabels: true, keyboardLayout: "qwerty" })
    );
    const state = loadPersistedState();
    expect(state.version).toBe(3);
    expect(state.speed).toBe(90);
    expect(state.keyboardLayout).toBe("qwerty");
    // showKeyLabels=true -> labelMode "lettres"
    expect(state.labelMode).toBe("lettres");
  });

  it("migre showKeyLabels=false vers labelMode none", () => {
    localStorage.setItem(
      "libre-piano:state:v1",
      JSON.stringify({ showKeyLabels: false })
    );
    expect(loadPersistedState().labelMode).toBe("none");
  });

  it("repart des défauts sur JSON corrompu", () => {
    localStorage.setItem("libre-piano:state:v2", "{not json");
    expect(loadPersistedState()).toEqual(DEFAULT_STATE);
  });

  it("repart des défauts sur une version trop récente inconnue", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({ version: 99, speed: 999 })
    );
    expect(loadPersistedState()).toEqual(DEFAULT_STATE);
  });
});

describe("sanitization des valeurs corrompues (régression NaN)", () => {
  it("répare un speed corrompu (string) en valeur par défaut", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({ version: 2, speed: "abc", volume: 130 })
    );
    const state = loadPersistedState();
    expect(state.speed).toBe(100); // fallback
    expect(state.volume).toBe(100); // clampé à 100
  });

  it("répare un labelMode inconnu", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({ version: 2, labelMode: "nonsense" })
    );
    expect(loadPersistedState().labelMode).toBe("lettres");
  });

  it("répare un keyboardLayout inconnu", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({ version: 2, keyboardLayout: "dvorak" })
    );
    expect(loadPersistedState().keyboardLayout).toBe("azerty");
  });

  it("élimine les morceaux importés malformés", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({
        version: 2,
        importedSongs: [
          {
            id: "ok",
            title: "OK",
            source: "imported",
            events: [{ time: 0, note: "C4", duration: 0.5 }],
          },
          { id: 42, title: "sans events" },
          "pas un morceau",
        ],
      })
    );
    const state = loadPersistedState();
    expect(state.importedSongs).toHaveLength(1);
    expect(state.importedSongs[0].id).toBe("ok");
  });
});

describe("régression : événements corrompus dans les morceaux persistés", () => {
  it("filtre les événements aux temps/durées non finis (NaN dans le Part)", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({
        version: 2,
        importedSongs: [
          {
            id: "s1",
            title: "Corrompu",
            source: "imported",
            events: [
              { time: 0, note: "C4", duration: 0.5 }, // valide
              { time: "abc", note: "D4", duration: 0.5 }, // time corrompu
              { time: 1, note: "E4", duration: NaN }, // duration NaN
              { time: -2, note: "F4", duration: 0.5 }, // time négatif
              { time: 2, duration: 0.5 }, // note manquante
            ],
          },
        ],
      })
    );
    const state = loadPersistedState();
    expect(state.importedSongs).toHaveLength(1);
    expect(state.importedSongs[0].events).toHaveLength(1);
    expect(state.importedSongs[0].events[0].note).toBe("C4");
  });

  it("élimine un morceau dont tous les événements sont corrompus", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({
        version: 2,
        importedSongs: [
          { id: "s1", title: "Vide", source: "imported", events: [{ time: "x" }] },
        ],
      })
    );
    expect(loadPersistedState().importedSongs).toHaveLength(0);
  });
});

describe("roadmap #64 : thème clair/sombre persisté (v3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migre un état v2 en v3 avec thème dark par défaut", () => {
    localStorage.setItem(
      "libre-piano:state:v2",
      JSON.stringify({ version: 2, speed: 90 })
    );
    const state = loadPersistedState();
    expect(state.version).toBe(3);
    expect(state.theme).toBe("dark");
    expect(state.speed).toBe(90);
  });

  it("conserve un thème light persisté", () => {
    const state: PersistedState = { ...DEFAULT_STATE, theme: "light" };
    expect(savePersistedState(state)).toBe(true);
    expect(loadPersistedState().theme).toBe("light");
  });

  it("repart sur dark si le thème persisté est invalide", () => {
    localStorage.setItem(
      "libre-piano:state:v3",
      JSON.stringify({ version: 3, theme: "neon" })
    );
    expect(loadPersistedState().theme).toBe("dark");
  });
});
