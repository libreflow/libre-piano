// Overlay de lecture (extrait de Piano.tsx) : paroles synchronisées et
// marqueurs de mesures, rafraîchis par RAF pendant la lecture.
// P1 (audit perf) : composant isolé et mémoïsé — le RAF à 60 fps ne
// re-rend que cet overlay, pas PianoInner (88 touches, contrôles).

import { memo, useEffect, useState } from "react";
import { getTransport } from "../tone-gate";
import type { Song } from "../songs";
import { REFERENCE_BPM } from "../constants";

interface PlaybackOverlayProps {
  song: Song | undefined;
  songDuration: number;
  speed: number;
}

const PlaybackOverlay = memo(function PlaybackOverlay({
  song,
  songDuration,
  speed,
}: PlaybackOverlayProps) {
  // Temps de lecture courant (roadmaps #41/#99) : rafraîchi par RAF
  // pendant la lecture, pour les marqueurs de mesures et les paroles.
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPlaybackSeconds(getTransport().seconds);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // M4 (audit) : les événements du morceau sont scalés par speedFactor,
  // transport.seconds avance donc en temps « réduit » — on le ramène en
  // temps x1 avant de comparer aux lyrics et marqueurs de mesures.
  const speedFactor = Math.max(1, speed) / 100;
  const songSeconds = playbackSeconds * speedFactor;
  // Paroles synchronisées (roadmap #99) : ligne courante du morceau
  // sélectionné, selon le temps de lecture.
  const currentLyric = song?.lyrics
    ?.filter((l) => l.time <= songSeconds)
    .pop();
  return (
    <div className="playback-overlay" aria-live="off">
      {song?.lyrics && song.lyrics.length > 0 ? (
        <div className="lyrics-line" key={currentLyric?.text}>
          {currentLyric?.text ?? "…"}
        </div>
      ) : null}
      <div className="measure-track" aria-hidden="true">
        {/* B11 (audit) : le nombre de mesures est dérivé de la durée
            du morceau (avant : plafond fixe de 32 mesures = 76,8 s à
            100 BPM — les morceaux plus longs n'avaient plus de marqueurs). */}
        {Array.from(
          {
            length: Math.max(
              1,
              Math.ceil(songDuration / ((4 * 60) / REFERENCE_BPM))
            ),
          },
          (_, i) => {
            const measureSec = (i * 4 * 60) / REFERENCE_BPM;
            const active =
              songSeconds >= measureSec &&
              songSeconds < measureSec + (4 * 60) / REFERENCE_BPM;
            return (
              <span
                key={i}
                className={`measure-dot${active ? " active" : ""}${
                  i % 4 === 0 ? " strong" : ""
                }`}
              />
            );
          }
        )}
      </div>
    </div>
  );
});

export default PlaybackOverlay;
