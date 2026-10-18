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

export interface MidiWorkerResult {
  name: string;
  tracks: SerializedTrack[];
}

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  const { Midi } = await import("@tonejs/midi");
  let result: MidiWorkerResult;
  try {
    const midi = new Midi(e.data);
    result = {
      name: midi.name ?? "",
      tracks: midi.tracks.map((track, index) => ({
        index,
        name: track.name ?? "",
        percussion: Boolean(track.instrument?.percussion),
        instrumentName: track.instrument?.name ?? "",
        notes: track.notes.map((n) => ({
          midi: n.midi,
          time: n.time,
          duration: n.duration,
          velocity: n.velocity,
        })),
      })),
    };
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  self.postMessage({ result });
};
