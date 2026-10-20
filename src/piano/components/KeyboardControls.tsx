// Groupe « Disposition du clavier » de la toolbar (refactor Phase B7) :
// fenêtre d'octave du clavier PC + AZERTY/QWERTY.
// E1 (audit ergonomie) : textes traduits via useI18n.

import { memo } from "react";
import type { KeyboardLayout } from "../notes";
import { OCTAVE_SHIFT_MIN, OCTAVE_SHIFT_MAX } from "../notes";
import { KeyboardIcon, ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

export interface KeyboardControlsProps {
  octaveShift: number;
  onOctaveShiftChange: (updater: (v: number) => number) => void;
  keyboardLayout: KeyboardLayout;
  onLayoutChange: (layout: KeyboardLayout) => void;
  practiceActive: boolean;
  language: Language;
}

// B14 (audit) : React.memo — composant passif, props stables.
const KeyboardControls = memo(function KeyboardControls({
  octaveShift,
  onOctaveShiftChange,
  keyboardLayout,
  onLayoutChange,
  practiceActive,
  language,
}: KeyboardControlsProps) {
  const { t } = useI18n(language);
  return (
    <div className="control-group" aria-label={t("groupLayout")}>
      <div
        className="segmented"
        role="group"
        aria-label={t("octaveWindow")}
      >
        <button
          onClick={() => onOctaveShiftChange((v) => Math.max(OCTAVE_SHIFT_MIN, v - 1))}
          disabled={octaveShift <= OCTAVE_SHIFT_MIN || practiceActive}
          title={t("octavePrev")}
          aria-label={t("octavePrev")}
        >
          <ChevronLeftIcon />
        </button>
        <span className="octave-label" aria-live="polite">
          {interpolate(t("octaveLabel"), { value: 3 + octaveShift })}
        </span>
        <button
          onClick={() => onOctaveShiftChange((v) => Math.min(OCTAVE_SHIFT_MAX, v + 1))}
          disabled={octaveShift >= OCTAVE_SHIFT_MAX || practiceActive}
          title={t("octaveNext")}
          aria-label={t("octaveNext")}
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="segmented" role="radiogroup" aria-label="AZERTY / QWERTY">
        {(["azerty", "qwerty"] as const).map((layout) => (
          <button
            key={layout}
            role="radio"
            aria-checked={keyboardLayout === layout}
            className={keyboardLayout === layout ? "seg-active" : ""}
            onClick={() => onLayoutChange(layout)}
            title={layout === "azerty" ? t("layoutAzerty") : t("layoutQwerty")}
          >
            <KeyboardIcon />
            {layout === "azerty" ? t("layoutAzerty") : t("layoutQwerty")}
          </button>
        ))}
      </div>
    </div>
  );
});

export default KeyboardControls;
