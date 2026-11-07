// Plein écran (refactor Phase A4) : état synchronisé avec les sorties
// natives (Échap en navigateur) — B9 (audit) : sinon le bouton s'inverse
// par rapport à la réalité.
// Audit : le fullscreen NATIF Tauri ne déclenche PAS l'événement DOM
// fullscreenchange (c'est la fenêtre OS qui passe en plein écran, pas le
// document) — l'état est donc resynchronisé après l'appel via
// win.isFullscreen(), avec repli sur le DOM quand l'API Tauri manque
// (navigateur pur, tests).

import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface FullscreenWindow {
  setFullscreen?: (fullscreen: boolean) => Promise<void>;
  isFullscreen?: () => Promise<boolean>;
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const next = !isFullscreen;
    try {
      const win = getCurrentWindow() as unknown as FullscreenWindow;
      if (typeof win.setFullscreen !== "function") {
        // API Tauri indisponible (ex: navigateur) : repli sur le DOM.
        setIsFullscreen(Boolean(document.fullscreenElement));
        return;
      }
      await win.setFullscreen(next);
      // Vérité terrain : l'état natif réel, pas une supposition.
      const actual =
        typeof win.isFullscreen === "function" ? await win.isFullscreen() : next;
      setIsFullscreen(actual);
    } catch {
      // IPC indisponible : rester cohérent avec le DOM plutôt que
      // d'affirmer un état faux.
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  }, [isFullscreen]);

  return { isFullscreen, toggleFullscreen };
}
