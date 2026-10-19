// Menu Paramètres + bouton thème (refactor Phase B6) : la refonte UI
// regroupe les options secondaires dans un menu déroulant ; le thème
// vit en bouton flottant en haut à droite.

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

export default function SettingsMenu({
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
  return (
    <>
      <div className="settings-menu" ref={menuRef}>
        <button
          className={`import-btn ${open ? "seg-active" : ""}`}
          onClick={() => onOpenChange(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-pressed={open}
          title="Paramètres"
        >
          <SettingsIcon />
          Paramètres
        </button>
        {open && (
          <div className="settings-panel" role="menu" aria-label="Paramètres">
            <h4>Affichage</h4>
            <div className="segmented" role="radiogroup" aria-label="Étiquettes des touches">
              {(
                [
                  ["lettres", "A B C"],
                  ["solfege", "Do Ré"],
                  ["both", "A B C + Do"],
                  ["none", "Rien"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={labelMode === mode}
                  className={labelMode === mode ? "seg-active" : ""}
                  onClick={() => onLabelModeChange(mode)}
                  title={`Étiquettes : ${label}`}
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
              title="Afficher la forme d'onde pendant le jeu"
            >
              {showVisualizer ? "Masquer l'onde" : "Onde"}
            </button>
            <button className="import-btn" onClick={onToggleFullscreen} aria-pressed={isFullscreen}>
              {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
              {isFullscreen ? "Quitter" : "Plein écran"}
            </button>
            <h4>Langue</h4>
            <button
              className="import-btn"
              onClick={onToggleLanguage}
              title="Interface language / Langue de l'interface"
              aria-label="Switch language (FR/EN)"
            >
              {language === "fr" ? "FR" : "EN"}
            </button>
            <h4>Raccourcis</h4>
            <button
              className="import-btn"
              onClick={onRemapSustain}
              title="Personnaliser le raccourci de la pédale (roadmap #65)"
            >
              Pédale : {shortcuts.sustain === "Space" ? "Espace" : shortcuts.sustain}
            </button>
            <button
              className="import-btn"
              onClick={onRemapTogglePlayback}
              title="Personnaliser le raccourci lecture/arrêt (roadmap #65)"
            >
              Lecture :{" "}
              {shortcuts.togglePlayback === "Enter"
                ? "Entrée"
                : shortcuts.togglePlayback}
            </button>
            <h4>Configuration</h4>
            <button
              className="import-btn"
              onClick={onExportConfig}
              disabled={isPlaying}
              title="Exporter morceaux importés + préférences en JSON"
              aria-label="Exporter la configuration"
            >
              <ExpandIcon />
              Exporter
            </button>
            <button
              className="import-btn"
              onClick={onImportConfig}
              disabled={isPlaying}
              title="Importer un fichier de configuration Libre Piano"
              aria-label="Importer la configuration"
            >
              <ImportIcon />
              Config
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
        title={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
        aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </>
  );
}
