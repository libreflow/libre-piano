// Export / import de la configuration complète (roadmap #62) : permet de
// déménager ses morceaux importés et préférences vers une autre machine.
// Le format est exactement celui du localStorage (PersistedState), passé
// par le même sanitize que le chargement — un fichier importé est donc
// sûr par construction.

import type { KeyboardLayout, LabelMode } from "./notes";
import type { Song } from "./songs";

export interface ConfigFile {
  app: "libre-piano";
  version: number;
  exportedAt: string;
  state: {
    importedSongs: Song[];
    selectedSongId: string | null;
    speed: number;
    volume: number;
    showKeyLabels: boolean;
    labelMode: LabelMode;
    keyboardLayout: KeyboardLayout;
    theme: "dark" | "light";
  };
}

/** Construit l'objet exportable depuis un PersistedState. */
export function buildConfigFile(
  state: Omit<ConfigFile["state"], never> & object
): ConfigFile {
  return {
    app: "libre-piano",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: {
      importedSongs: state.importedSongs,
      selectedSongId: state.selectedSongId,
      speed: state.speed,
      volume: state.volume,
      showKeyLabels: state.showKeyLabels,
      labelMode: state.labelMode,
      keyboardLayout: state.keyboardLayout,
      theme: state.theme,
    },
  };
}

/**
 * Valide un fichier de configuration parsé. Retourne null si ce n'est pas
 * un export Libre Piano (l'app ne doit jamais importer un JSON arbitraire).
 * Les champs sont validés par sanitize() côté appelant.
 */
export function parseConfigFile(raw: unknown): ConfigFile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const cfg = raw as Partial<ConfigFile>;
  if (cfg.app !== "libre-piano" || typeof cfg.version !== "number" || !cfg.state) {
    return null;
  }
  if (!Array.isArray(cfg.state.importedSongs)) return null;
  return cfg as ConfigFile;
}
