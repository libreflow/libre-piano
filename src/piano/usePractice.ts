import { useCallback, useEffect, useRef, useState } from "react";
import type { Song, SongEvent } from "./songs";

// Mode apprentissage : la session déroule les événements du morceau un à
// un ; la touche attendue est surlignée, et la session n'avance que quand
// l'utilisateur joue la bonne note. Compteur de justesse en fin de session.

export interface PracticeState {
  active: boolean;
  /** Index de l'événement attendu. */
  step: number;
  /** Note attendue (null entre deux notes / session finie). */
  expectedNote: string | null;
  /** Nombre de fautes (mauvaises notes jouées). */
  mistakes: number;
  /** Session terminée. */
  done: boolean;
}

const IDLE: PracticeState = {
  active: false,
  step: 0,
  expectedNote: null,
  mistakes: 0,
  done: false,
};

export function usePractice(
  song: Song | undefined,
  /** Notes jouées par l'utilisateur (clavier/souris), pour avancer. */
  onNotePlayed: (note: string) => void
) {
  const [state, setState] = useState<PracticeState>(IDLE);
  // ref des événements pour éviter les relances d'effet
  const eventsRef = useRef<SongEvent[]>([]);

  // Reset de la session au changement (ou à la suppression) du morceau :
  // sinon une session active survit avec des événements obsolètes.
  const [lastSong, setLastSong] = useState(song);
  useEffect(() => {
    if (song !== lastSong) {
      setLastSong(song);
      setState(IDLE);
    }
  }, [song, lastSong]);
  useEffect(() => {
    eventsRef.current = song?.events ?? [];
  }, [song]);

  const start = useCallback(() => {
    const events = eventsRef.current;
    if (events.length === 0) return;
    setState({
      active: true,
      step: 0,
      expectedNote: events[0].note,
      mistakes: 0,
      done: false,
    });
  }, []);

  const stop = useCallback(() => setState(IDLE), []);

  /** À brancher sur chaque note jouée : avance la session si correcte. */
  const handlePlayedNote = useCallback(
    (note: string) => {
      setState((prev) => {
        if (!prev.active || prev.done || !prev.expectedNote) return prev;
        if (note === prev.expectedNote) {
          const events = eventsRef.current;
          const next = prev.step + 1;
          if (next >= events.length) {
            return { ...prev, expectedNote: null, done: true };
          }
          return { ...prev, step: next, expectedNote: events[next].note };
        }
        return { ...prev, mistakes: prev.mistakes + 1 };
      });
      onNotePlayed(note);
    },
    [onNotePlayed]
  );

  return { state, start, stop, handlePlayedNote };
}
