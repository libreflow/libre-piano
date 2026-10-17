import { useCallback, useEffect, useMemo, useRef } from "react";
import { ensureAudioStarted, getContext } from "./tone-gate";
import { getKeyToNote, KeyboardLayout } from "./notes";

interface KeyboardHandlers {
  layout: KeyboardLayout;
  octaveShift?: number;
  isPlayingRef: React.RefObject<boolean>;
  noteOn: (note: string) => void;
  noteOff: (note: string) => void;
  onSustainChange: (on: boolean) => void;
  releaseSustained: () => void;
  onTogglePlayback?: () => void;
}

// Clavier PC -> touches du piano (désactivé pendant la lecture auto)
// + pédale de sustain sur la barre d'espace maintenue.
export function useKeyboardInput({
  layout,
  octaveShift = 0,
  isPlayingRef,
  noteOn,
  noteOff,
  onSustainChange,
  releaseSustained,
  onTogglePlayback,
}: KeyboardHandlers) {
  // Map touche PC -> note RÉSOLUE au keydown : au keyup on relâche la
  // note enregistrée, pas celle de la fenêtre courante. Sinon, décaler
  // l'octave pendant une touche maintenue relâcherait la mauvaise note
  // et laisserait l'ancienne sonner à l'infini.
  const activeKeyboardNotes = useRef<Map<string, string>>(new Map());
  const sustainRef = useRef(false);
  const keyToNote = useMemo(
    () => getKeyToNote(layout, octaveShift),
    [layout, octaveShift]
  );

  const releaseSustain = useCallback(() => {
    sustainRef.current = false;
    onSustainChange(false);
    releaseSustained();
  }, [onSustainChange, releaseSustained]);

  useEffect(() => {
    // Débloque l'AudioContext le plus tôt possible (gesture utilisateur
    // requis par les navigateurs : le mount survient après une interaction
    // dans Tauri ; sinon le premier keydown s'en charge via ensureStarted).
    void ensureAudioStarted();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!sustainRef.current && !isPlayingRef.current) {
          sustainRef.current = true;
          onSustainChange(true);
        }
        return;
      }
      if (e.code === "Enter" && onTogglePlayback) {
        const target = e.target as HTMLElement;
        // Ignorer si le focus est dans un élément interactif — y compris
        // les labels du sélecteur de pistes (sinon Entrée lancerait la
        // lecture derrière le dialogue au lieu de valider l'import).
        if (!target.closest("button, select, input, a, label")) {
          e.preventDefault();
          onTogglePlayback();
        }
        return;
      }
      if (e.repeat || isPlayingRef.current) return;
      const key = e.key.toLowerCase();
      const note = keyToNote[key];
      if (!note || activeKeyboardNotes.current.has(key)) return;
      activeKeyboardNotes.current.set(key, note);
      if (getContext().state !== "running") void ensureAudioStarted();
      noteOn(note);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // Bug 4 : ne rien relâcher si la pédale n'était pas enfoncée,
        // sinon on coupe des notes sustain d'une session précédente.
        if (sustainRef.current) releaseSustain();
        return;
      }
      const key = e.key.toLowerCase();
      // Relâcher la note enregistrée au keydown (indépendante du
      // décalage d'octave effectué depuis).
      const playedNote = activeKeyboardNotes.current.get(key);
      activeKeyboardNotes.current.delete(key);
      if (!playedNote) return;
      // Toujours relâcher : si la lecture a démarré pendant que la
      // touche était maintenue, ignorer le keyup laisserait la note
      // sonner à l'infini après l'arrêt de la lecture.
      noteOff(playedNote);
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
  }, [
    isPlayingRef,
    keyToNote,
    noteOn,
    noteOff,
    onSustainChange,
    onTogglePlayback,
    releaseSustain,
  ]);

  return { sustainRef };
}
