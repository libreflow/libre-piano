// Persistance locale (localStorage) des morceaux importés et des
// préférences utilisateur, pour qu'ils survivent à la fermeture de l'app
// (roadmap #56, #58).
import type { Song } from "./songs";
import { SPEED_DEFAULT_PERCENT, VOLUME_DEFAULT_PERCENT } from "./constants";

const STORAGE_KEY = "libre-piano:state:v1";

export interface PersistedState {
  importedSongs: Song[];
  selectedSongId: string | null;
  speed: number;
  volume: number;
  showKeyLabels: boolean;
  theme: "dark" | "light";
}

export const DEFAULT_STATE: PersistedState = {
  importedSongs: [],
  selectedSongId: null,
  speed: SPEED_DEFAULT_PERCENT,
  volume: VOLUME_DEFAULT_PERCENT,
  showKeyLabels: true,
  theme: "dark",
};

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    // localStorage indisponible ou JSON corrompu : on repart des valeurs
    // par défaut plutôt que de faire planter l'app.
    return { ...DEFAULT_STATE };
  }
}

export function savePersistedState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota dépassé ou stockage désactivé : on ignore silencieusement,
    // ce n'est pas une fonctionnalité critique.
  }
}
