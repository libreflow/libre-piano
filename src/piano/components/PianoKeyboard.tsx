// Clavier 88 touches (refactor Phase B1) : touches blanches/noires,
// labels, surbrillance par état — composant purement passif, toutes
// les valeurs et callbacks viennent des props.

import type { PointerEvent as ReactPointerEvent } from "react";
import type { PianoKey, LabelMode } from "../notes";
import { noteToSolfege } from "../notes";

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
}

function KeyLabel({
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
}

export default function PianoKeyboard({
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
}: PianoKeyboardProps) {
  return (
    <div
      className="piano-scroll"
      ref={scrollRef}
      role="group"
      aria-label="Clavier de piano 88 touches — joué au clavier PC ou à la souris, hors navigation Tab"
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
              aria-label={`Touche ${k.note}`}
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
              aria-label={`Touche ${k.note}`}
            >
              <KeyLabel note={k.note} labelMode={labelMode} windowKeys={windowKeys} />
            </button>
          ))}
      </div>
    </div>
  );
}
