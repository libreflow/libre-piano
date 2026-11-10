// Favoris (refactor Phase A3) : les favoris des morceaux importés sont
// persistés dans la bibliothèque ; ceux des morceaux intégrés vivent
// dans un Set dédié — désormais persisté aussi (audit : ils étaient
// perdus à chaque redémarrage contrairement aux importés).

import { useCallback, useState } from "react";
import type { Song } from "../songs";

export function useFavorites(initialFavoriteIds: string[]) {
  const [builtinFavorites, setBuiltinFavorites] = useState<Set<string>>(
    () => new Set(initialFavoriteIds)
  );

  const toggleFavorite = useCallback((id: string) => {
    setBuiltinFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { builtinFavorites, setBuiltinFavorites, toggleFavorite };
}

/** Applique les favoris intégrés à la liste fusionnée builtin + importés. */
export function applyBuiltinFavorites(
  songs: Song[],
  builtinFavorites: Set<string>
): Song[] {
  if (builtinFavorites.size === 0) return songs;
  return songs.map((s) =>
    s.source === "builtin" && builtinFavorites.has(s.id)
      ? { ...s, favorite: true }
      : s
  );
}

/** Tri d'affichage de la bibliothèque (roadmap #54/#60) : favoris en
 * tête, puis imports récents avant les morceaux intégrés.
 * m1 (audit) : un seul tri avec comparateur composé. Deux .sort()
 * chaînés (favoris puis source) rendaient la DERNIÈRE clé primaire :
 * un favori intégré passait sous un importé non favori. */
export function sortLibrary(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => {
    const favDiff = Number(b.favorite ?? false) - Number(a.favorite ?? false);
    if (favDiff !== 0) return favDiff;
    return Number(b.source === "imported") - Number(a.source === "imported");
  });
}

/** Identifiants des favoris persistés (importés). */
export function importedFavoriteIds(songs: Song[]): string[] {
  return songs.filter((s) => s.favorite).map((s) => s.id);
}
