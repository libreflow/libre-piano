import { useCallback, useState } from "react";
import type { Song } from "./songs";
import {
  summarizeTracks,
  buildSongFromTracks,
  TrackSummary,
  MidiLike,
} from "./midi-import";
import { parseMidiAsync } from "./parse-midi-async";
import type { Language } from "./i18n";
import { translate, interpolate } from "./i18n";

// Gestion de l'import MIDI : parsing, sélection des pistes, confirmation.
// Encapsule le dialogue "quelles pistes importer ?" et l'ajout au répertoire.

export interface PendingImport {
  midi: MidiLike;
  title: string;
  tracks: TrackSummary[];
}

export function useMidiImport(
  addImportedSong: (song: Song) => void,
  setStatusMessage: (msg: string) => void,
  // E1 (audit ergonomie) : langue pour les messages de statut de l'import.
  language: Language = "fr"
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
        // Import dynamique : @tonejs/midi est volumineux et ne sert qu'ici,
        // il reste hors du bundle initial (chargé au premier import).
        // Parsing en Web Worker (roadmap #75) : gros fichiers hors du
        // thread principal, l'UI reste fluide pendant l'import.
        const midi = await parseMidiAsync(buffer);
        const tracks = summarizeTracks(midi).filter((t) => t.noteCount > 0);
        if (tracks.length === 0) {
          throw new Error(translate(language, "importNoTracks"));
        }
        // Par défaut : toutes les pistes mélodiques (percussion décochée).
        const defaultSelection = tracks.filter((t) => !t.percussion);
        const toSelect = defaultSelection.length > 0 ? defaultSelection : tracks;
        setSelectedTrackIndices(new Set(toSelect.map((t) => t.index)));
        setPendingImport({ midi, title, tracks });
      } catch (err) {
        setStatusMessage(
          interpolate(translate(language, "importFailed"), {
            message: err instanceof Error ? err.message : String(err),
          })
        );
      } finally {
        setIsImporting(false);
      }
    },
    [setStatusMessage, language]
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
      setStatusMessage(translate(language, "importNoSelection"));
      return null;
    }
    try {
      const { song, warnings } = buildSongFromTracks(
        pendingImport.midi,
        [...selectedTrackIndices],
        pendingImport.title,
        language
      );
      addImportedSong(song);
      setStatusMessage(
        warnings.length > 0
          ? interpolate(translate(language, "importSuccessWarn"), {
              title: song.title,
              warnings: warnings.join(" "),
            })
          : interpolate(translate(language, "importSuccess"), {
              title: song.title,
              count: song.events.length,
            })
      );
      return song;
    } catch (err) {
      setStatusMessage(
        interpolate(translate(language, "importFailed"), {
          message: err instanceof Error ? err.message : String(err),
        })
      );
      return null;
    } finally {
      setPendingImport(null);
    }
  }, [addImportedSong, pendingImport, selectedTrackIndices, setStatusMessage, language]);

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
