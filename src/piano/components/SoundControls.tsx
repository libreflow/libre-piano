// Groupe « Réglages » de la toolbar (refactor Phase B7) : vitesse,
// métronome, volume, réverbe, égaliseur, transposition.
// E1 (audit ergonomie) : textes traduits via useI18n.
// E12 (audit ergonomie) : aria-valuetext sur les sliders.

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
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

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
  language: Language;
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
  language,
}: SoundControlsProps) {
  const { t } = useI18n(language);
  return (
    <div className="control-group" aria-label={t("groupSettings")}>
      <label className="speed-label">
        {t("speedLabel")}
        <input
          type="range"
          min={SPEED_MIN_PERCENT}
          max={SPEED_MAX_PERCENT}
          step={SPEED_STEP_PERCENT}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          disabled={isPlaying}
          aria-valuetext={`${speed}%`}
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
          aria-label={t("volume")}
          aria-valuetext={`${volume}%`}
        />
        <span>{volume}%</span>
      </label>
      <label className="speed-label volume" title={t("reverb")}>
        <VolumeIcon />
        <input
          type="range"
          min={REVERB_MIN_PERCENT}
          max={REVERB_MAX_PERCENT}
          step={5}
          value={reverb}
          onChange={(e) => onReverbChange(Number(e.target.value))}
          aria-label={t("reverb")}
          aria-valuetext={interpolate(t("reverbLabel"), { value: reverb })}
        />
        <span>{interpolate(t("reverbLabel"), { value: reverb })}</span>
      </label>
      <label className="speed-label eq-band" title={t("eqHint")}>
        <span aria-hidden="true">{t("eqLabel")}</span>
        <input
          type="range"
          min={EQ_MIN_DB}
          max={EQ_MAX_DB}
          step={1}
          value={eq.low}
          onChange={(e) => onEqChange((prev) => ({ ...prev, low: Number(e.target.value) }))}
          aria-label={t("eqLow")}
          aria-valuetext={`${eq.low} dB`}
        />
        <input
          type="range"
          min={EQ_MIN_DB}
          max={EQ_MAX_DB}
          step={1}
          value={eq.mid}
          onChange={(e) => onEqChange((prev) => ({ ...prev, mid: Number(e.target.value) }))}
          aria-label={t("eqMid")}
          aria-valuetext={`${eq.mid} dB`}
        />
        <input
          type="range"
          min={EQ_MIN_DB}
          max={EQ_MAX_DB}
          step={1}
          value={eq.high}
          onChange={(e) => onEqChange((prev) => ({ ...prev, high: Number(e.target.value) }))}
          aria-label={t("eqHigh")}
          aria-valuetext={`${eq.high} dB`}
        />
      </label>
      <div
        className="segmented"
        role="group"
        aria-label={t("transposeHint")}
        title={t("transposeHint")}
      >
        <button
          onClick={() => onTransposeChange((v) => Math.max(TRANSPOSE_MIN, v - 1))}
          disabled={transpose <= TRANSPOSE_MIN || isPlaying}
          aria-label={t("transposeDown")}
        >
          <ChevronLeftIcon />
        </button>
        <span className="octave-label" aria-live="polite">
          {interpolate(t("transposeLabel"), { value: transpose > 0 ? `+${transpose}` : transpose })}
        </span>
        <button
          onClick={() => onTransposeChange((v) => Math.min(TRANSPOSE_MAX, v + 1))}
          disabled={transpose >= TRANSPOSE_MAX || isPlaying}
          aria-label={t("transposeUp")}
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
});

export default SoundControls;
