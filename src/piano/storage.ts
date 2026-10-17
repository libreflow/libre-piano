// Persistance locale (localStorage) des morceaux importés et des
// préférences utilisateur, pour qu'ils survivent à la fermeture de l'app.

import type { KeyboardLayout, LabelMode } from "./notes";
import type { Song } from "./songs";
import { SPEED_DEFAULT_PERCENT, VOLUME_DEFAULT_PERCENT } from "./constants";

const STORAGE_KEY = "libre-piano:state";
export const STATE_VERSION = 2;

export interface PersistedState {
  version: number;
  importedSongs: Song[];
  selectedSongId: string | null;
  speed: number;
  volume: number;
  showKeyLabels: boolean;
  labelMode: LabelMode;
  keyboardLayout: KeyboardLayout;
  theme: "dark" | "light";
}

export const DEFAULT_STATE: PersistedState = {
  version: STATE_VERSION,
  importedSongs: [],
  selectedSongId: null,
  speed: SPEED_DEFAULT_PERCENT,
  volume: VOLUME_DEFAULT_PERCENT,
  showKeyLabels: true,
  labelMode: "lettres",
  keyboardLayout: "azerty",
  theme: "dark",
};

/** Migre un état d'une version antérieure vers la courante.
 * Chaque schéma cassé ajoute sa marche ici ; les états trop récents
 * (version inconnue > courante) repartent des défauts pour ne pas
 * corrompre l'app avec des champs inattendus. */
function migrate(parsed: Record<string, unknown>): PersistedState {
  let state = parsed;
  // v0 (pré-versioning, aka "v1" de la première clé) : showKeyLabels booléen.
  if (state.version === undefined) {
    state = { ...state, version: 1 };
  }
  // v1 -> v2 : labelMode remplace showKeyLabels seul.
  if ((state as { version: number }).version === 1) {
    state = {
      ...state,
      version: 2,
      labelMode:
        (state as { labelMode?: LabelMode }).labelMode ??
        ((state as { showKeyLabels?: boolean }).showKeyLabels === false
          ? "none"
          : "lettres"),
    };
  }
  if ((state as { version: number }).version !== STATE_VERSION) {
    return { ...DEFAULT_STATE };
  }
  return { ...DEFAULT_STATE, ...(state as Partial<PersistedState>) };
}

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:v${STATE_VERSION}`);
    // Clé historique (première version, sans suffixe) : la lire pour
    // ne pas perdre l'état des utilisateurs existants.
    const legacy = raw ?? localStorage.getItem("libre-piano:state:v1");
    if (!legacy) return { ...DEFAULT_STATE };
    return migrate(JSON.parse(legacy));
  } catch {
    // localStorage indisponible ou JSON corrompu : on repart des valeurs
    // par défaut plutôt que de faire planter l'app.
    return { ...DEFAULT_STATE };
  }
}

/** Sauvegarde l'état. Retourne false si le stockage a échoué
 * (quota dépassé, stockage désactivé) pour que l'app puisse avertir
 * l'utilisateur au lieu d'échouer silencieusement. */
export function savePersistedState(state: PersistedState): boolean {
  try {
    localStorage.setItem(
      `${STORAGE_KEY}:v${STATE_VERSION}`,
      JSON.stringify({ ...state, version: STATE_VERSION })
    );
    return true;
  } catch {
    return false;
  }
}
