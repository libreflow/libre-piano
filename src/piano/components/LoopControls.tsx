// Boucle A-B (refactor Phase B5) : activation + bornes début/fin.

import { memo } from "react";
import { LoopIcon } from "../icons";

interface LoopControlsProps {
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  songDuration: number;
  isPlaying: boolean;
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
  onToggle,
  onStartChange,
  onEndChange,
}: LoopControlsProps) {
  return (
    <div className="loop-controls">
      <label className="loop-toggle">
        <input
          type="checkbox"
          checked={loopEnabled}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={isPlaying}
        />
        <LoopIcon /> Boucle A-B
      </label>
      <label className="loop-bound">
        Début
        <input
          type="number"
          min={0}
          max={Math.max(0, loopEnd - 0.1)}
          step={0.5}
          value={loopStart.toFixed(1)}
          onChange={(e) => onStartChange(Number(e.target.value))}
          disabled={isPlaying || !loopEnabled}
        />
        s
      </label>
      <label className="loop-bound">
        Fin
        <input
          type="number"
          min={loopStart + 0.1}
          max={songDuration}
          step={0.5}
          value={loopEnd.toFixed(1)}
          onChange={(e) => onEndChange(Number(e.target.value))}
          disabled={isPlaying || !loopEnabled}
        />
        s
      </label>
      <span className="loop-total">/ {songDuration.toFixed(1)}s au total</span>
    </div>
  );
});

export default LoopControls;
