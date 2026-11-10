// Bibliothèque de morceaux (extrait de Piano.tsx) : fusion builtin + importés,
// favoris des deux sources persistés (roadmap #60, audit : les favoris
// intégrés étaient perdus au redémarrage), sélection validée et
// suppression avec modale (E3) + nettoyage des stats (B10).

import { useCallback, useMemo, useState } from "react";
import { BUILTIN_SONGS, type Song } from "../songs";
import { useFavorites, applyBuiltinFavorites } from "./useFavorites";

export interface SongLibraryApi {
  importedSongs: Song[];
  allSongs: Song[];
  selectedSong: Song | undefined;
  selectedSongId: string;
  setSelectedSongId: (id: string) => void;
  addImportedSong: (song: Song) => void;
  /** Restaure une bibliothèque entière (import de configuration). */
  setImportedSongs: (songs: Song[]) => void;
  /** Favoris des morceaux intégrés (persistés — audit). */
  builtinFavoriteIds: string[];
  /** Restaure les favoris intégrés (import de configuration). */
  setBuiltinFavoriteIds: (ids: string[]) => void;
  toggleFavorite: (id: string) => void;
  deleteTarget: Song | null;
  requestDeleteSong: (id: string) => void;
  confirmDeleteSong: (onDeleted: (id: string) => void) => void;
  cancelDeleteSong: () => void;
}

export function useSongLibrary(
  initialImportedSongs: Song[],
  initialSelectedSongId: string | null,
  initialBuiltinFavoriteIds: string[]
): SongLibraryApi {
  const [importedSongs, setImportedSongs] = useState<Song[]>(initialImportedSongs);
  const [selectedSongId, setSelectedSongId] = useState(
    initialSelectedSongId &&
      [...BUILTIN_SONGS, ...initialImportedSongs].some(
        (s) => s.id === initialSelectedSongId
      )
      ? initialSelectedSongId
      : (BUILTIN_SONGS[0]?.id ?? "")
  );
  const { builtinFavorites, setBuiltinFavorites, toggleFavorite: toggleBuiltinFavorite } =
    useFavorites(initialBuiltinFavoriteIds);
  const allSongs = useMemo(
    () =>
      applyBuiltinFavorites([...BUILTIN_SONGS, ...importedSongs], builtinFavorites),
    [importedSongs, builtinFavorites]
  );
  const selectedSong = useMemo(
    () => allSongs.find((s) => s.id === selectedSongId),
    [allSongs, selectedSongId]
  );
  // Snapshot stable pour la persistance (identité mémoïsée).
  const builtinFavoriteIds = useMemo(
    () => [...builtinFavorites],
    [builtinFavorites]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setImportedSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s))
      );
      // Le Set des favoris intégrés ne doit contenir que des ids
      // intégrés (sinon les ids importés y seraient persistés en vrac).
      if (BUILTIN_SONGS.some((s) => s.id === id)) toggleBuiltinFavorite(id);
    },
    [toggleBuiltinFavorite]
  );

  const addImportedSong = useCallback((song: Song) => {
    setImportedSongs((prev) => [...prev, song]);
    setSelectedSongId(song.id);
  }, []);
  const setImportedSongsDirect = useCallback((songs: Song[]) => {
    setImportedSongs(songs);
  }, []);
  const setBuiltinFavoriteIdsDirect = useCallback((ids: string[]) => {
    setBuiltinFavorites(
      new Set(ids.filter((id) => BUILTIN_SONGS.some((s) => s.id === id)))
    );
  }, [setBuiltinFavorites]);

  // E3 : la suppression passe par une modale — le morceau à supprimer est
  // mémorisé dans deleteTarget, la suppression réelle a lieu à la confirmation.
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const requestDeleteSong = useCallback(
    (id: string) => {
      const song = importedSongs.find((s) => s.id === id);
      if (song) setDeleteTarget(song);
    },
    [importedSongs]
  );
  const confirmDeleteSong = useCallback(
    (onDeleted: (id: string) => void) => {
      const song = deleteTarget;
      setDeleteTarget(null);
      if (!song) return;
      setImportedSongs((prev) => prev.filter((s) => s.id !== song.id));
      onDeleted(song.id);
      setSelectedSongId((current) =>
        current === song.id ? (BUILTIN_SONGS[0]?.id ?? "") : current
      );
    },
    [deleteTarget]
  );
  const cancelDeleteSong = useCallback(() => setDeleteTarget(null), []);

  return {
    importedSongs,
    allSongs,
    selectedSong,
    selectedSongId,
    setSelectedSongId,
    addImportedSong,
    setImportedSongs: setImportedSongsDirect,
    builtinFavoriteIds,
    setBuiltinFavoriteIds: setBuiltinFavoriteIdsDirect,
    toggleFavorite,
    deleteTarget,
    requestDeleteSong,
    confirmDeleteSong,
    cancelDeleteSong,
  };
}
