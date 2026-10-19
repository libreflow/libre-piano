// Groupe « Disposition du clavier » de la toolbar (refactor Phase B7) :
// fenêtre d'octave du clavier PC + AZERTY/QWERTY.

import type { KeyboardLayout } from "../notes";
import { OCTAVE_SHIFT_MIN, OCTAVE_SHIFT_MAX } from "../notes";
import { KeyboardIcon, ChevronLeftIcon, ChevronRightIcon } from "../icons";

export interface KeyboardControlsProps {
  octaveShift: number;
  onOctaveShiftChange: (updater: (v: number) => number) => void;
  keyboardLayout: KeyboardLayout;
  onLayoutChange: (layout: KeyboardLayout) => void;
  practiceActive: boolean;
}

export default function KeyboardControls({
  octaveShift,
  onOctaveShiftChange,
  keyboardLayout,
  onLayoutChange,
  practiceActive,
}: KeyboardControlsProps) {
  return (
    <div className="control-group" aria-label="Disposition du clavier">
      <div
        className="segmented"
        role="group"
        aria-label="Octave de la fenêtre clavier PC"
      >
        <button
          onClick={() => onOctaveShiftChange((v) => Math.max(OCTAVE_SHIFT_MIN, v - 1))}
          disabled={octaveShift <= OCTAVE_SHIFT_MIN || practiceActive}
          title="Fenêtre PC : octave précédente"
          aria-label="Fenêtre clavier : octave précédente"
        >
          <ChevronLeftIcon />
        </button>
        <span className="octave-label" aria-live="polite">
          C{3 + octaveShift}
        </span>
        <button
          onClick={() => onOctaveShiftChange((v) => Math.min(OCTAVE_SHIFT_MAX, v + 1))}
          disabled={octaveShift >= OCTAVE_SHIFT_MAX || practiceActive}
          title="Fenêtre PC : octave suivante"
          aria-label="Fenêtre clavier : octave suivante"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="segmented" role="radiogroup" aria-label="AZERTY ou QWERTY">
        {(["azerty", "qwerty"] as const).map((layout) => (
          <button
            key={layout}
            role="radio"
            aria-checked={keyboardLayout === layout}
            className={keyboardLayout === layout ? "seg-active" : ""}
            onClick={() => onLayoutChange(layout)}
            title={`Disposition ${layout.toUpperCase()}`}
          >
            <KeyboardIcon />
            {layout.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
