// Plein écran (refactor Phase A4) : état synchronisé avec les sorties
// natives (F11, Échap) — B9 (audit) : sinon le bouton s'inverse par
// rapport à la réalité.

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const next = !isFullscreen;
      await win.setFullscreen(next);
      setIsFullscreen(next);
    } catch {
      // API Tauri indisponible (ex: navigateur) : on ignore.
    }
  };

  return { isFullscreen, toggleFullscreen };
}
