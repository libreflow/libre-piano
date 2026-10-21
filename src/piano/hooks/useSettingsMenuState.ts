// Menu Paramètres (extrait de Piano.tsx) : ouverture/fermeture au clic
// extérieur et Échap, et capture d'une touche pour remapper un raccourci
// (roadmap #65). B12 : modificateurs et touches système ignorés.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortcutConfig } from "../useKeyboardInput";

export type RemapTarget = "sustain" | "togglePlayback";

export interface SettingsMenuStateApi {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  shortcuts: ShortcutConfig;
  /** Restaure des raccourcis (import de configuration, B1). */
  setShortcuts: (s: ShortcutConfig) => void;
  remapping: RemapTarget | null;
  /** Ouvre la capture de remap (neutralise le clavier de jeu, B12). */
  startRemap: (target: RemapTarget) => void;
}

export function useSettingsMenuState(initialShortcuts: ShortcutConfig): SettingsMenuStateApi {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(initialShortcuts);
  const remapCaptureRef = useRef<RemapTarget | null>(null);
  const [remapping, setRemapping] = useState<RemapTarget | null>(null);
  const setRemapCapture = useCallback((target: RemapTarget | null) => {
    remapCaptureRef.current = target;
    setRemapping(target);
  }, []);
  const startRemap = useCallback((target: RemapTarget) => setRemapCapture(target), [
    setRemapCapture,
  ]);

  // Fermeture : clic extérieur ou Échap.
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  // Capture de la nouvelle touche (B12 : ignorer modificateurs/système).
  useEffect(() => {
    if (!remapping) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const code = e.code;
      const MODIFIER_CODES = new Set([
        "ControlLeft", "ControlRight",
        "AltLeft", "AltRight",
        "ShiftLeft", "ShiftRight",
        "MetaLeft", "MetaRight",
        "CapsLock", "NumLock", "ScrollLock",
        "OSLeft", "OSRight",
      ]);
      if (code !== "Escape" && !MODIFIER_CODES.has(code)) {
        setShortcuts((prev) => ({ ...prev, [remapping]: code }));
      }
      setRemapCapture(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [remapping, setRemapCapture]);

  const setShortcutsExternal = useCallback((s: ShortcutConfig) => {
    setShortcuts(s);
  }, []);
  return {
    settingsOpen,
    setSettingsOpen,
    settingsRef,
    shortcuts,
    setShortcuts: setShortcutsExternal,
    remapping,
    startRemap,
  };
}
