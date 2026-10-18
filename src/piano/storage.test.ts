import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadPersistedState,
  savePersistedState,
  DEFAULT_STATE,
  getActiveProfile,
  setActiveProfile,
  listProfiles,
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
    const loaded = loadPersistedState();
    // language est déduit (non stocké dans l'objet de test) : comparer
    // sans lui, puis vérifier sa présence.
    const { language: _lang, ...rest } = loaded;
    void _lang;
    expect(rest).toEqual(state);
    expect(loaded.language).toBeDefined();
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

describe("roadmap #23 : réverbe persistée", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reverb absente (état v3 ancien) vaut 0 par défaut", () => {
    localStorage.setItem(
      "libre-piano:state:v3",
      JSON.stringify({ version: 3, theme: "dark" })
    );
    expect(loadPersistedState().reverb).toBe(0);
  });

  it("conserve la réverbe persistée et recale les valeurs hors bornes", () => {
    const state: PersistedState = { ...DEFAULT_STATE, reverb: 45 };
    expect(savePersistedState(state)).toBe(true);
    expect(loadPersistedState().reverb).toBe(45);
    localStorage.setItem(
      "libre-piano:state:v3",
      JSON.stringify({ version: 3, reverb: 400 })
    );
    expect(loadPersistedState().reverb).toBe(100);
  });
});

describe("roadmap #60 : favoris persistés", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("conserve le flag favorite des morceaux importés", () => {
    const state: PersistedState = {
      ...DEFAULT_STATE,
      importedSongs: [
        {
          id: "f1",
          title: "Favori",
          source: "imported",
          favorite: true,
          events: [{ time: 0, note: "C4", duration: 0.5 }],
        },
      ],
    };
    expect(savePersistedState(state)).toBe(true);
    expect(loadPersistedState().importedSongs[0].favorite).toBe(true);
  });

  it("retire un favorite invalide", () => {
    localStorage.setItem(
      "libre-piano:state:v3",
      JSON.stringify({
        version: 3,
        importedSongs: [
          {
            id: "f2",
            title: "X",
            source: "imported",
            favorite: "yes",
            events: [{ time: 0, note: "C4", duration: 0.5 }],
          },
        ],
      })
    );
    expect(loadPersistedState().importedSongs[0].favorite).toBeUndefined();
  });
});

describe("roadmap #24 : égaliseur persisté", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("eq absent (état antérieur) vaut neutre", () => {
    localStorage.setItem(
      "libre-piano:state:v3",
      JSON.stringify({ version: 3, theme: "dark" })
    );
    expect(loadPersistedState().eq).toEqual({ low: 0, mid: 0, high: 0 });
  });

  it("conserve l'eq persisté et recale les bandes hors bornes", () => {
    const state: PersistedState = {
      ...DEFAULT_STATE,
      eq: { low: 6, mid: -3, high: 2 },
    };
    expect(savePersistedState(state)).toBe(true);
    expect(loadPersistedState().eq).toEqual({ low: 6, mid: -3, high: 2 });
    localStorage.setItem(
      "libre-piano:state:v3",
      JSON.stringify({ version: 3, eq: { low: 99, mid: "abc", high: -99 } })
    );
    expect(loadPersistedState().eq).toEqual({ low: 12, mid: 0, high: -12 });
  });
});

describe("roadmap #63 : profils utilisateurs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("profil par défaut sans sélection", () => {
    expect(getActiveProfile()).toBe("default");
    expect(listProfiles()).toEqual(["default"]);
  });

  it("chaque profil a ses données indépendantes", () => {
    const stateA: PersistedState = { ...DEFAULT_STATE, speed: 90 };
    expect(savePersistedState(stateA)).toBe(true);
    setActiveProfile("alice");
    // alice n'a rien encore : défauts ; puis elle sauvegarde sa vitesse.
    expect(loadPersistedState().speed).toBe(DEFAULT_STATE.speed);
    const stateB: PersistedState = { ...DEFAULT_STATE, speed: 140 };
    expect(savePersistedState(stateB)).toBe(true);
    expect(loadPersistedState().speed).toBe(140);
    // retour au profil par défaut : les données d'origine sont intactes.
    setActiveProfile("default");
    expect(loadPersistedState().speed).toBe(90);
    // alice apparaît dans la liste.
    expect(listProfiles()).toContain("alice");
  });
});
