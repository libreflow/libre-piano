// Surbrillance des touches (extrait de Piano.tsx) : trois états de notes
// (active = souris/clavier, auto = lecture automatique, sustained =
// pédale) + le routage noteOff vers sustained quand la pédale est enfoncée.

import { useCallback, useEffect, useRef, useState } from "react";

export interface ActiveNotesApi {
  activeNotes: ReadonlySet<string>;
  autoActiveNotes: ReadonlySet<string>;
  sustainedNotes: ReadonlySet<string>;
  sustainOn: boolean;
  /** Réflet mutable de sustainOn (lue dans les callbacks stables). */
  sustainOnRef: React.RefObject<boolean>;
  setSustainOn: (on: boolean) => void;
  markNoteOn: (note: string) => void;
  markNoteOff: (note: string) => void;
  markAutoNoteOn: (note: string) => void;
  markAutoNoteOff: (note: string) => void;
  /** noteOff + pédale : route vers sustained au lieu de relâcher. */
  routeNoteOff: (note: string, releaseNote: (note: string) => void) => void;
  clearAutoNotes: () => void;
  clearSustainedNote: (note: string) => void;
  /** Vide la liste des notes sustained (relâchement de la pédale). */
  clearSustained: () => void;
  /** Liste courante des notes sustain (hors updater, cf. m8). */
  sustainedNotesRef: React.RefObject<Set<string>>;
}

export function useActiveNotes(): ActiveNotesApi {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [autoActiveNotes, setAutoActiveNotes] = useState<Set<string>>(new Set());
  const [sustainedNotes, setSustainedNotes] = useState<Set<string>>(new Set());
  const [sustainOn, setSustainOn] = useState(false);
  const sustainOnRef = useRef(false);
  useEffect(() => {
    sustainOnRef.current = sustainOn;
  }, [sustainOn]);
  // Ref miroir de sustainedNotes : lire la liste courante hors updater
  // (m8) — les updaters React sont purs, les effets ne doivent pas y vivre.
  const sustainedNotesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    sustainedNotesRef.current = sustainedNotes;
  }, [sustainedNotes]);

  const markNoteOn = useCallback((note: string) => {
    setActiveNotes((prev) => new Set(prev).add(note));
  }, []);
  const markNoteOff = useCallback((note: string) => {
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);
  const markAutoNoteOn = useCallback((note: string) => {
    setAutoActiveNotes((prev) => new Set(prev).add(note));
  }, []);
  const markAutoNoteOff = useCallback((note: string) => {
    setAutoActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);
  const clearAutoNotes = useCallback(() => setAutoActiveNotes(new Set()), []);
  const clearSustained = useCallback(() => setSustainedNotes(new Set()), []);
  const clearSustainedNote = useCallback((note: string) => {
    setSustainedNotes((prev) => {
      if (!prev.has(note)) return prev;
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);
  const setSustainOnChange = useCallback((on: boolean) => setSustainOn(on), []);

  // Routage du noteOff : si la pédale est enfoncée, la note rejoint les
  // sustained ; sinon on relâche et on nettoie un éventuel reste.
  const routeNoteOff = useCallback(
    (note: string, releaseNote: (note: string) => void) => {
      if (sustainOnRef.current) {
        markNoteOff(note);
        setSustainedNotes((prev) => new Set(prev).add(note));
        return;
      }
      releaseNote(note);
      markNoteOff(note);
      clearSustainedNote(note);
    },
    [markNoteOff, clearSustainedNote]
  );

  return {
    activeNotes,
    autoActiveNotes,
    sustainedNotes,
    sustainOn,
    sustainOnRef,
    setSustainOn: setSustainOnChange,
    markNoteOn,
    markNoteOff,
    markAutoNoteOn,
    markAutoNoteOff,
    routeNoteOff,
    clearAutoNotes,
    clearSustainedNote,
    clearSustained,
    sustainedNotesRef,
  };
}
