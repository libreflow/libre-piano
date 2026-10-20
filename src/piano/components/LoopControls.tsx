// Boucle A-B (refactor Phase B5) : activation + bornes début/fin.
// E1 (audit ergonomie) : textes traduits via useI18n.

import { memo } from "react";
import { LoopIcon } from "../icons";
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

interface LoopControlsProps {
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  songDuration: number;
  isPlaying: boolean;
  language: Language;
  onToggle: (enabled: boolean) => void;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
}

// B14 (audit) : React.memo — composant passif, props stables.
const LoopControls = memo(function LoopControls({
  loopEnabled,
  loopStart,
  loopEnd,
  songDuration,
  isPlaying,
  language,
  onToggle,
  onStartChange,
  onEndChange,
}: LoopControlsProps) {
  const { t } = useI18n(language);
  return (
    <div className="loop-controls">
      <label className="loop-toggle">
        <input
          type="checkbox"
          checked={loopEnabled}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={isPlaying}
        />
        <LoopIcon /> {t("loopToggle")}
      </label>
      <label className="loop-bound">
        {t("loopStartLabel")}
        <input
          type="number"
          min={0}
          max={Math.max(0, loopEnd - 0.1)}
          step={0.5}
          value={loopStart.toFixed(1)}
          onChange={(e) => onStartChange(Number(e.target.value))}
          disabled={isPlaying || !loopEnabled}
        />
        {t("loopSeconds")}
      </label>
      <label className="loop-bound">
        {t("loopEndLabel")}
        <input
          type="number"
          min={loopStart + 0.1}
          max={songDuration}
          step={0.5}
          value={loopEnd.toFixed(1)}
          onChange={(e) => onEndChange(Number(e.target.value))}
          disabled={isPlaying || !loopEnabled}
        />
        {t("loopSeconds")}
      </label>
      <span className="loop-total">
        {interpolate(t("loopTotalLabel"), { value: songDuration.toFixed(1) })}
      </span>
    </div>
  );
});

export default LoopControls;
