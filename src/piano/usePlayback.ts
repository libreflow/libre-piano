import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Part, ensureAudioStarted, getDraw, getTransport } from "./tone-gate";
import type { Song, SongEvent } from "./songs";
import { songDuration } from "./songs";
import { resolvePlaybackSection } from "./playback-clock";
import { NOTE_HIGHLIGHT_RELEASE_FRACTION, PLAYBACK_END_BUFFER_SEC } from "./constants";

export interface LoopState {
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}

export function usePlayback(
  samplerReady: boolean,
  // P5 (audit perf) : le morceau sélectionné transposé (pas toute la
  // bibliothèque) — la transposition ne porte plus que sur un morceau.
  selectedPlayableSong: Song | undefined,
  speed: number,
  loop: LoopState,
  triggerNote: (note: string, duration: number, time: number, velocity?: number) => void,
  onAutoNoteOn: (note: string) => void,
  onAutoNoteOff: (note: string) => void
) {
  const partRef = useRef<Part<SongEvent> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  // ID de l'événement « fin de morceau » programmé sur le Transport : il
  // doit être retiré ciblé (clear) et non via transport.cancel(), qui
  // purgerait aussi d'autres événements planifiés au Transport.
  const endEventIdRef = useRef<number | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const selectedSongDuration = useMemo(() => {
    return selectedPlayableSong ? songDuration(selectedPlayableSong) : 0;
  }, [selectedPlayableSong]);

  const stopPlayback = useCallback(() => {
    const transport = getTransport();
    transport.stop();
    if (endEventIdRef.current !== null) {
      transport.clear(endEventIdRef.current);
      endEventIdRef.current = null;
    }
    // m3 (audit) : Tone.Draw garde sa propre timeline (rAF + temps
    // audio), indépendante du Transport — transport.stop() ne purge pas
    // les callbacks de surbrillance déjà planifiés : ils tireraient
    // après l'arrêt et allumeraient des touches sans son.
    getDraw().cancel();
    partRef.current?.dispose();
    partRef.current = null;
    setIsPlaying(false);
  }, []);

  const playSong = useCallback(async () => {
    if (!samplerReady || isPlayingRef.current) return;
    await ensureAudioStarted();
    stopPlayback();

    const song = selectedPlayableSong;
    if (!song) return;
    const speedFactor = speed / 100;
    const fullDuration = songDuration(song);

    // Fenêtre A-B normalisée par la MÊME fonction que les affichages
    // (playback-clock) — avant, la lecture réécrivait ses propres bornes
    // et une micro-boucle divergeait du timecode/de la pluie de notes.
    // Inclut : clamp à la durée, bornes croisées échangées, bornes à 0
    // => morceau entier, section minimale MIN_LOOP_SECTION_SEC.
    const { start: sectionStart, end: sectionEnd } = resolvePlaybackSection(
      { enabled: loop.loopEnabled, start: loop.loopStart, end: loop.loopEnd },
      fullDuration
    );

    const windowedEvents = song.events
      .filter((e) => e.time >= sectionStart && e.time < sectionEnd)
      .map((e) => ({ ...e, time: e.time - sectionStart }));

    // Les événements sont en secondes absolues (vitesse x1) ; on applique
    // juste le facteur de vitesse choisi par l'utilisateur.
    const scaledEvents = windowedEvents.map((e) => ({
      time: e.time / speedFactor,
      note: e.note,
      duration: e.duration / speedFactor,
      velocity: e.velocity,
    }));
    const totalDuration = (sectionEnd - sectionStart) / speedFactor;

    const part = new Part<SongEvent>((time, event) => {
      triggerNote(event.note, event.duration, time, event.velocity);
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
      endEventIdRef.current = transport.scheduleOnce(() => {
        getDraw().schedule(() => stopPlayback(), totalDuration);
      }, totalDuration + PLAYBACK_END_BUFFER_SEC);
    }

    transport.start();
    setIsPlaying(true);
  }, [
    selectedPlayableSong,
    loop.loopEnabled,
    loop.loopEnd,
    loop.loopStart,
    onAutoNoteOff,
    onAutoNoteOn,
    samplerReady,
    speed,
    stopPlayback,
    triggerNote,
  ]);

  return { isPlaying, isPlayingRef, selectedSongDuration, playSong, stopPlayback };
}
