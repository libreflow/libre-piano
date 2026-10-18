import { useCallback, useEffect, useRef, useState } from "react";
import { trackNodeCreate, trackNodeDispose } from "./audio-health";
import {
  EQ3,
  Reverb,
  Sampler,
  ToneAudioBuffer,
  getDestination,
  getTransport,
  tuneForLowLatency,
} from "./tone-gate";
import {
  VOLUME_MIN_PERCENT,
  VOLUME_MAX_PERCENT,
  REVERB_MIN_PERCENT,
  REVERB_MAX_PERCENT,
} from "./constants";
import { EQ_MIN_DB, EQ_MAX_DB } from "./constants";

export type SamplerStatus = "loading" | "ready" | "error";

/** Release d'une note normale (secondes). */
const NOTE_RELEASE_SEC = 1;
/** Release d'une note tenue par la pédale de sustain (roadmap #28) :
 * la note continue de sonner en s'éteignant doucement, comme une vraie
 * pédale forte — au lieu d'être coupée net au relâchement de la pédale. */
const SUSTAINED_RELEASE_SEC = 3.5;

// Échantillons Salamander Grand Piano, servis localement depuis public/samples
// (pas de dépendance réseau au lancement). Tone.Sampler repitch entre les
// notes enregistrées, pas besoin d'un échantillon par demi-ton.
export const SAMPLE_URLS: Record<string, string> = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};

/** Nombre d'échantillons réels (dérivé, plus de constante découplée). */
export const SAMPLE_COUNT = Object.keys(SAMPLE_URLS).length;

export interface EqSettings {
  low: number;
  mid: number;
  high: number;
}

export function useAudioEngine(
  volume: number,
  reverbPercent: number,
  eq: EqSettings = { low: 0, mid: 0, high: 0 }
) {
  const samplerRef = useRef<Sampler | null>(null);
  // Réverbe (roadmap #23) : chaîne sampler -> reverb -> destination.
  // Nœud créé au montage, la profondeur est pilotée par le slider.
  const reverbRef = useRef<Reverb | null>(null);
  // Égaliseur (roadmap #24) : chaîne sampler -> reverb -> eq -> destination.
  const eqRef = useRef<EQ3 | null>(null);
  const [status, setStatus] = useState<SamplerStatus>("loading");
  // Progression : nombre de buffers effectivement décodés (n/SAMPLE_COUNT).
  const [loadedCount, setLoadedCount] = useState(0);
  // Retry (roadmap #73) : numéro de tentative, incrémenté par
  // l'utilisateur depuis le message d'erreur. L'effect de chargement
  // dépend de ce compteur et se relance proprement (dispose inclus).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    tuneForLowLatency();

    // Préchargement explicite des buffers : chaque ToneAudioBuffer résout sa
    // propre promesse, ce qui donne une progression fiable (plus de
    // monkey-patch de window.fetch) et permet de passer les buffers
    // directement au Sampler.
    const entries = Object.entries(SAMPLE_URLS);
    let loaded = 0;
    let failed = 0;

    const buffers = new Map<string, ToneAudioBuffer>();
    const loadOne = (note: string, file: string) =>
      new Promise<void>((resolve) => {
        const buffer = new ToneAudioBuffer(
          `samples/${file}`,
          () => {
            if (disposed) return resolve();
            loaded += 1;
            setLoadedCount(loaded);
            resolve();
          },
          () => {
            if (disposed) return resolve();
            failed += 1;
            setLoadedCount(loaded + failed);
            resolve();
          }
        );
        buffers.set(note, buffer);
        trackNodeCreate();
      });

    const allSettled = Promise.all(entries.map(([n, f]) => loadOne(n, f)));

    allSettled.then(() => {
      if (disposed) return;
      if (failed > 0) {
        setStatus("error");
        return;
      }
      const samples: Record<string, ToneAudioBuffer | string> = {};
      for (const [note, buffer] of buffers) {
        samples[note] = buffer;
      }
      const eq = new EQ3().toDestination();
      trackNodeCreate();
      eqRef.current = eq;
      const reverb = new Reverb({ decay: 2.4, preDelay: 0.02 }).connect(eq);
      trackNodeCreate();
      reverb.wet.value = 0;
      reverbRef.current = reverb;
      samplerRef.current = new Sampler({
        urls: samples,
        release: NOTE_RELEASE_SEC,
        onload: () => setStatus("ready"),
        onerror: () => setStatus("error"),
      }).connect(reverb);
      trackNodeCreate();
    });

    return () => {
      disposed = true;
      samplerRef.current?.dispose();
      trackNodeDispose();
      samplerRef.current = null;
      reverbRef.current?.dispose();
      trackNodeDispose();
      reverbRef.current = null;
      eqRef.current?.dispose();
      trackNodeDispose();
      eqRef.current = null;
      buffers.forEach((b) => {
        b.dispose();
        trackNodeDispose();
      });
      getTransport().stop();
      getTransport().cancel();
    };
  }, [attempt]);

  /** Retry manuel après un échec de chargement (roadmap #73). */
  const retryLoading = useCallback(() => {
    setLoadedCount(0);
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  // Volume maître : % linéaire -> dB pour Tone.js (0% = muet).
  useEffect(() => {
    const pct = Math.max(VOLUME_MIN_PERCENT, Math.min(VOLUME_MAX_PERCENT, volume));
    getDestination().volume.value = pct <= 0 ? -Infinity : 20 * Math.log10(pct / 100);
  }, [volume]);

  // Égaliseur (roadmap #24) : 3 bandes en dB, clampées.
  useEffect(() => {
    const eqNode = eqRef.current;
    if (!eqNode) return;
    const clamp = (v: number) => Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, v));
    eqNode.low.value = clamp(eq.low);
    eqNode.mid.value = clamp(eq.mid);
    eqNode.high.value = clamp(eq.high);
  }, [eq.low, eq.mid, eq.high]);

  // Réverbe : le slider pilote la part wet du nœud (0 = complètement sec).
  useEffect(() => {
    const pct = Math.max(REVERB_MIN_PERCENT, Math.min(REVERB_MAX_PERCENT, reverbPercent));
    if (reverbRef.current) reverbRef.current.wet.value = pct / 100;
  }, [reverbPercent]);

  const noteOn = useCallback((note: string, velocity?: number) => {
    samplerRef.current?.triggerAttack(note, undefined, velocity);
  }, []);

  const noteOff = useCallback((note: string) => {
    samplerRef.current?.triggerRelease(note);
  }, []);
  /** Libère une note tenue par la pédale (roadmap #28) : release long,
   * la note s'éteint doucement au lieu d'être coupée. */
  const releaseSustainedNote = useCallback((note: string) => {
    const sampler = samplerRef.current;
    if (!sampler) return;
    const previous = sampler.release;
    sampler.release = SUSTAINED_RELEASE_SEC;
    sampler.triggerRelease(note);
    sampler.release = previous;
  }, []);

  const triggerAttackRelease = useCallback(
    (note: string, duration: number, time?: number, velocity?: number) => {
      samplerRef.current?.triggerAttackRelease(note, duration, time, velocity);
    },
    []
  );

  return {
    samplerRef,
    status,
    loadedCount,
    retryLoading,
    noteOn,
    noteOff,
    releaseSustainedNote,
    triggerAttackRelease,
  };
}
