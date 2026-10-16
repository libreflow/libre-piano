import { useCallback, useEffect, useMemo, useRef } from "react";
import { start as toneStart } from "./tone-gate";
import { getKeyToNote, KeyboardLayout } from "./notes";

interface KeyboardHandlers {
  layout: KeyboardLayout;
  isPlayingRef: React.RefObject<boolean>;
  noteOn: (note: string) => void;
  noteOff: (note: string) => void;
  onSustainChange: (on: boolean) => void;
  releaseSustained: () => void;
}

// Clavier PC -> touches du piano (désactivé pendant la lecture auto)
// + pédale de sustain sur la barre d'espace maintenue.
export function useKeyboardInput({
  layout,
  isPlayingRef,
  noteOn,
  noteOff,
  onSustainChange,
  releaseSustained,
}: KeyboardHandlers) {
  const activeKeyboardKeys = useRef<Set<string>>(new Set());
  const sustainRef = useRef(false);
  const keyToNote = useMemo(() => getKeyToNote(layout), [layout]);

  const releaseSustain = useCallback(() => {
    sustainRef.current = false;
    onSustainChange(false);
    releaseSustained();
  }, [onSustainChange, releaseSustained]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!sustainRef.current && !isPlayingRef.current) {
          sustainRef.current = true;
          onSustainChange(true);
        }
        return;
      }
      if (e.repeat || isPlayingRef.current) return;
      const key = e.key.toLowerCase();
      const note = keyToNote[key];
      if (!note || activeKeyboardKeys.current.has(key)) return;
      activeKeyboardKeys.current.add(key);
      await toneStart();
      noteOn(note);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        releaseSustain();
        return;
      }
      const key = e.key.toLowerCase();
      const note = keyToNote[key];
      if (!note) return;
      activeKeyboardKeys.current.delete(key);
      if (!isPlayingRef.current) noteOff(note);
    };
    // Si la fenêtre perd le focus pédale enfoncée, on la relâche pour ne
    // pas laisser des notes sonner indéfiniment.
    const handleBlur = () => releaseSustain();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isPlayingRef, keyToNote, noteOn, noteOff, onSustainChange, releaseSustain]);

  return { sustainRef };
}
