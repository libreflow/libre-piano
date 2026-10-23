// Persistance debouncée (extrait de Piano.tsx, P4 audit perf) : les champs
// fréquemment modifiés (volume, EQ, vitesse, réverbe) déclenchent un
// changement à chaque mouvement de slider ; un JSON.stringify complet à
// chaque frame bloquerait le thread principal. 300 ms après le dernier
// changement suffit, et le dernier snapshot est persisté au démontage
// (changement de profil, fermeture).

import { useEffect, useRef } from "react";
import type { PersistedSnapshot } from "./usePianoState";

export function usePersistSnapshot(
  snapshot: PersistedSnapshot,
  persist: (snapshot: PersistedSnapshot) => boolean,
  onQuotaFull: () => void
) {
  const persistTimerRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<PersistedSnapshot | null>(null);
  // N'avertir qu'une fois par "session de dépassement" du quota.
  const quotaWarnedRef = useRef(false);

  useEffect(() => {
    lastSnapshotRef.current = snapshot;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      const saved = persist(snapshot);
      // Quota localStorage dépassé : avertir au lieu d'échouer en silence.
      if (!saved && !quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        onQuotaFull();
      } else if (saved) {
        quotaWarnedRef.current = false;
      }
    }, 300);
  }, [snapshot, persist, onQuotaFull]);

  // Persiste le dernier état au démontage pour ne pas perdre un réglage
  // modifié dans les 300 ms du debounce.
  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const last = lastSnapshotRef.current;
      if (last) persist(last);
    };
  }, [persist]);
}
