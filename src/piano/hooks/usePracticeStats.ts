// Statistiques de progression (extrait de Piano.tsx) : enregistre une
// session quand practice passe à done (une seule fois par session),
// persistance dans la clé dédiée (roadmap #38) et purge à la suppression
// d'un morceau (B10).
// Audit : saveStats n'est PLUS appelé dans un updater de setState (effet
// de bord en updater — pattern B8) : l'état dérivé passe par un ref miroir,
// le save vit dans l'effet.

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
  // Miroir de l'état courant : les effets calculent le next à partir de
  // la valeur à jour, hors updater (les updaters React doivent être purs).
  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);
  const doneRef = useRef(false);
  useEffect(() => {
    if (practice.done && !doneRef.current && song) {
      doneRef.current = true;
      const next = recordSession(
        statsRef.current,
        song.id,
        sessionFrom(practice.score ?? 100, practice.mistakes, song)
      );
      setStats(next);
      saveStats(next);
    } else if (!practice.done) {
      doneRef.current = false;
    }
  }, [practice.done, practice.score, practice.mistakes, song]);

  /** Purge les stats d'un morceau supprimé (B10). */
  const purgeSong = useCallback((id: string) => {
    const next = removeStats(statsRef.current, id);
    setStats(next);
    saveStats(next);
  }, []);

  return { stats, purgeSong };
}
