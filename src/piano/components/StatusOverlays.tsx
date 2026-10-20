// Overlays de statut (refactor Phase B2) : chargement, erreur audio,
// drag & drop, message de statut, santé audio — blocs passifs.
// E1 (audit ergonomie) : textes traduits via useI18n.

import { memo } from "react";
import { audioHealth, formatHealth } from "../audio-health";
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

interface StatusOverlaysProps {
  status: "loading" | "ready" | "error";
  loadedCount: number;
  sampleCount: number;
  statusMessage: string | null;
  isDragOver: boolean;
  language: Language;
}

// B14 (audit) : React.memo — composant passif, props stables.
const StatusOverlays = memo(function StatusOverlays({
  status,
  loadedCount,
  sampleCount,
  statusMessage,
  isDragOver,
  language,
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
          <button className="import-btn" onClick={() => window.location.reload()}>
            {t("retry")}
          </button>
          <span className="piano-error-hint">
            {t("errorHint")}
          </span>
        </div>
      )}
      {status === "ready" && (
        <div className="audio-health" role="status" aria-label={t("health")}>
          {formatHealth(audioHealth())}
        </div>
      )}
      {isDragOver && (
        <div className="drop-overlay" role="status">
          {t("dropOverlay")}
        </div>
      )}
      {statusMessage && <div className="status-message">{statusMessage}</div>}
    </>
  );
});

export default StatusOverlays;
