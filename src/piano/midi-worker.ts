// Web Worker (roadmap #75) : parsing lourd d'un fichier MIDI hors du
// thread principal. Reçoit l'ArrayBuffer brut, renvoie les pistes
// sérialisées (plain objects transférables). Le thread principal
// retravaille ensuite ces données (résumés, construction du morceau) —
// le parsing binaire et le tri, qui sont la partie coûteuse, restent ici.

export interface SerializedNote {
  midi: number;
  time: number;
  duration: number;
  velocity?: number;
}

export interface SerializedTrack {
  index: number;
  name: string;
  notes: SerializedNote[];
  percussion: boolean;
  instrumentName: string;
}

export interface SerializedLyric {
  time: number;
  text: string;
}

export interface MidiWorkerResult {
  name: string;
  tracks: SerializedTrack[];
  /** Meta events "lyrics" (roadmap #99), convertis en secondes. */
  lyrics?: SerializedLyric[];
}

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  const { Midi } = await import("@tonejs/midi");
  const { normalizeVelocity } = await import("./midi-import");
  let result: MidiWorkerResult;
  try {
    const midi = new Midi(e.data);
    // Paroles (roadmap #99) : meta events "lyrics" de l'en-tête,
    // convertis des ticks vers les secondes via le header.
    const lyrics = (midi.header.meta as { type?: string; text?: string }[])
      .filter((m) => m.type === "lyrics" && typeof m.text === "string")
      .map((m) => ({
        time: midi.header.ticksToSeconds((m as { ticks?: number }).ticks ?? 0),
        text: (m as { text?: string }).text ?? "",
      }))
      .filter((l) => l.text.length > 0)
      .sort((a, b) => a.time - b.time);
    result = {
      name: midi.name ?? "",
      lyrics: lyrics.length > 0 ? lyrics : undefined,
      tracks: midi.tracks.map((track, index) => ({
        index,
        name: track.name ?? "",
        percussion: Boolean(track.instrument?.percussion),
        instrumentName: track.instrument?.name ?? "",
        notes: track.notes.map((n) => ({
          midi: n.midi,
          time: n.time,
          duration: n.duration,
          // Normalisation (audit .mid inaudibles) : les ghost notes à
          // vélocité quasi nulle doivent être audibles partout, y compris
          // dans la pré-écoute des pistes — pas seulement à la lecture.
          velocity: normalizeVelocity(n.velocity),
        })),
      })),
    };
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  self.postMessage({ result });
};
