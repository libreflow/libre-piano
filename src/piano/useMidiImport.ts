import { useCallback, useState } from "react";
import type { Midi } from "@tonejs/midi";
import type { Song } from "./songs";
import {
  loadMidi,
  summarizeTracks,
  buildSongFromTracks,
  TrackSummary,
} from "./midi-import";

// Gestion de l'import MIDI : parsing, sélection des pistes, confirmation.
// Encapsule le dialogue "quelles pistes importer ?" et l'ajout au répertoire.

export interface PendingImport {
  midi: Midi;
  title: string;
  tracks: TrackSummary[];
}

export function useMidiImport(
  addImportedSong: (song: Song) => void,
  setStatusMessage: (msg: string) => void
) {
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [selectedTrackIndices, setSelectedTrackIndices] = useState<Set<number>>(
    new Set()
  );
  const [isImporting, setIsImporting] = useState(false);

  const importFile = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setStatusMessage("");
      try {
        const buffer = await file.arrayBuffer();
        const title = file.name.replace(/\.(mid|midi)$/i, "");
        const midi = loadMidi(buffer);
        const tracks = summarizeTracks(midi).filter((t) => t.noteCount > 0);
        if (tracks.length === 0) {
          throw new Error("Ce fichier ne contient aucune note exploitable.");
        }
        // Par défaut : toutes les pistes mélodiques (percussion décochée).
        const defaultSelection = tracks.filter((t) => !t.percussion);
        const toSelect = defaultSelection.length > 0 ? defaultSelection : tracks;
        setSelectedTrackIndices(new Set(toSelect.map((t) => t.index)));
        setPendingImport({ midi, title, tracks });
      } catch (err) {
        setStatusMessage(
          `Échec de l'import : ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setIsImporting(false);
      }
    },
    [setStatusMessage]
  );

  const toggleTrack = useCallback((index: number) => {
    setSelectedTrackIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const confirmImport = useCallback(() => {
    if (!pendingImport) return null;
    if (selectedTrackIndices.size === 0) {
      setStatusMessage("Sélectionne au moins une piste à importer.");
      return null;
    }
    try {
      const { song, warnings } = buildSongFromTracks(
        pendingImport.midi,
        [...selectedTrackIndices],
        pendingImport.title
      );
      addImportedSong(song);
      setStatusMessage(
        warnings.length > 0
          ? `"${song.title}" importé — ${warnings.join(" ")}`
          : `"${song.title}" importé avec succès (${song.events.length} notes).`
      );
      return song;
    } catch (err) {
      setStatusMessage(
        `Échec de l'import : ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    } finally {
      setPendingImport(null);
    }
  }, [addImportedSong, pendingImport, selectedTrackIndices, setStatusMessage]);

  const cancelImport = useCallback(() => setPendingImport(null), []);

  return {
    pendingImport,
    selectedTrackIndices,
    isImporting,
    importFile,
    toggleTrack,
    confirmImport,
    cancelImport,
  };
}
