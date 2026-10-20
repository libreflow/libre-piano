// Enregistrement live (roadmap #46) : capture les notes jouées par
// l'utilisateur (clavier/souris) en événements à temps absolu, puis
// les transforme en morceau importable dans la bibliothèque.

import { useCallback, useEffect, useRef, useState } from "react";
import { getContext } from "./tone-gate";
import type { Song, SongEvent } from "./songs";

/** Nom par défaut du morceau enregistré (horodaté pour l'unicité). */
export function recordedSongTitle(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Enregistrement ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}h${pad(now.getMinutes())}`;
}

/** Durée minimale d'une note capturée (évite les notes nulles). */
const MIN_CAPTURED_DURATION_SEC = 0.05;
/** Durée max d'une note capturée sans noteOff (sécurité). */
const MAX_CAPTURED_DURATION_SEC = 12;

interface OpenNote {
  time: number;
  velocity?: number;
}

export function useRecorder(nowFn: () => number = () => getContext().now()) {
  const [isRecording, setIsRecording] = useState(false);
  // Miroirs refs : les callbacks de capture sont stables (pas de
  // recréation quand isRecording change), ils lisent ces refs à chaud.
  const isRecordingRef = useRef(false);
  const nowFnRef = useRef(nowFn);
  useEffect(() => {
    nowFnRef.current = nowFn;
  }, [nowFn]);
  const startRef = useRef(0);
  const openRef = useRef<Map<string, OpenNote>>(new Map());
  const eventsRef = useRef<SongEvent[]>([]);

  const start = useCallback(() => {
    startRef.current = nowFnRef.current();
    openRef.current = new Map();
    eventsRef.current = [];
    isRecordingRef.current = true;
    setIsRecording(true);
  }, []);

  const stop = useCallback((): Song | null => {
    // Notes restées ouvertes : durée jusqu'à l'arrêt, plafonnée.
    isRecordingRef.current = false;
    const elapsed = nowFnRef.current() - startRef.current;
    for (const [note, open] of openRef.current) {
      const duration = Math.min(
        Math.max(elapsed - open.time, MIN_CAPTURED_DURATION_SEC),
        MAX_CAPTURED_DURATION_SEC
      );
      eventsRef.current.push({
        time: open.time,
        note,
        duration,
        velocity: open.velocity,
      });
    }
    openRef.current = new Map();
    setIsRecording(false);
    const events = [...eventsRef.current].sort((a, b) => a.time - b.time);
    if (events.length === 0) return null;
    return {
      id: `recording-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: recordedSongTitle(),
      events,
      source: "imported",
    };
  }, []);

  const captureNoteOff = useCallback((note: string) => {
    if (!isRecordingRef.current) return;
    const open = openRef.current.get(note);
    if (!open) return;
    openRef.current.delete(note);
    const duration = Math.min(
      Math.max(
        nowFnRef.current() - startRef.current - open.time,
        MIN_CAPTURED_DURATION_SEC
      ),
      MAX_CAPTURED_DURATION_SEC
    );
    eventsRef.current.push({ time: open.time, note, duration, velocity: open.velocity });
  }, []);

  const captureNoteOn = useCallback(
    (note: string, velocity?: number) => {
      if (!isRecordingRef.current) return;
      // B5 (audit) : double noteOn sur la même note (double-clic rapide
      // sans noteOff intermédiaire) — fermer l'ancienne d'abord, sinon
      // elle serait perdue (écrasée) et resterait ouverte jusqu'au stop().
      captureNoteOff(note);
      openRef.current.set(note, { time: nowFnRef.current() - startRef.current, velocity });
    },
    [captureNoteOff]
  );

  // Sécurité : libérer les refs au démontage.
  useEffect(() => {
    return () => {
      openRef.current = new Map();
    };
  }, []);

  return { isRecording, start, stop, captureNoteOn, captureNoteOff };
}
