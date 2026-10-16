// Point d'entrée unique de Tone.js pour toute l'app : si l'on doit changer
// de bibliothèque audio ou ajuster les imports, c'est ici seulement.
// On ré-exporte depuis le module racine "tone" : les sous-chemins internes
// (tone/build/esm/...) ne sont pas une API publique et peuvent casser selon
// l'environnement de bundling.
export { Sampler, Part, start, getTransport, getDestination, getDraw } from "tone";
