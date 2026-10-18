// Monitoring audio (roadmap #76) : latence effective, état du contexte
// et comptage des nœuds audio vivants (fuites visibles : sampler, reverb,
// parts, buffers). Consommé par l'UI (petit indicateur discret) et les
// tests (le compteur doit retomber à zéro après dispose).

import { getContext, getTransport } from "./tone-gate";

export interface AudioHealth {
  contextState: string;
  baseLatencyMs: number;
  lookAheadMs: number;
  sampleRate: number;
  transportState: string;
}

/** Compteur global de nœuds audio vivants (créés - disposés). */
let liveNodes = 0;
export function trackNodeCreate(): void {
  liveNodes += 1;
}
export function trackNodeDispose(): void {
  liveNodes = Math.max(0, liveNodes - 1);
}
export function liveNodeCount(): number {
  return liveNodes;
}

/** Snapshot de santé audio, pour l'indicateur et les diagnostics. */
export function audioHealth(): AudioHealth {
  const ctx = getContext();
  // baseLatency vit sur le AudioContext natif (pas dans le type de
  // Tone.js) : lecture défensive.
  const native = ctx.rawContext as { baseLatency?: number } | undefined;
  const base = native && typeof native.baseLatency === "number" ? native.baseLatency : 0;
  return {
    contextState: ctx.state,
    baseLatencyMs: Math.round(base * 1000),
    lookAheadMs: Math.round(ctx.lookAhead * 1000),
    sampleRate: ctx.sampleRate,
    transportState: getTransport().state,
  };
}

/** Format court pour l'indicateur UI. */
export function formatHealth(h: AudioHealth): string {
  return `latence ${h.baseLatencyMs + h.lookAheadMs} ms · ${h.contextState}`;
}
