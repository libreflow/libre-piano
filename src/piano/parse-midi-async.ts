// Façade de parsing MIDI asynchrone (roadmap #75) : parse en Web Worker
// quand l'environnement le permet, sinon repli synchrone sur le thread
// principal (tests jsdom, très vieux environnements).

import type { MidiLike } from "./midi-import";

/** Erreur d'infrastructure du worker (construction, échec de chargement
 * du module, message invalide) : le repli synchrone est légitime. */
export class MidiWorkerInfraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MidiWorkerInfraError";
  }
}

/** Une seule panne d'infrastructure => on ne retente plus le worker. */
let workerFailed = false;

/** Parse un fichier MIDI en worker ; les données lourdes (parsing binaire,
 * tri) restent hors du thread principal. */
export async function parseMidiAsync(buffer: ArrayBuffer): Promise<MidiLike> {
  if (workerFailed || typeof Worker === "undefined") {
    const { loadMidi } = await import("./midi-import");
    return loadMidi(buffer);
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL("./midi-worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    // Impossible de créer le worker (CORS, environnement) : repli sync,
    // et ne plus essayer le worker pour les imports suivants.
    workerFailed = true;
    const { loadMidi } = await import("./midi-import");
    return loadMidi(buffer);
  }
  try {
    return await new Promise<MidiLike>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<{ result?: unknown; error?: string }>) => {
        const { result, error } = e.data;
        // Erreur métier du parsing (fichier corrompu...) : elle doit
        // remonter telle quelle, SANS coller le drapeau workerFailed.
        if (error) reject(new Error(error));
        else if (result) resolve(result as MidiLike);
        else reject(new MidiWorkerInfraError("Réponse du worker MIDI invalide."));
      };
      worker.onerror = (e) =>
        reject(new MidiWorkerInfraError(e.message || "Erreur du worker MIDI."));
      // Pas de transfer list : postMessage clone le buffer par
      // structured clone et l'original reste utilisable côté appelant.
      // Transférer `[buffer]` détacherait l'original — et le repli
      // synchrone du catch doit pouvoir relire les mêmes données.
      worker.postMessage(buffer);
    });
  } catch (err) {
    // Seule une panne d'infrastructure retente en synchrone : une erreur
    // de parsing (fichier invalide) rééchouerait à l'identique.
    if (err instanceof MidiWorkerInfraError) {
      workerFailed = true;
      const { loadMidi } = await import("./midi-import");
      return loadMidi(buffer);
    }
    throw err;
  } finally {
    worker.terminate();
  }
}
