// Overlay de lecture (extrait de Piano.tsx) : paroles synchronisées et
// marqueurs de mesures, rafraîchis par RAF pendant la lecture.
// P1 (audit perf) : composant isolé et mémoïsé — le RAF à 60 fps ne
// re-rend que cet overlay, pas PianoInner (88 touches, contrôles).

import { memo, useEffect, useState } from "react";
import { getTransport } from "../tone-gate";
import type { Song } from "../songs";
import { REFERENCE_BPM } from "../constants";
import { playbackSeconds } from "../playback-clock";
import { useI18n } from "../useI18n";
import type { Language } from "../i18n";

interface PlaybackOverlayProps {
  song: Song | undefined;
  songDuration: number;
  speed: number;
  language: Language;
  /** Fenêtre de lecture boucle A-B. */
  loop: { enabled: boolean; start: number; end: number };
}

const PlaybackOverlay = memo(function PlaybackOverlay({
  song,
  songDuration,
  speed,
  language,
  loop,
}: PlaybackOverlayProps) {
  const { t } = useI18n(language);
  // Temps de lecture courant (roadmaps #41/#99) : rafraîchi par RAF
  // pendant la lecture, pour les marqueurs de mesures et les paroles.
  const [transportSeconds, setTransportSeconds] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setTransportSeconds(getTransport().seconds);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // M4 (audit) + refonte : la position « temps x1 dans la fenêtre jouée »
  // vit dans playback-clock — partagée avec la pluie de notes pour ne
  // jamais diverger d'un affichage à l'autre.
  const songSeconds = playbackSeconds(
    transportSeconds,
    speed,
    loop,
    songDuration
  );
  // Refonte UI (ergonomie) : timecode + barre de progression — un
  // lecteur pro montre où en est le morceau, pas seulement des mesures.
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };
  const progress = songDuration > 0 ? Math.min(100, (songSeconds / songDuration) * 100) : 0;
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
      {/* Audit refonte : role=progressbar + valeurs — un aria-label sur
          une div sans rôle est ignoré par les lecteurs d'écran. */}
      <div className="playback-progress">
        <div
          className="progress-track"
          role="progressbar"
          aria-label={t("playbackPosition")}
          aria-valuemin={0}
          aria-valuemax={Math.round(songDuration)}
          aria-valuenow={Math.round(songSeconds)}
        >
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="playback-time" aria-hidden="true">
          <strong>{fmt(songSeconds)}</strong>
          <span className="time-total"> / {fmt(songDuration)}</span>
        </span>
      </div>
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
