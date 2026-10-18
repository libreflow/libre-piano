import { useCallback, useEffect, useMemo, useRef } from "react";
import { ensureAudioStarted, getContext } from "./tone-gate";
import { getKeyToNote, KeyboardLayout } from "./notes";

interface KeyboardHandlers {
  layout: KeyboardLayout;
  shortcuts?: ShortcutConfig;
  octaveShift?: number;
  isPlayingRef: React.RefObject<boolean>;
  noteOn: (note: string) => void;
  noteOff: (note: string) => void;
  onSustainChange: (on: boolean) => void;
  releaseSustained: () => void;
  onTogglePlayback?: () => void;
}

// Clavier PC -> touches du piano (désactivé pendant la lecture auto)
/** Raccourcis personnalisables (roadmap #65) : codes de touches
 * physiques (KeyboardEvent.code), persistés. */
export interface ShortcutConfig {
  sustain: string;
  togglePlayback: string;
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  sustain: "Space",
  togglePlayback: "Enter",
};

// + pédale de sustain sur la barre d'espace maintenue.
export function useKeyboardInput({
  layout,
  octaveShift = 0,
  shortcuts = DEFAULT_SHORTCUTS,
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
  // Ref miroir de keyToNote : les listeners du hook ne sont JAMAIS
  // recréés quand la fenêtre d'octave bouge — ils lisent cette ref au
  // moment du keypress. Sinon, il existe une fenêtre temporelle (entre
  // le commit des nouvelles étiquettes et le re-attach des listeners)
  // où presser une touche jouait la note de l'ANCIENNE fenêtre.
  const keyToNoteRef = useRef(keyToNote);
  useEffect(() => {
    keyToNoteRef.current = keyToNote;
  }, [keyToNote]);

  const releaseSustain = useCallback(() => {
    sustainRef.current = false;
    onSustainChange(false);
    releaseSustained();
  }, [onSustainChange, releaseSustained]);

  // Les handlers ci-dessous lisent keyToNoteRef au moment de l'appui :
  // les listeners ne dépendent PAS de keyToNote (pas de re-attach quand
  // la fenêtre d'octave bouge).
  useEffect(() => {
    // Débloque l'AudioContext le plus tôt possible (gesture utilisateur
    // requis par les navigateurs : le mount survient après une interaction
    // dans Tauri ; sinon le premier keydown s'en charge via ensureStarted).
    void ensureAudioStarted();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === shortcuts.sustain) {
        e.preventDefault();
        if (!sustainRef.current && !isPlayingRef.current) {
          sustainRef.current = true;
          onSustainChange(true);
        }
        return;
      }
      if (e.code === shortcuts.togglePlayback && onTogglePlayback) {
        const target = e.target as HTMLElement | null;
        // Ignorer si le focus est dans un élément interactif — y compris
        // les labels du sélecteur de pistes (sinon Entrée lancerait la
        // lecture derrière le dialogue au lieu de valider l'import).
        // closest peut manquer (cible window) : traiter comme non-interactif.
        if (!target?.closest?.("button, select, input, a, label")) {
          e.preventDefault();
          onTogglePlayback();
        }
        return;
      }
      if (e.repeat || isPlayingRef.current) return;
      const key = e.key.toLowerCase();
      const note = keyToNoteRef.current[key];
      if (!note || activeKeyboardNotes.current.has(key)) return;
      activeKeyboardNotes.current.set(key, note);
      if (getContext().state !== "running") void ensureAudioStarted();
      noteOn(note);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === shortcuts.sustain) {
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
    // Si la fenêtre perd le focus (Alt-Tab, clic hors app), les keyup ne
    // arriveront jamais : relâcher la pédale ET toutes les notes actives,
    // sinon elles sonnent indéfiniment et les touches deviennent muettes
    // (activeKeyboardNotes garde les caractères sans keyup).
    const handleBlur = () => {
      const held = [...activeKeyboardNotes.current.values()];
      activeKeyboardNotes.current.clear();
      for (const note of held) {
        noteOff(note);
      }
      releaseSustain();
    };
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
    shortcuts,
    noteOn,
    noteOff,
    onSustainChange,
    onTogglePlayback,
    releaseSustain,
  ]);

  return { sustainRef };
}
