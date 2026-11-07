// Pluie de notes (hors-piste volontaire, vision « Synthesia ») : canvas
// branché sur l'horloge de lecture partagée (playback-clock) et sur la
// géométrie physique des 88 touches (note-rain). Les notes tombent et
// écrasent leur touche au moment exact où elle sonne.

import { memo, useEffect, useRef } from "react";
import { getTransport } from "../tone-gate";
import type { SongEvent } from "../songs";
import {
  playbackSeconds,
  playbackSection,
  type PlaybackWindow,
} from "../playback-clock";
import {
  NOTE_RAIN_LOOKAHEAD_SEC,
  laneKind,
  noteLane,
  rainCanvasWidth,
  visibleRainEvents,
} from "../note-rain";

interface NoteRainProps {
  /** Lecture en cours : la pluie dessine. Sinon, la bande reste
   * montée (aucun saut de mise en page au démarrage) mais vide. */
  active: boolean;
  events: SongEvent[];
  songDuration: number;
  speed: number;
  loop: PlaybackWindow;
}

const RAIN_HEIGHT = 150;

const NoteRain = memo(function NoteRain({
  active,
  events,
  songDuration,
  speed,
  loop,
}: NoteRainProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Miroir refs : Piano re-render à chaque note pendant la lecture — un
  // seul effet [] doit suffire, l'état se lit à chaud dans la boucle.
  const stateRef = useRef({ active, events, songDuration, speed, loop });
  stateRef.current = { active, events, songDuration, speed, loop };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Géométrie : le canvas suit --key-w (responsive, défini sur
    // .piano-scroll pour que l'overlay en hérite) et le dpr (HiDPI).
    let keyW = 60;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const accent =
      getComputedStyle(canvas).getPropertyValue("--accent").trim() ||
      "#7c5cff";
    const measure = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parseFloat(getComputedStyle(canvas).getPropertyValue("--key-w"));
      if (Number.isFinite(w) && w > 0) keyW = w;
      const cssW = rainCanvasWidth(keyW);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(RAIN_HEIGHT * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${RAIN_HEIGHT}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    measure();
    window.addEventListener("resize", measure);

    const H = RAIN_HEIGHT;
    let raf = 0;
    const pxPerSec = H / NOTE_RAIN_LOOKAHEAD_SEC;
    const draw = () => {
      const { active, events, songDuration, speed, loop } = stateRef.current;
      const W = rainCanvasWidth(keyW);
      // Hors lecture : la bande reste montée (zéro saut de mise en
      // page) mais ne dessine rien.
      if (!active) {
        ctx.clearRect(0, 0, W, H);
        raf = requestAnimationFrame(draw);
        return;
      }
      const { start, end } = playbackSection(loop, songDuration);
      const now = playbackSeconds(
        getTransport().seconds,
        speed,
        loop,
        songDuration
      );
      ctx.clearRect(0, 0, W, H);

      for (const { event, startDelta } of visibleRainEvents(events, now)) {
        if (event.time < start - 0.01 || event.time > end) continue;
        const lane = noteLane(event.note, keyW);
        if (!lane) continue;
        // Projection : delta=0 (la note écrase sa touche) -> bas du
        // canvas ; delta=lookahead -> haut.
        const yBottom = H - startDelta * pxPerSec;
        const h = Math.max(4, event.duration * pxPerSec);
        const y = yBottom - h;
        if (yBottom < 0 || y > H) continue;

        const sounding = startDelta <= 0 && startDelta + event.duration >= 0;
        const kind = laneKind(event.note);
        const alpha = Math.min(1, 0.35 + (event.velocity ?? 1) * 0.65);

        ctx.globalAlpha = sounding ? 1 : alpha;
        ctx.fillStyle = kind === "white" ? accent : "#3d3a6e";
        ctx.shadowBlur = sounding ? 12 : 0;
        if (sounding) ctx.shadowColor = accent;
        ctx.beginPath();
        ctx.roundRect(lane.x + 1, Math.max(0, y), Math.max(2, lane.width - 2), h, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="note-rain-canvas"
      height={RAIN_HEIGHT}
      aria-hidden="true"
    />
  );
});

export default NoteRain;
