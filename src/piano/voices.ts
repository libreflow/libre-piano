// Timbres de l'instrument (roadmap #21) : le piano acoustique reste le
// sampler Salamander embarqué (public/samples) ; les autres voix sont
// SYNTHÉTISÉES via Tone.js (FMSynth/Synth) — aucun asset supplémentaire
// à embarquer, aucune dépendance de plus.
// Chaque voix porte un gain de normalisation (roadmap #29) : à enveloppe
// égale, les synthés sortent plus fort que le sampler — on les ramène à
// un niveau d'écoute comparable.
// Données PURES (aucun import de tone) : la fabrique vit dans
// useAudioEngine, ce module reste testable isolément.

export type VoiceId = "piano" | "epiano" | "organ" | "celesta";

/** Moteur de synthèse de la voix ("sampler" = sampler Salamander). */
export type VoiceEngine = "sampler" | "fm" | "partials";

export interface VoiceDef {
  id: VoiceId;
  /** Clé i18n du nom affiché dans l'UI. */
  labelKey: string;
  engine: VoiceEngine;
  /** Options passées au PolySynth (null pour le sampler). */
  options: Record<string, unknown> | null;
  /** Gain de normalisation en dB appliqué à la voix (roadmap #29). */
  gainDb: number;
  /** Release normal de la voix (secondes) — restauré après un release
   * de pédale prolongé (SUSTAINED_RELEASE_SEC). */
  releaseSec: number;
}

export const VOICES: VoiceDef[] = [
  {
    id: "piano",
    labelKey: "voicePiano",
    engine: "sampler",
    options: null,
    gainDb: 0,
    releaseSec: 1,
  },
  {
    // Piano électrique (type Rhodes) : FM douce, enveloppe amortie.
    id: "epiano",
    labelKey: "voiceEpiano",
    engine: "fm",
    options: {
      harmonicity: 3.01,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 1.4, sustain: 0.1, release: 1.2 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.2 },
    },
    gainDb: -6,
    releaseSec: 1.2,
  },
  {
    // Orgue : partiels sinusoïdaux empilés ("sineN"), tenue constante
    // pendant que la touche (ou la pédale) reste enfoncée.
    id: "organ",
    labelKey: "voiceOrgan",
    engine: "partials",
    options: {
      oscillator: { type: "sine6" },
      envelope: { attack: 0.02, decay: 0.01, sustain: 0.9, release: 0.4 },
    },
    gainDb: -16,
    releaseSec: 0.4,
  },
  {
    // Cloches / célesta : FM brillante à harmonique aiguë, décroissance
    // naturelle sans tenue.
    id: "celesta",
    labelKey: "voiceCelesta",
    engine: "fm",
    options: {
      harmonicity: 8.5,
      modulationIndex: 14,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 2.2, sustain: 0, release: 1.5 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
    },
    gainDb: -8,
    releaseSec: 1.5,
  },
];

export const DEFAULT_VOICE: VoiceId = "piano";

/** Définition d'une voix par son id (throws si inconnue — ids internes). */
export function getVoice(id: VoiceId): VoiceDef {
  const def = VOICES.find((v) => v.id === id);
  if (!def) throw new Error(`Voix inconnue : ${id}`);
  return def;
}

/** Valide une valeur brute (localStorage/config importée) : les ids
 * inconnus retombent sur le piano — un état corrompu ne doit jamais
 * produire un moteur hybride. */
export function sanitizeVoice(raw: unknown): VoiceId {
  return typeof raw === "string" && VOICES.some((v) => v.id === raw)
    ? (raw as VoiceId)
    : DEFAULT_VOICE;
}
