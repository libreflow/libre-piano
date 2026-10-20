// Menu Paramètres + bouton thème (refactor Phase B6) : la refonte UI
// regroupe les options secondaires dans un menu déroulant ; le thème
// vit en bouton flottant en haut à droite.
// E1 (audit ergonomie) : textes traduits via useI18n.
// E6 (audit ergonomie) : navigation clavier fléchée dans le menu.

import { memo, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { LabelMode } from "../notes";
import type { Language } from "../i18n";
import type { ShortcutConfig } from "../useKeyboardInput";
import {
  SettingsIcon,
  TagsIcon,
  ExpandIcon,
  CollapseIcon,
  ImportIcon,
  SunIcon,
  MoonIcon,
} from "../icons";
import { useI18n } from "../useI18n";

export interface SettingsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  labelMode: LabelMode;
  onLabelModeChange: (mode: LabelMode) => void;
  showVisualizer: boolean;
  onToggleVisualizer: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  language: Language;
  onToggleLanguage: () => void;
  shortcuts: ShortcutConfig;
  onRemapSustain: () => void;
  onRemapTogglePlayback: () => void;
  isPlaying: boolean;
  onExportConfig: () => void;
  onImportConfig: () => void;
  configInputRef: RefObject<HTMLInputElement | null>;
  onConfigFile: (file: File) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  /** Le badge sustain reste dans le groupe Affichage, hors du menu. */
  children?: React.ReactNode;
}

// B14 (audit) : React.memo — composant passif, props stables.
const SettingsMenu = memo(function SettingsMenu({
  open,
  onOpenChange,
  menuRef,
  labelMode,
  onLabelModeChange,
  showVisualizer,
  onToggleVisualizer,
  isFullscreen,
  onToggleFullscreen,
  language,
  onToggleLanguage,
  shortcuts,
  onRemapSustain,
  onRemapTogglePlayback,
  isPlaying,
  onExportConfig,
  onImportConfig,
  configInputRef,
  onConfigFile,
  theme,
  onToggleTheme,
}: SettingsMenuProps) {
  const { t } = useI18n(language);
  // E6 (audit ergonomie) : navigation fléchée dans le menu — les boutons
  // du panneau sont focusables et les flèches Haut/Bas déplacent le focus.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled), [role='radio']:not(:disabled)"
      );
      if (focusable.length === 0) return;
      const list = Array.from(focusable);
      const currentIdx = list.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      let nextIdx: number;
      if (e.key === "ArrowDown") {
        nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % list.length;
      } else {
        nextIdx = currentIdx < 0 ? list.length - 1 : (currentIdx - 1 + list.length) % list.length;
      }
      list[nextIdx]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="settings-menu" ref={menuRef}>
        <button
          className={`import-btn ${open ? "seg-active" : ""}`}
          onClick={() => onOpenChange(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-pressed={open}
          title={t("settings")}
        >
          <SettingsIcon />
          {t("settings")}
        </button>
        {open && (
          <div
            ref={panelRef}
            className="settings-panel"
            role="menu"
            aria-label={t("settingsMenu")}
          >
            <h4>{t("groupDisplay")}</h4>
            <div className="segmented" role="radiogroup" aria-label={t("labels")}>
              {(
                [
                  ["lettres", "A B C"],
                  ["solfege", "Do Ré"],
                  ["both", "A B C + Do"],
                  ["none", t("labelNone")],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={labelMode === mode}
                  className={labelMode === mode ? "seg-active" : ""}
                  onClick={() => onLabelModeChange(mode)}
                  title={`${t("labels")} : ${label}`}
                >
                  <TagsIcon />
                  {label}
                </button>
              ))}
            </div>
            <button
              className="import-btn"
              onClick={onToggleVisualizer}
              aria-pressed={showVisualizer}
              title={t("waveHint")}
            >
              {showVisualizer ? t("waveToggleOn") : t("waveToggleOff")}
            </button>
            <button className="import-btn" onClick={onToggleFullscreen} aria-pressed={isFullscreen}>
              {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
              {isFullscreen ? t("fullscreenQuit") : t("fullscreen")}
            </button>
            <h4>{t("groupLanguage")}</h4>
            <button
              className="import-btn"
              onClick={onToggleLanguage}
              title={t("switchLanguageHint")}
              aria-label={t("switchLanguageAria")}
            >
              {language === "fr" ? "FR" : "EN"}
            </button>
            <h4>{t("groupShortcuts")}</h4>
            <button
              className="import-btn"
              onClick={onRemapSustain}
              title={t("shortcutPedalHint")}
            >
              {t("shortcutPedal")} : {shortcuts.sustain === "Space" ? t("sustainOff") : shortcuts.sustain}
            </button>
            <button
              className="import-btn"
              onClick={onRemapTogglePlayback}
              title={t("shortcutPlayHint")}
            >
              {t("shortcutPlay")} :{" "}
              {shortcuts.togglePlayback === "Enter"
                ? t("keyEnter")
                : shortcuts.togglePlayback}
            </button>
            <h4>{t("groupConfig")}</h4>
            <button
              className="import-btn"
              onClick={onExportConfig}
              disabled={isPlaying}
              title={t("exportConfigHint")}
              aria-label={t("exportConfig")}
            >
              <ExpandIcon />
              {t("exportConfig")}
            </button>
            <button
              className="import-btn"
              onClick={onImportConfig}
              disabled={isPlaying}
              title={t("importConfigHint")}
              aria-label={t("importConfig")}
            >
              <ImportIcon />
              {t("importConfig")}
            </button>
            <input
              ref={configInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onConfigFile(file);
              }}
              style={{ display: "none" }}
            />
          </div>
        )}
      </div>
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-pressed={theme === "light"}
        title={theme === "dark" ? t("themeLight") : t("themeDark")}
        aria-label={theme === "dark" ? t("themeLightAction") : t("themeDarkAction")}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </>
  );
});

export default SettingsMenu;
