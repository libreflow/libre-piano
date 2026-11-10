// État persisté (refactor Phase A2) : chargement une seule fois à
// l'initialisation depuis localStorage, et réécriture de l'état via
// un callback de sauvegarde stable. Les setters et l'effet de
// synchronisation restent chez le composant (les dépendances de
// l'effet y vivent déjà).
//
// M2 (audit) : le profil est capturé une fois au montage. Au
// changement de profil, la clé active change AVANT le flush de
// démontage (usePersistSnapshot persiste au unmount) — si persist()
// relisait la clé active à ce moment, il écrirait l'état du profil
// quitté dans la clé du profil cible.

import { useCallback, useRef, useState } from "react";
import {
  loadPersistedState,
  savePersistedState,
  getActiveProfile,
  STATE_VERSION,
} from "../storage";
import type { PersistedState } from "../storage";

/** Champs persistés, hors version (fournie à la sauvegarde). */
export type PersistedSnapshot = Omit<PersistedState, "version">;

export function usePianoState() {
  // Lu une seule fois à l'initialisation : re-render inutile ensuite.
  const [initialState] = useState(() => loadPersistedState());
  // M2 : profil figé au montage — cf. commentaire du module.
  const profileRef = useRef(getActiveProfile());

  const persist = useCallback((snapshot: PersistedSnapshot) => {
    return savePersistedState(
      { ...snapshot, version: STATE_VERSION },
      profileRef.current
    );
  }, []);

  return { initialState, persist };
}
