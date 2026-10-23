// Statistiques de progression (extrait de Piano.tsx) : enregistre une
// session quand practice passe à done (une seule fois par session),
// persistance dans la clé dédiée (roadmap #38) et purge à la suppression
// d'un morceau (B10).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "../songs";
import {
  loadStats,
  saveStats,
  removeStats,
  recordSession,
  sessionFrom,
  type StatsBySong,
} from "../practice-stats";

export interface PracticeDoneState {
  done: boolean;
  score: number | null;
  mistakes: number;
}

export function usePracticeStats(song: Song | undefined, practice: PracticeDoneState) {
  const [stats, setStats] = useState<StatsBySong>(loadStats);
  const doneRef = useRef(false);
  useEffect(() => {
    if (practice.done && !doneRef.current && song) {
      doneRef.current = true;
      setStats((prev) => {
        const next = recordSession(
          prev,
          song.id,
          sessionFrom(practice.score ?? 100, practice.mistakes, song)
        );
        saveStats(next);
        return next;
      });
    } else if (!practice.done) {
      doneRef.current = false;
    }
  }, [practice.done, practice.score, practice.mistakes, song]);

  /** Purge les stats d'un morceau supprimé (B10). */
  const purgeSong = useCallback((id: string) => {
    setStats((prev) => {
      const next = removeStats(prev, id);
      saveStats(next);
      return next;
    });
  }, []);

  return { stats, purgeSong };
}
