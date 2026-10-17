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
  /** Note suivante (anticipation, null en fin de morceau). */
  nextNote: string | null;
  /** Nombre de fautes (mauvaises notes jouées). */
  mistakes: number;
  /** Session terminée. */
  done: boolean;
  /** Score de justesse 0–100 (null si aucune note jouée). */
  score: number | null;
}

const IDLE: PracticeState = {
  active: false,
  step: 0,
  expectedNote: null,
  nextNote: null,
  mistakes: 0,
  done: false,
  score: null,
};

export function usePractice(song: Song | undefined) {
  const [state, setState] = useState<PracticeState>(IDLE);
  // ref des événements pour éviter les relances d'effet
  const eventsRef = useRef<SongEvent[]>([]);

  // Reset de la session au changement (ou à la suppression) du morceau :
  // sinon une session active survit avec des événements obsolètes.
  // Pattern "adjusting state during render" (cf. React docs) : reset de
  // la session quand le morceau change, sans effect ni setState dedans.
  const [lastSong, setLastSong] = useState(song);
  if (song !== lastSong) {
    setLastSong(song);
    setState(IDLE);
  }
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
      nextNote: events.length > 1 ? events[1].note : null,
      mistakes: 0,
      done: false,
      score: null,
    });
  }, []);

  const stop = useCallback(() => setState(IDLE), []);

  /** À brancher sur chaque note jouée : avance la session si correcte. */
  const handlePlayedNote = useCallback((note: string) => {
    setState((prev) => {
      if (!prev.active || prev.done || !prev.expectedNote) return prev;
      if (note === prev.expectedNote) {
        const events = eventsRef.current;
        const next = prev.step + 1;
        if (next >= events.length) {
          return {
            ...prev,
            expectedNote: null,
            nextNote: null,
            done: true,
            // Score final : justesse = notes du morceau / total joué
            // (les fautes commises en route comptent dans le total).
            score: Math.round((events.length / (events.length + prev.mistakes)) * 100),
          };
        }
        return {
          ...prev,
          step: next,
          expectedNote: events[next].note,
          nextNote: next + 1 < events.length ? events[next + 1].note : null,
        };
      }
      // Faute : recalcul du score cumulé (bonnes / total jouées).
      const good = prev.step;
      const total = prev.step + prev.mistakes + 1;
      return {
        ...prev,
        mistakes: prev.mistakes + 1,
        score: Math.round((good / total) * 100),
      };
    });
  }, []);

  return { state, start, stop, handlePlayedNote };
}
