// Façade de parsing MIDI asynchrone (roadmap #75) : parse en Web Worker
// quand l'environnement le permet, sinon repli synchrone sur le thread
// principal (tests jsdom, très vieux environnements).

import type { MidiLike } from "./midi-import";
import type { MidiWorkerResult } from "./midi-worker";

let workerFailed = false;

/** Parse un fichier MIDI en worker ; les données lourdes (parsing binaire,
 * tri) restent hors du thread principal. */
export async function parseMidiAsync(buffer: ArrayBuffer): Promise<MidiLike> {
  if (workerFailed || typeof Worker === "undefined") {
    const { loadMidi } = await import("./midi-import");
    return loadMidi(buffer);
  }
  try {
    const worker = new Worker(new URL("./midi-worker.ts", import.meta.url), {
      type: "module",
    });
    try {
      return await new Promise<MidiLike>((resolve, reject) => {
        worker.onmessage = (
          e: MessageEvent<{ result?: MidiWorkerResult; error?: string }>
        ) => {
          const { result, error } = e.data;
          if (error) reject(new Error(error));
          else if (result) resolve(result);
          else reject(new Error("Réponse du worker MIDI invalide."));
        };
        worker.onerror = (e) => reject(new Error(e.message || "Erreur du worker MIDI."));
        worker.postMessage(buffer, [buffer]);
      });
    } finally {
      worker.terminate();
    }
  } catch (err) {
    // Le worker échoue (construction, CORS…) : ne plus essayer et
    // re-essayer synchrone une fois.
    workerFailed = true;
    if (err instanceof Error && /Aucune note exploitable|MIDI/.test(err.message)) {
      // Erreur métier du parsing (pas un problème de worker) : la relancer.
      throw err;
    }
    const { loadMidi } = await import("./midi-import");
    return loadMidi(buffer);
  }
}
