import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Part, ensureAudioStarted, getDraw, getTransport } from "./tone-gate";
import type { Song, SongEvent } from "./songs";
import { songDuration } from "./songs";
import { NOTE_HIGHLIGHT_RELEASE_FRACTION, PLAYBACK_END_BUFFER_SEC } from "./constants";

export interface LoopState {
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}

export function usePlayback(
  samplerReady: boolean,
  allSongs: Song[],
  selectedSongId: string,
  speed: number,
  loop: LoopState,
  triggerNote: (note: string, duration: number, time: number) => void,
  onAutoNoteOn: (note: string) => void,
  onAutoNoteOff: (note: string) => void
) {
  const partRef = useRef<Part<SongEvent> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const selectedSongDuration = useMemo(() => {
    const song = allSongs.find((s) => s.id === selectedSongId);
    return song ? songDuration(song) : 0;
  }, [allSongs, selectedSongId]);

  const stopPlayback = useCallback(() => {
    getTransport().stop();
    getTransport().cancel();
    partRef.current?.dispose();
    partRef.current = null;
    setIsPlaying(false);
  }, []);

  const playSong = useCallback(async () => {
    if (!samplerReady || isPlayingRef.current) return;
    await ensureAudioStarted();
    stopPlayback();

    const song = allSongs.find((s) => s.id === selectedSongId) ?? allSongs[0];
    if (!song) return;
    const speedFactor = speed / 100;
    const fullDuration = songDuration(song);

    // Si la boucle A-B est active, on ne garde que les événements de la
    // section choisie, retimés pour démarrer à 0.
    // Bornes défensives : saisies invalides (NaN) ou bornes croisées ne
    // doivent jamais produire une boucle vide jouée en boucle rapide.
    const clampedStart = Math.max(
      0,
      Math.min(Number.isFinite(loop.loopStart) ? loop.loopStart : 0, fullDuration)
    );
    const clampedEnd = Math.max(
      0,
      Math.min(Number.isFinite(loop.loopEnd) ? loop.loopEnd : 0, fullDuration)
    );
    // Bornes croisées : on les échange franchement plutôt que de jouer
    // une section vide/de 0.1 s en boucle rapide.
    let sectionStart = loop.loopEnabled ? clampedStart : 0;
    let sectionEnd = loop.loopEnabled ? clampedEnd : fullDuration;
    if (loop.loopEnabled && sectionStart > sectionEnd) {
      [sectionStart, sectionEnd] = [sectionEnd, sectionStart];
    }
    if (loop.loopEnabled && sectionEnd - sectionStart < 0.1) {
      sectionEnd = sectionStart + 0.1;
    }

    const windowedEvents = song.events
      .filter((e) => e.time >= sectionStart && e.time < sectionEnd)
      .map((e) => ({ ...e, time: e.time - sectionStart }));

    // Les événements sont en secondes absolues (vitesse x1) ; on applique
    // juste le facteur de vitesse choisi par l'utilisateur.
    const scaledEvents = windowedEvents.map((e) => ({
      time: e.time / speedFactor,
      note: e.note,
      duration: e.duration / speedFactor,
    }));
    const totalDuration = (sectionEnd - sectionStart) / speedFactor;

    const part = new Part<SongEvent>((time, event) => {
      triggerNote(event.note, event.duration, time);
      getDraw().schedule(() => onAutoNoteOn(event.note), time);
      getDraw().schedule(
        () => onAutoNoteOff(event.note),
        time + event.duration * NOTE_HIGHLIGHT_RELEASE_FRACTION
      );
    }, scaledEvents);
    part.start(0);
    if (loop.loopEnabled) {
      part.loop = true;
      part.loopStart = 0;
      part.loopEnd = totalDuration;
    }
    partRef.current = part;

    const transport = getTransport();
    if (!loop.loopEnabled) {
      transport.scheduleOnce(() => {
        getDraw().schedule(() => stopPlayback(), totalDuration);
      }, totalDuration + PLAYBACK_END_BUFFER_SEC);
    }

    transport.start();
    setIsPlaying(true);
  }, [
    allSongs,
    loop.loopEnabled,
    loop.loopEnd,
    loop.loopStart,
    onAutoNoteOff,
    onAutoNoteOn,
    samplerReady,
    selectedSongId,
    speed,
    stopPlayback,
    triggerNote,
  ]);

  return { isPlaying, isPlayingRef, selectedSongDuration, playSong, stopPlayback };
}
