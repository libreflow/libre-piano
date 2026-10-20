// Dialogue de sélection des pistes MIDI (refactor Phase B3) :
// choisis les pistes à importer, pré-écoute possible.

import { memo } from "react";
import { PlayIcon, StopIcon, StarIcon } from "../icons";
import { DISPLAY_CHORD_RATIO_THRESHOLD } from "../constants";
import type { PendingImport } from "../useMidiImport";

interface TrackPickerProps {
  pendingImport: PendingImport;
  selectedTrackIndices: ReadonlySet<number>;
  previewingTrack: number | null;
  onToggleTrack: (index: number) => void;
  onPreview: (index: number) => void;
  onStopPreview: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

// B14 (audit) : React.memo — composant passif, props stables.
const TrackPicker = memo(function TrackPicker({
  pendingImport,
  selectedTrackIndices,
  previewingTrack,
  onToggleTrack,
  onPreview,
  onStopPreview,
  onConfirm,
  onCancel,
}: TrackPickerProps) {
  return (
    <div className="track-picker">
      <h3>Pistes de "{pendingImport.title}"</h3>
      <p className="track-picker-hint">
        Choisis les pistes à importer (décoche l'accompagnement/basse pour n'entendre
        que la mélodie, par exemple).
      </p>
      <ul className="track-list">
        {pendingImport.tracks.map((t) => (
          <li key={t.index}>
            <label className={t.likelyMelody ? "likely-melody" : ""}>
              <input
                type="checkbox"
                checked={selectedTrackIndices.has(t.index)}
                onChange={() => onToggleTrack(t.index)}
              />
              <span className="track-info">
                <span className="track-title">
                  {t.name} — {t.noteCount} notes
                  {t.likelyMelody && (
                    <span className="melody-tag">
                      <StarIcon /> mélodie
                    </span>
                  )}
                </span>
                <span className="track-details">
                  tessiture {t.pitchRange} ·{" "}
                  {t.chordRatio > DISPLAY_CHORD_RATIO_THRESHOLD
                    ? "accords/accompagnement"
                    : "monophonique"}
                  {t.percussion ? " · percussion" : ""}
                  {t.instrumentName ? ` · ${t.instrumentName}` : ""}
                  {t.handRole === "right"
                    ? " · main droite"
                    : t.handRole === "left"
                      ? " · main gauche"
                      : ""}
                </span>
              </span>
            </label>
            <button
              className="import-btn preview-btn"
              onClick={() => {
                if (previewingTrack === t.index) {
                  onStopPreview();
                  return;
                }
                onPreview(t.index);
              }}
              aria-pressed={previewingTrack === t.index}
              title="Écouter un extrait de cette piste"
              aria-label={`Pré-écouter la piste ${t.name}`}
            >
              {previewingTrack === t.index ? (
                <>
                  <StopIcon /> Écoute…
                </>
              ) : (
                <>
                  <PlayIcon /> Écouter
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="track-picker-actions">
        <button className="import-btn" onClick={onCancel}>
          Annuler
        </button>
        <button className="play-btn" onClick={onConfirm}>
          Importer la sélection
        </button>
      </div>
    </div>
  );
});

export default TrackPicker;
