// Point d'entrée unique de Tone.js pour toute l'app : si l'on doit changer
// de bibliothèque audio ou ajuster les imports, c'est ici seulement.
// On ré-exporte depuis le module racine "tone" : les sous-chemins internes
// (tone/build/esm/...) ne sont pas une API publique et peuvent casser selon
// l'environnement de bundling.
import { getContext, start } from "tone";

export {
  Sampler,
  Part,
  Loop,
  Reverb,
  EQ3,
  Analyser,
  ToneAudioBuffer,
  getContext,
  getTransport,
  getDestination,
  getDraw,
} from "tone";

/** Baisse le look-ahead du planificateur audio pour réduire la latence
 * input -> son. Le défaut de Tone.js (0.1 s = 100 ms) rend chaque note
 * "en retard" ; 20 ms est imperceptible tout en laissant au contexte le
 * temps de planifier sans crackle. */
export function tuneForLowLatency() {
  const ctx = getContext();
  ctx.lookAhead = 0.02;
}

/** Tone.start() ne résout qu'une fois le contexte démarré ; les appels
 * suivants sont quasi gratuits, mais on mémoïse la promesse pour éviter
 * le moindre await superflu sur le chemin critique d'une touche. */
let startPromise: Promise<void> | null = null;
export function ensureAudioStarted(): Promise<void> {
  startPromise ??= start();
  return startPromise;
}
