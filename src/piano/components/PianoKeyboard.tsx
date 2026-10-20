// Clavier 88 touches (refactor Phase B1) : touches blanches/noires,
// labels, surbrillance par état — composant purement passif, toutes
// les valeurs et callbacks viennent des props.

import { memo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PianoKey, LabelMode } from "../notes";
import { noteToSolfege } from "../notes";
import type { Language } from "../i18n";
import { interpolate } from "../i18n";
import { useI18n } from "../useI18n";

interface PianoKeyboardProps {
  allKeys: PianoKey[];
  whiteKeyCount: number;
  windowKeys: Map<string, string>;
  labelMode: LabelMode;
  isPlaying: boolean;
  /** Classes d'état d'une touche : expected/active/auto-active/sustained/next. */
  keyStateClass: (note: string) => string;
  /** Notes actives (pour pointerLeave : relâcher une note tenue). */
  activeNotes: ReadonlySet<string>;
  onPointerDown: (note: string, e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (note: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** E1 (audit ergonomie) : langue pour les aria-labels des touches. */
  language: Language;
}

const KeyLabel = memo(function KeyLabel({
  note,
  labelMode,
  windowKeys,
}: {
  note: string;
  labelMode: LabelMode;
  windowKeys: Map<string, string>;
}) {
  if (labelMode === "none") return null;
  return (
    <span className="key-label">
      {(labelMode === "lettres" || labelMode === "both") && windowKeys.get(note)}
      {labelMode === "solfege" && noteToSolfege(note)}
      {labelMode === "both" && (
        <span className="key-label-solfege">{noteToSolfege(note)}</span>
      )}
    </span>
  );
});

// B14 (audit) : React.memo — évite de re-rendre les 88 boutons à chaque
// frame de lecture (playbackSeconds change 60×/s en haut de l'arbre).
const PianoKeyboard = memo(function PianoKeyboard({
  allKeys,
  whiteKeyCount,
  windowKeys,
  labelMode,
  isPlaying,
  keyStateClass,
  activeNotes,
  onPointerDown,
  onPointerUp,
  scrollRef,
  language,
}: PianoKeyboardProps) {
  // E1 (audit ergonomie) : aria-labels traduits.
  const { t } = useI18n(language);
  return (
    <div
      className="piano-scroll"
      ref={scrollRef}
      role="group"
      aria-label={t("pianoGroup")}
    >
      <div
        className={`piano ${isPlaying ? "piano-readonly" : ""}`}
        style={{ ["--white-keys" as any]: whiteKeyCount }}
      >
        {allKeys
          .filter((k) => !k.isBlack)
          .map((k) => (
            <button
              key={k.note}
              className={`key white ${keyStateClass(k.note)}${
                k.note.startsWith("C") ? " octave-marker" : ""
              }`}
              style={{ ["--index" as any]: k.whiteIndex }}
              tabIndex={-1}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                onPointerDown(k.note, e);
              }}
              onPointerUp={() => onPointerUp(k.note)}
              onPointerCancel={() => onPointerUp(k.note)}
              onPointerLeave={() => activeNotes.has(k.note) && onPointerUp(k.note)}
              title={`${noteToSolfege(k.note)} (${k.note})`}
              aria-label={interpolate(t("keyLabel"), { note: k.note })}
            >
              <KeyLabel note={k.note} labelMode={labelMode} windowKeys={windowKeys} />
            </button>
          ))}
        {allKeys
          .filter((k) => k.isBlack)
          .map((k) => (
            <button
              key={k.note}
              className={`key black ${keyStateClass(k.note)}`}
              style={{ ["--index" as any]: k.whiteIndex }}
              tabIndex={-1}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                onPointerDown(k.note, e);
              }}
              onPointerUp={() => onPointerUp(k.note)}
              onPointerCancel={() => onPointerUp(k.note)}
              onPointerLeave={() => activeNotes.has(k.note) && onPointerUp(k.note)}
              title={`${noteToSolfege(k.note)} (${k.note})`}
              aria-label={interpolate(t("keyLabel"), { note: k.note })}
            >
              <KeyLabel note={k.note} labelMode={labelMode} windowKeys={windowKeys} />
            </button>
          ))}
      </div>
    </div>
  );
});

export default PianoKeyboard;
