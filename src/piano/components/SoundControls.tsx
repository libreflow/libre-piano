// Groupe « Réglages » de la toolbar (refactor Phase B7) : vitesse,
// métronome, volume, réverbe, égaliseur, transposition.

import { memo } from "react";
import { VolumeIcon, ChevronLeftIcon, ChevronRightIcon } from "../icons";
import {
  SPEED_MIN_PERCENT,
  SPEED_MAX_PERCENT,
  SPEED_STEP_PERCENT,
  VOLUME_MIN_PERCENT,
  VOLUME_MAX_PERCENT,
  REVERB_MIN_PERCENT,
  REVERB_MAX_PERCENT,
  EQ_MIN_DB,
  EQ_MAX_DB,
} from "../constants";
import { TRANSPOSE_MIN, TRANSPOSE_MAX } from "../transpose";
import type { EqSettings } from "../useAudioEngine";

export interface SoundControlsProps {
  speed: number;
  onSpeedChange: (v: number) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  reverb: number;
  onReverbChange: (v: number) => void;
  eq: EqSettings;
  onEqChange: (updater: (prev: EqSettings) => EqSettings) => void;
  transpose: number;
  onTransposeChange: (updater: (v: number) => number) => void;
  isPlaying: boolean;
}

// B14 (audit) : React.memo — composant passif, props stables.
const SoundControls = memo(function SoundControls({
  speed,
  onSpeedChange,
  volume,
  onVolumeChange,
  reverb,
  onReverbChange,
  eq,
  onEqChange,
  transpose,
  onTransposeChange,
  isPlaying,
}: SoundControlsProps) {
  return (
    <div className="control-group" aria-label="Réglages">
      <label className="speed-label">
        Vitesse
        <input
          type="range"
          min={SPEED_MIN_PERCENT}
          max={SPEED_MAX_PERCENT}
          step={SPEED_STEP_PERCENT}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          disabled={isPlaying}
        />
        <span>{speed}%</span>
      </label>

      <label className="speed-label volume">
        <VolumeIcon />
        <input
          type="range"
          min={VOLUME_MIN_PERCENT}
          max={VOLUME_MAX_PERCENT}
          step={5}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
        />
        <span>{volume}%</span>
      </label>
      <label className="speed-label volume" title="Profondeur de la réverbe">
        <VolumeIcon />
        <input
          type="range"
          min={REVERB_MIN_PERCENT}
          max={REVERB_MAX_PERCENT}
          step={5}
          value={reverb}
          onChange={(e) => onReverbChange(Number(e.target.value))}
        />
        <span>Réverbe {reverb}%</span>
      </label>
      <label className="speed-label eq-band" title="Égaliseur — graves">
        <span aria-hidden="true">EQ</span>
        <input
          type="range"
          min={EQ_MIN_DB}
          max={EQ_MAX_DB}
          step={1}
          value={eq.low}
          onChange={(e) => onEqChange((prev) => ({ ...prev, low: Number(e.target.value) }))}
          aria-label="Égaliseur — bandes graves"
        />
        <input
          type="range"
          min={EQ_MIN_DB}
          max={EQ_MAX_DB}
          step={1}
          value={eq.mid}
          onChange={(e) => onEqChange((prev) => ({ ...prev, mid: Number(e.target.value) }))}
          aria-label="Égaliseur — bandes médiums"
        />
        <input
          type="range"
          min={EQ_MIN_DB}
          max={EQ_MAX_DB}
          step={1}
          value={eq.high}
          onChange={(e) => onEqChange((prev) => ({ ...prev, high: Number(e.target.value) }))}
          aria-label="Égaliseur — bandes aigus"
        />
      </label>
      <div
        className="segmented"
        role="group"
        aria-label="Transposition en demi-tons"
        title="Transposer la lecture (± demi-tons)"
      >
        <button
          onClick={() => onTransposeChange((v) => Math.max(TRANSPOSE_MIN, v - 1))}
          disabled={transpose <= TRANSPOSE_MIN || isPlaying}
          aria-label="Transposer un demi-ton plus bas"
        >
          <ChevronLeftIcon />
        </button>
        <span className="octave-label" aria-live="polite">
          {transpose > 0 ? `+${transpose}` : transpose} st
        </span>
        <button
          onClick={() => onTransposeChange((v) => Math.min(TRANSPOSE_MAX, v + 1))}
          disabled={transpose >= TRANSPOSE_MAX || isPlaying}
          aria-label="Transposer un demi-ton plus haut"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
});

export default SoundControls;
