// État persisté (refactor Phase A2) : chargement une seule fois à
// l'initialisation depuis localStorage, et réécriture de l'état via
// un callback de sauvegarde stable. Les setters et l'effet de
// synchronisation restent chez le composant (les dépendances de
// l'effet y vivent déjà).

import { useCallback, useState } from "react";
import { loadPersistedState, savePersistedState, STATE_VERSION } from "../storage";
import type { PersistedState } from "../storage";

/** Champs persistés, hors version (fournie à la sauvegarde). */
export type PersistedSnapshot = Omit<PersistedState, "version">;

export function usePianoState() {
  // Lu une seule fois à l'initialisation : re-render inutile ensuite.
  const [initialState] = useState(() => loadPersistedState());

  const persist = useCallback((snapshot: PersistedSnapshot) => {
    return savePersistedState({ ...snapshot, version: STATE_VERSION });
  }, []);

  return { initialState, persist };
}
