// Overlays de statut (refactor Phase B2) : chargement, erreur audio,
// drag & drop, message de statut, santé audio — blocs passifs.

import { memo } from "react";
import { audioHealth, formatHealth } from "../audio-health";

interface StatusOverlaysProps {
  status: "loading" | "ready" | "error";
  loadedCount: number;
  sampleCount: number;
  loadErrorText: string;
  retryText: string;
  onRetry: () => void;
  statusMessage: string | null;
  isDragOver: boolean;
}

// B14 (audit) : React.memo — composant passif, props stables.
const StatusOverlays = memo(function StatusOverlays({
  status,
  loadedCount,
  sampleCount,
  loadErrorText,
  retryText,
  onRetry,
  statusMessage,
  isDragOver,
}: StatusOverlaysProps) {
  return (
    <>
      {status === "loading" && (
        <div className="piano-loading" role="status" aria-live="polite">
          Chargement des sons du piano… {loadedCount}/{sampleCount}
          <progress
            max={sampleCount}
            value={loadedCount}
            aria-label="Progression du chargement"
          />
        </div>
      )}
      {status === "error" && (
        <div className="piano-loading" role="alert">
          {loadErrorText}{" "}
          <button className="import-btn" onClick={onRetry}>
            {retryText}
          </button>
          <span className="piano-error-hint">
            Si le problème persiste, réinstalle l'application.
          </span>
        </div>
      )}
      {status === "ready" && (
        <div className="audio-health" role="status" aria-label="Santé audio">
          {formatHealth(audioHealth())}
        </div>
      )}
      {isDragOver && (
        <div className="drop-overlay" role="status">
          Dépose ton fichier .mid / .midi pour l'importer
        </div>
      )}
      {statusMessage && <div className="status-message">{statusMessage}</div>}
    </>
  );
});

export default StatusOverlays;
