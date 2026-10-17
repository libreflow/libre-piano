import { useCallback, useEffect, useRef, useState } from "react";
import { Sampler, getDestination, getTransport, tuneForLowLatency } from "./tone-gate";
import { VOLUME_MIN_PERCENT, VOLUME_MAX_PERCENT } from "./constants";

export type SamplerStatus = "loading" | "ready" | "error";

// Échantillons Salamander Grand Piano, servis localement depuis public/samples
// (pas de dépendance réseau au lancement). Tone.Sampler repitch entre les
// notes enregistrées, pas besoin d'un échantillon par demi-ton.
const SAMPLE_URLS: Record<string, string> = {
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

/** Nombre d'échantillons réels (dérivé, plus de constante découpée). */
export const SAMPLE_COUNT = Object.keys(SAMPLE_URLS).length;

function createSampler(onLoaded: () => void, onError: () => void): Sampler {
  return new Sampler({
    urls: SAMPLE_URLS,
    release: 1,
    baseUrl: "samples/",
    onload: onLoaded,
    onerror: onError,
  }).toDestination();
}

export function useAudioEngine(volume: number) {
  const samplerRef = useRef<Sampler | null>(null);
  const [status, setStatus] = useState<SamplerStatus>("loading");
  // Progression : compte des mp3 effectivement téléchargés, pour afficher
  // n/30 pendant le chargement plutôt qu'un indicateur indéterminé.
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    let disposed = false;
    let loaded = 0;
    tuneForLowLatency();
    // Tone télécharge les samples via fetch : on compte les réponses
    // .mp3 pour suivre la progression (limite aux samples du piano).
    const originalFetch = window.fetch;
    window.fetch = ((input, init) => {
      const promise = originalFetch(input, init);
      const url =
        typeof input === "string" ? input : String((input as URL).toString?.() ?? "");
      if (url.includes("samples/")) {
        promise.then(
          () => {
            loaded += 1;
            if (!disposed) setLoadedCount(loaded);
          },
          () => {}
        );
      }
      return promise;
    }) as typeof window.fetch;
    samplerRef.current = createSampler(
      () => !disposed && setStatus("ready"),
      () => !disposed && setStatus("error")
    );
    return () => {
      window.fetch = originalFetch;
      disposed = true;
      samplerRef.current?.dispose();
      samplerRef.current = null;
      getTransport().stop();
      getTransport().cancel();
    };
  }, []);

  // Volume maître : % linéaire -> dB pour Tone.js (0% = muet).
  useEffect(() => {
    const pct = Math.max(VOLUME_MIN_PERCENT, Math.min(VOLUME_MAX_PERCENT, volume));
    getDestination().volume.value = pct <= 0 ? -Infinity : 20 * Math.log10(pct / 100);
  }, [volume]);

  const noteOn = useCallback((note: string) => {
    samplerRef.current?.triggerAttack(note);
  }, []);

  const noteOff = useCallback((note: string) => {
    samplerRef.current?.triggerRelease(note);
  }, []);

  const triggerAttackRelease = useCallback(
    (note: string, duration: number, time?: number) => {
      samplerRef.current?.triggerAttackRelease(note, duration, time);
    },
    []
  );

  return { samplerRef, status, loadedCount, noteOn, noteOff, triggerAttackRelease };
}
