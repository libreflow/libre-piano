// Boucle A-B (refactor Phase B5) : activation + bornes début/fin.
// E1 (audit ergonomie) : textes traduits via useI18n.

import { memo, useEffect, useState } from "react";
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

// Audit : un <input type="number"> contrôlé avec `value.toFixed(1)`
// reformatte la valeur à CHAQUE frappe — saisir « 0.5 » était
// impossible (le point était écrasé par le reformat). Texte local
// brut tant que le champ a le focus, synchronisé à la perte du focus.
const LoopBoundInput = memo(function LoopBoundInput({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onCommit,
  ariaLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled: boolean;
  onCommit: (v: number) => void;
  ariaLabel: string;
}) {
  const [text, setText] = useState(value.toFixed(1));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value.toFixed(1));
  }, [value, focused]);
  const commit = (raw: string) => {
    setText(raw);
    const parsed = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(parsed)) onCommit(parsed);
  };
  return (
    <label className="loop-bound">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => commit(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(value.toFixed(1));
        }}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {suffix}
    </label>
  );
});

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
      <LoopBoundInput
        label={t("loopStartLabel")}
        value={loopStart}
        min={0}
        max={Math.max(0, loopEnd - 0.1)}
        step={0.5}
        suffix={t("loopSeconds")}
        disabled={isPlaying || !loopEnabled}
        onCommit={onStartChange}
        ariaLabel={t("loopStartLabel")}
      />
      <LoopBoundInput
        label={t("loopEndLabel")}
        value={loopEnd}
        min={loopStart + 0.1}
        max={songDuration}
        step={0.5}
        suffix={t("loopSeconds")}
        disabled={isPlaying || !loopEnabled}
        onCommit={onEndChange}
        ariaLabel={t("loopEndLabel")}
      />
      <span className="loop-total">
        {interpolate(t("loopTotalLabel"), { value: songDuration.toFixed(1) })}
      </span>
    </div>
  );
});

export default LoopControls;
