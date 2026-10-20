// Dialogue de sélection des pistes MIDI (refactor Phase B3) :
// choisis les pistes à importer, pré-écoute possible.
// E1 (audit ergonomie) : textes traduits via useI18n.

import { memo } from "react";
import { PlayIcon, StopIcon, StarIcon } from "../icons";
import { DISPLAY_CHORD_RATIO_THRESHOLD } from "../constants";
import type { PendingImport } from "../useMidiImport";
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

interface TrackPickerProps {
  pendingImport: PendingImport;
  selectedTrackIndices: ReadonlySet<number>;
  previewingTrack: number | null;
  language: Language;
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
  language,
  onToggleTrack,
  onPreview,
  onStopPreview,
  onConfirm,
  onCancel,
}: TrackPickerProps) {
  const { t } = useI18n(language);
  return (
    <div className="track-picker">
      <h3>{interpolate(t("tracksTitle"), { title: pendingImport.title })}</h3>
      <p className="track-picker-hint">
        {t("trackPickerHint")}
      </p>
      <ul className="track-list">
        {pendingImport.tracks.map((trk) => (
          <li key={trk.index}>
            <label className={trk.likelyMelody ? "likely-melody" : ""}>
              <input
                type="checkbox"
                checked={selectedTrackIndices.has(trk.index)}
                onChange={() => onToggleTrack(trk.index)}
              />
              <span className="track-info">
                <span className="track-title">
                  {trk.name} — {interpolate(t("trackNotes"), { count: trk.noteCount })}
                  {trk.likelyMelody && (
                    <span className="melody-tag">
                      <StarIcon /> {t("melodyTag")}
                    </span>
                  )}
                </span>
                <span className="track-details">
                  {trk.pitchRange} ·{" "}
                  {trk.chordRatio > DISPLAY_CHORD_RATIO_THRESHOLD
                    ? t("chordsLabel")
                    : t("monophonic")}
                  {trk.percussion ? ` · ${t("percussion")}` : ""}
                  {trk.instrumentName ? ` · ${trk.instrumentName}` : ""}
                  {trk.handRole === "right"
                    ? ` · ${t("handRight")}`
                    : trk.handRole === "left"
                      ? ` · ${t("handLeft")}`
                      : ""}
                </span>
              </span>
            </label>
            <button
              className="import-btn preview-btn"
              onClick={() => {
                if (previewingTrack === trk.index) {
                  onStopPreview();
                  return;
                }
                onPreview(trk.index);
              }}
              aria-pressed={previewingTrack === trk.index}
              title={t("listenHint")}
              aria-label={interpolate(t("previewTrack"), { name: trk.name })}
            >
              {previewingTrack === trk.index ? (
                <>
                  <StopIcon /> {t("previewStop")}
                </>
              ) : (
                <>
                  <PlayIcon /> {t("previewStart")}
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="track-picker-actions">
        <button className="import-btn" onClick={onCancel}>
          {t("cancelBtn")}
        </button>
        <button className="play-btn" onClick={onConfirm}>
          {t("importSelectionBtn")}
        </button>
      </div>
    </div>
  );
});

export default TrackPicker;
