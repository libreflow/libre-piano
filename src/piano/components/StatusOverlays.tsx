// Overlays de statut (refactor Phase B2) : chargement, erreur audio,
// drag & drop — blocs passifs. Le message de statut vit désormais dans
// .status-strip (en flux, réservé) — plus aucune superposition avec le
// clavier. E1 (audit ergonomie) : textes traduits via useI18n.

import { memo } from "react";
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

interface StatusOverlaysProps {
  status: "loading" | "ready" | "error";
  loadedCount: number;
  sampleCount: number;
  isDragOver: boolean;
  language: Language;
  /** Relance le chargement des échantillons (roadmap #73) — rechargée
   * de la page AVANT (perte d'état/session), retryLoading était mort. */
  onRetry?: () => void;
}

// B14 (audit) : React.memo — composant passif, props stables.
const StatusOverlays = memo(function StatusOverlays({
  status,
  loadedCount,
  sampleCount,
  isDragOver,
  language,
  onRetry,
}: StatusOverlaysProps) {
  const { t } = useI18n(language);
  return (
    <>
      {status === "loading" && (
        <div className="piano-loading" role="status" aria-live="polite">
          {interpolate(t("loadingText"), { loaded: loadedCount, total: sampleCount })}
          <progress
            max={sampleCount}
            value={loadedCount}
            aria-label={t("loadingProgress")}
          />
        </div>
      )}
      {status === "error" && (
        <div className="piano-loading" role="alert">
          {t("loadError")}{" "}
          <button
            className="import-btn"
            onClick={onRetry ?? (() => window.location.reload())}
          >
            {t("retry")}
          </button>
          <span className="piano-error-hint">{t("errorHint")}</span>
        </div>
      )}
      {isDragOver && (
        <div className="drop-overlay" role="status">
          {t("dropOverlay")}
        </div>
      )}
    </>
  );
});

export default StatusOverlays;
