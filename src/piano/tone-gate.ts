// Imports ciblés de Tone.js au lieu de `import * as Tone` : le bundle final
// ne contient que les modules réellement utilisés (Sampler, Part, contexte
// global), ce qui réduit significativement sa taille.
import { Sampler } from "tone/build/esm/instrument/Sampler.js";
import { Part } from "tone/build/esm/event/Part.js";
import { getContext, start } from "tone/build/esm/core/Global.js";

export { Sampler, Part };
export { start };

export const getTransport = () => getContext().transport;
export const getDestination = () => getContext().destination;
export const getDraw = () => getContext().draw;
