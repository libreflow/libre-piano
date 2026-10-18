// Persistance locale (localStorage) des morceaux importés et des
// préférences utilisateur, pour qu'ils survivent à la fermeture de l'app.

import type { KeyboardLayout, LabelMode } from "./notes";
import type { Song, SongEvent } from "./songs";
import {
  REVERB_DEFAULT_PERCENT,
  SPEED_DEFAULT_PERCENT,
  VOLUME_DEFAULT_PERCENT,
} from "./constants";
import { TRANSPOSE_MIN, TRANSPOSE_MAX } from "./transpose";
import { EQ_DEFAULT_DB, EQ_MIN_DB, EQ_MAX_DB } from "./constants";

const STORAGE_KEY = "libre-piano:state";
/** Clé du profil actif (roadmap #63) : indépendante des données. */
const PROFILE_KEY = "libre-piano:profile";

/** Nom du profil par défaut. */
export const DEFAULT_PROFILE = "default";

/** Nom du profil actif, validé. */
export function getActiveProfile(): string {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw && raw.length > 0 ? raw : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

/** Change de profil (les données de chaque profil vivent dans des
 * clés séparées, rien à migrer). */
export function setActiveProfile(profile: string): void {
  try {
    localStorage.setItem(PROFILE_KEY, profile);
  } catch {
    // Stockage indisponible : le profil ne survivra pas, sans crash.
  }
}

/** Liste les profils existants (dérivée des clés de données). */
export function listProfiles(): string[] {
  const profiles = new Set<string>([DEFAULT_PROFILE]);
  try {
    const prefix = `${STORAGE_KEY}:v${STATE_VERSION}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const profile = key.slice(prefix.length);
        if (profile.length > 0) profiles.add(profile);
      }
    }
  } catch {
    // localStorage indisponible : profil par défaut seul.
  }
  return [...profiles];
}
export const STATE_VERSION = 3;

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
  /** Réverbe : part wet en % (roadmap #23). */
  reverb: number;
  /** Transposition des morceaux en demi-tons (roadmap #53). */
  transpose: number;
  /** Égaliseur 3 bandes en dB (roadmap #24). */
  eq: { low: number; mid: number; high: number };
  /** Visualiseur audio activé (roadmap #30). */
  visualizer?: boolean;
  /** Raccourcis personnalisés (roadmap #65), codes physiques. */
  shortcuts?: { sustain: string; togglePlayback: string };
  /** Langue de l'interface (roadmap #82). */
  language?: "fr" | "en";
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
  reverb: REVERB_DEFAULT_PERCENT,
  transpose: 0,
  eq: { low: EQ_DEFAULT_DB, mid: EQ_DEFAULT_DB, high: EQ_DEFAULT_DB },
  shortcuts: { sustain: "Space", togglePlayback: "Enter" },
};

/** Validation d'un état chargé : sans ça, un localStorage corrompu
 * (speed: "abc", labelMode inconnu...) produit des NaN silencieux qui
 * cassent la lecture auto. Chaque champ est ramené à un type sûr. */
/** Valide un état brut (localStorage ou import de configuration) : chaque
 * champ inconnu/corrompu est ramené à une valeur sûre. */
export function sanitizeState(raw: Partial<PersistedState>): PersistedState {
  return sanitize(raw);
}

function sanitize(raw: Partial<PersistedState>): PersistedState {
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  const labelMode =
    raw.labelMode === "lettres" ||
    raw.labelMode === "solfege" ||
    raw.labelMode === "both" ||
    raw.labelMode === "none"
      ? raw.labelMode
      : DEFAULT_STATE.labelMode;
  const keyboardLayout =
    raw.keyboardLayout === "azerty" || raw.keyboardLayout === "qwerty"
      ? raw.keyboardLayout
      : DEFAULT_STATE.keyboardLayout;
  const theme =
    raw.theme === "dark" || raw.theme === "light" ? raw.theme : DEFAULT_STATE.theme;
  // Réverbe absente (états v3 antérieurs) : défaut sec.
  const reverb = num(raw.reverb, DEFAULT_STATE.reverb, 0, 100);
  const transpose = num(raw.transpose, 0, TRANSPOSE_MIN, TRANSPOSE_MAX);
  // Égaliseur : états antérieurs sans eq -> neutre.
  const eqRaw = raw.eq as { low?: unknown; mid?: unknown; high?: unknown } | undefined;
  const eq = {
    low: num(eqRaw?.low, EQ_DEFAULT_DB, EQ_MIN_DB, EQ_MAX_DB),
    mid: num(eqRaw?.mid, EQ_DEFAULT_DB, EQ_MIN_DB, EQ_MAX_DB),
    high: num(eqRaw?.high, EQ_DEFAULT_DB, EQ_MIN_DB, EQ_MAX_DB),
  };
  return {
    ...DEFAULT_STATE,
    ...raw,
    speed: num(raw.speed, DEFAULT_STATE.speed, 50, 150),
    volume: num(raw.volume, DEFAULT_STATE.volume, 0, 100),
    showKeyLabels: typeof raw.showKeyLabels === "boolean" ? raw.showKeyLabels : true,
    labelMode,
    keyboardLayout,
    theme,
    reverb,
    transpose,
    eq,
    visualizer: raw.visualizer === true ? true : undefined,
    language: raw.language === "en" ? "en" : "fr",
    shortcuts: {
      sustain:
        typeof (raw.shortcuts as { sustain?: unknown } | undefined)?.sustain ===
          "string" && (raw.shortcuts as { sustain: string }).sustain.length > 0
          ? (raw.shortcuts as { sustain: string }).sustain
          : DEFAULT_STATE.shortcuts!.sustain,
      togglePlayback:
        typeof (raw.shortcuts as { togglePlayback?: unknown } | undefined)
          ?.togglePlayback === "string" &&
        (raw.shortcuts as { togglePlayback: string }).togglePlayback.length > 0
          ? (raw.shortcuts as { togglePlayback: string }).togglePlayback
          : DEFAULT_STATE.shortcuts!.togglePlayback,
    },
    importedSongs: Array.isArray(raw.importedSongs)
      ? raw.importedSongs
          .filter(
            (song) =>
              song &&
              typeof song.id === "string" &&
              typeof song.title === "string" &&
              Array.isArray(song.events)
          )
          .map((song): Song => ({
            ...song,
            favorite: song.favorite === true ? true : undefined,
            // Chaque événement doit avoir des temps finis >= 0 et une
            // note valide : un event corrompu produirait des NaN dans
            // le Part de lecture.
            events: song.events
              .filter(
                (ev: unknown): ev is { time: number; note: string; duration: number } =>
                  typeof ev === "object" &&
                  ev !== null &&
                  Number.isFinite((ev as { time?: unknown }).time) &&
                  (ev as { time: number }).time >= 0 &&
                  Number.isFinite((ev as { duration?: unknown }).duration) &&
                  (ev as { duration: number }).duration > 0 &&
                  typeof (ev as { note?: unknown }).note === "string"
              )
              .map((ev): SongEvent => {
                const v = (ev as { velocity?: unknown }).velocity;
                // Vélocité invalide ou nulle : on la retire (intensité pleine).
                if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
                  const { velocity: _drop, ...rest } = ev as { velocity?: unknown };
                  void _drop;
                  return rest as SongEvent;
                }
                return { ...ev, velocity: Math.min(1, v) };
              }),
          }))
          .filter((song) => song.events.length > 0)
      : [],
  };
}

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
  // v2 -> v3 : ajout du thème ("dark" par défaut, l'existant reste sombre).
  if ((state as { version: number }).version === 2) {
    state = {
      ...state,
      version: 3,
      theme: (state as { theme?: "dark" | "light" }).theme ?? "dark",
    };
  }
  if ((state as { version: number }).version !== STATE_VERSION) {
    return { ...DEFAULT_STATE };
  }
  return sanitize(state as Partial<PersistedState>);
}

export function loadPersistedState(): PersistedState {
  try {
    // Repli sur les clés des versions précédentes (v2, puis v1
    // historique) pour ne jamais perdre l'état des utilisateurs existants ;
    // migrate() les ramène au format courant.
    const profile = getActiveProfile();
    const profileSuffix = profile === DEFAULT_PROFILE ? "" : `:${profile}`;
    // Clés de repli : l'état historique sans suffixe n'appartient qu'au
    // profil par défaut (l'utilisateur existant garde ses données) ; un
    // profil nommé neuf part des défauts.
    const fallbacks =
      profile === DEFAULT_PROFILE
        ? [
            `libre-piano:state:v${STATE_VERSION}`,
            `libre-piano:state:v${STATE_VERSION - 1}`,
            "libre-piano:state:v1",
          ]
        : [`libre-piano:state:v${STATE_VERSION - 1}`, "libre-piano:state:v1"];
    const raw =
      localStorage.getItem(`libre-piano:state:v${STATE_VERSION}${profileSuffix}`) ??
      fallbacks.map((k) => localStorage.getItem(k)).find((v) => v !== null) ??
      null;
    if (!raw) return { ...DEFAULT_STATE };
    return migrate(JSON.parse(raw));
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
    const profile = getActiveProfile();
    const profileSuffix = profile === DEFAULT_PROFILE ? "" : `:${profile}`;
    localStorage.setItem(
      `${STORAGE_KEY}:v${STATE_VERSION}${profileSuffix}`,
      JSON.stringify({ ...state, version: STATE_VERSION })
    );
    return true;
  } catch {
    return false;
  }
}
