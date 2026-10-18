// Métronome (roadmap #27) : tick régulier pendant la lecture ou en solo,
// basé sur Tone.Loop branché sur le Transport. Le tick est une note de
// sampler très courte et discrète, donc aucun son supplémentaire à bundler.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loop, getContext, getTransport } from "./tone-gate";

/** Tempo par défaut du métronome (BPM). */
export const METRONOME_DEFAULT_BPM = 100;
export const METRONOME_MIN_BPM = 40;
export const METRONOME_MAX_BPM = 240;

/** Note et durée du tick : aigu et très court pour rester discret. */
const TICK_NOTE = "C8";
const TICK_DURATION_SEC = 0.03;
/** Volume du tick relatif au master (dB) : nettement sous le piano. */
const TICK_VOLUME_DB = -12;

export function useMetronome(triggerTick: (time?: number) => void) {
  const loopRef = useRef<Loop | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [bpm, setBpmRaw] = useState(METRONOME_DEFAULT_BPM);

  const setBpm = useCallback((value: number) => {
    const clamped = Math.max(
      METRONOME_MIN_BPM,
      Math.min(METRONOME_MAX_BPM, Math.round(value))
    );
    setBpmRaw(clamped);
    if (getContext().state === "running" && loopRef.current) {
      loopRef.current.interval = 60 / clamped;
    }
  }, []);

  // Ref miroir : le callback du Loop est créé une fois, il doit lire le
  // triggerTick courant sans recréer le nœud.
  const triggerRef = useRef(triggerTick);
  useEffect(() => {
    triggerRef.current = triggerTick;
  }, [triggerTick]);

  // Création/destruction du nœud selon `enabled`.
  useEffect(() => {
    if (!enabled) {
      loopRef.current?.dispose();
      loopRef.current = null;
      return;
    }
    const loop = new Loop((time) => {
      triggerRef.current(time);
    }, 60 / bpm);
    loop.start(0);
    loopRef.current = loop;
    return () => {
      loop.dispose();
      loopRef.current = null;
    };
    // bpm volontairement absent : géré par setBpm sur l'instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  return { enabled, bpm, setBpm, toggle, loopRef };
}

/**
 * Construit le callback de tick : une note de sampler courte, atténuée,
 * déclenchée à l'heure exacte du Transport (pas à l'heure JS).
 */
export function makeTickTrigger(
  samplerRef: React.RefObject<{
    triggerAttackRelease: (n: string, d: number, t?: number, v?: number) => void;
  } | null>
): (time?: number) => void {
  return (time?: number) => {
    const sampler = samplerRef.current;
    if (!sampler) return;
    const velocity = Math.pow(10, TICK_VOLUME_DB / 20);
    if (time !== undefined) {
      sampler.triggerAttackRelease(TICK_NOTE, TICK_DURATION_SEC, time, velocity);
    } else {
      sampler.triggerAttackRelease(TICK_NOTE, TICK_DURATION_SEC, undefined, velocity);
    }
  };
}

/** Exposure pour tests : le transport doit être arrêté quand le métronome
 * tourne seul, sinon le tick ne démarre pas (Transport suspendu). */
export function startTransportForMetronome() {
  if (getTransport().state !== "started") getTransport().start();
}
