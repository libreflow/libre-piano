// Pré-écoute d'une piste MIDI dans le sélecteur d'import (roadmap #50) :
// joue les premières secondes de la piste via un Tone.Part éphémère,
// arrêtable et exclusive (une seule pré-écoute à la fois).

import { useCallback, useEffect, useRef, useState } from "react";
import { Part, getTransport } from "./tone-gate";
import { clampMidiToKeyboard, midiToNoteName } from "./notes";
import { MIN_IMPORTED_NOTE_DURATION_SEC } from "./constants";
import { normalizeVelocity } from "./midi-import";
import type { SongEvent } from "./songs";

/** Durée de l'extrait de pré-écoute, en secondes. */
export const PREVIEW_DURATION_SEC = 8;

/** Construit les événements de pré-écoute d'une piste (8 premières sec). */
export function buildPreviewEvents(
  notes: { midi: number; time: number; duration: number; velocity?: number }[]
): SongEvent[] {
  return notes
    .filter((n) => n.time < PREVIEW_DURATION_SEC)
    .map((n) => ({
      time: n.time,
      note: midiToNoteName(clampMidiToKeyboard(n.midi)),
      duration: Math.max(n.duration, MIN_IMPORTED_NOTE_DURATION_SEC),
      // Audit .mid inaudibles : la pré-écoute doit appliquer le même
      // plancher de vélocité que la lecture, sinon une piste muette à
      // la pré-écoute paraît « ne pas marcher » alors qu'elle jouera.
      velocity: normalizeVelocity(n.velocity),
    }));
}

export function useTrackPreview(
  triggerNote: (note: string, duration: number, time: number, velocity?: number) => void
) {
  const partRef = useRef<Part<SongEvent> | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const [previewingTrack, setPreviewingTrack] = useState<number | null>(null);

  const stop = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    partRef.current?.dispose();
    partRef.current = null;
    setPreviewingTrack(null);
  }, []);

  useEffect(() => stop, [stop]);

  const preview = useCallback(
    (trackIndex: number, notes: { midi: number; time: number; duration: number }[]) => {
      stop();
      const events = buildPreviewEvents(notes);
      if (events.length === 0) return;
      const part = new Part<SongEvent>((time, event) => {
        triggerNote(event.note, event.duration, time, event.velocity);
      }, events);
      part.start(0);
      partRef.current = part;
      setPreviewingTrack(trackIndex);
      const transport = getTransport();
      if (transport.state !== "started") transport.start();
      stopTimerRef.current = window.setTimeout(stop, PREVIEW_DURATION_SEC * 1000);
    },
    [stop, triggerNote]
  );

  return { previewingTrack, preview, stop };
}
