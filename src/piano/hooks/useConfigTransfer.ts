// Export / import de la configuration (extrait de Piano.tsx, roadmap #62) :
// télécharge un JSON (morceaux importés + préférences) transférable vers une
// autre machine, et restaure tous les champs exportés (B1 : import symétrique).
// E13 : flash visuel bref après un import réussi.

import { useCallback, useEffect, useRef, useState } from "react";
import { buildConfigFile, parseConfigFile } from "../config-io";
import { sanitizeState, DEFAULT_STATE } from "../storage";
import { detectLanguage, interpolate, type Language } from "../i18n";
import { DEFAULT_SHORTCUTS, type ShortcutConfig } from "../useKeyboardInput";
import type { LabelMode } from "../notes";
import type { KeyboardLayout } from "../notes";
import type { PersistedState } from "../storage";

export interface ConfigPrefs {
  importedSongs: PersistedState["importedSongs"];
  selectedSongId: string;
  speed: number;
  volume: number;
  labelMode: LabelMode;
  keyboardLayout: KeyboardLayout;
  theme: "dark" | "light";
  reverb: number;
  transpose: number;
  eq: { low: number; mid: number; high: number };
  visualizer: boolean;
  shortcuts: ShortcutConfig;
  language: Language;
}

export interface ConfigTransferApi {
  exportConfig: () => void;
  importConfig: (file: File) => Promise<void>;
  configFlash: boolean;
}

/** Applique les préférences importées via des setters injectés. */
export function useConfigTransfer(
  prefs: ConfigPrefs,
  setters: {
    setSpeed: (v: number) => void;
    setVolume: (v: number) => void;
    setLabelMode: (v: LabelMode) => void;
    setKeyboardLayout: (v: KeyboardLayout) => void;
    setTheme: (v: "dark" | "light") => void;
    setReverb: (v: number) => void;
    setTranspose: (v: number) => void;
    setEq: (v: { low: number; mid: number; high: number }) => void;
    setShowVisualizer: (v: boolean) => void;
    setShortcuts: (v: ShortcutConfig) => void;
    setLanguage: (v: Language) => void;
    setImportedSongs: (songs: PersistedState["importedSongs"]) => void;
  },
  statusMessage: (msg: string) => void,
  t: (key: string) => string
): ConfigTransferApi {
  const [configFlash, setConfigFlash] = useState(false);
  const configFlashTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (configFlashTimerRef.current !== null) {
        window.clearTimeout(configFlashTimerRef.current);
      }
    },
    []
  );

  const exportConfig = useCallback(() => {
    const cfg = buildConfigFile({
      ...DEFAULT_STATE,
      ...prefs,
      showKeyLabels: prefs.labelMode !== "none",
    });
    const blob = new Blob([JSON.stringify(cfg, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "libre-piano-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [prefs]);

  const importConfig = useCallback(
    async (file: File) => {
      try {
        const parsed = parseConfigFile(JSON.parse(await file.text()));
        if (!parsed) {
          statusMessage(t("configInvalid"));
          return;
        }
        const clean = sanitizeState(parsed.state);
        setters.setImportedSongs(clean.importedSongs);
        setters.setSpeed(clean.speed);
        setters.setVolume(clean.volume);
        setters.setLabelMode(clean.labelMode);
        setters.setKeyboardLayout(clean.keyboardLayout);
        setters.setTheme(clean.theme);
        // B1 : tous les champs exportés doivent être restaurés.
        setters.setReverb(clean.reverb);
        setters.setTranspose(clean.transpose);
        setters.setEq(clean.eq);
        setters.setShowVisualizer(clean.visualizer ?? false);
        setters.setShortcuts(clean.shortcuts ?? DEFAULT_SHORTCUTS);
        setters.setLanguage(clean.language ?? detectLanguage());
        statusMessage(
          interpolate(t("configImported"), { count: clean.importedSongs.length })
        );
        // E13 : flash visuel bref.
        if (configFlashTimerRef.current !== null) {
          window.clearTimeout(configFlashTimerRef.current);
        }
        setConfigFlash(true);
        configFlashTimerRef.current = window.setTimeout(
          () => setConfigFlash(false),
          1200
        );
      } catch {
        statusMessage(t("configReadError"));
      }
    },
    [setters, statusMessage, t]
  );

  return { exportConfig, importConfig, configFlash };
}
