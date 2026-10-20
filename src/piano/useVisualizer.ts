// Visualiseur audio (roadmap #30) : forme d'onde globale dessinée sur un
// canvas, branchée en analyse sur la destination. Léger : activable
// depuis les Réglages, n'analyse que quand il est visible.

import { useCallback, useEffect, useRef } from "react";
import { Analyser, getDestination } from "./tone-gate";

/** Taille de la fenêtre d'analyse (puissance de 2). */
const WAVEFORM_SIZE = 256;

export function useVisualizer(enabled: boolean) {
  const analyserRef = useRef<Analyser | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Création de l'analyseur branché sur la destination (signal master).
  useEffect(() => {
    if (!enabled) return;
    const analyser = new Analyser("waveform", WAVEFORM_SIZE);
    getDestination().connect(analyser);
    analyserRef.current = analyser;
    return () => {
      analyser.dispose();
      analyserRef.current = null;
    };
  }, [enabled]);

  // Boucle de dessin.
  useEffect(() => {
    if (!enabled) return;
    // B6 (audit) : la couleur est lue UNE SEULE fois (getComputedStyle force
    // un reflow à chaque appel — 60 fps × reflow = CPU gaspillée).
    const canvas = canvasRef.current;
    const strokeColor =
      (canvas &&
        getComputedStyle(canvas).getPropertyValue("--accent")) ||
      "#7c5cff";
    // B10 (audit) : le canvas a une résolution interne × dpr (HiDPI).
    // On met le contexte à l'échelle pour dessiner en coordonnées CSS.
    const dpr = canvas
      ? Number(canvas.getAttribute("data-dpr")) || 1
      : 1;
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (canvas && analyser) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const values = analyser.getValue() as Float32Array;
          // Coordonnées CSS (le contexte est déjà mis à l'échelle dpr).
          const w = canvas.width / dpr;
          const h = canvas.height / dpr;
          ctx.clearRect(0, 0, w, h);
          ctx.lineWidth = 2;
          ctx.strokeStyle = strokeColor;
          ctx.beginPath();
          const step = w / values.length;
          for (let i = 0; i < values.length; i++) {
            const v = Math.min(1, Math.abs(values[i]));
            const y = h / 2 - (v * h) / 2;
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * step, y);
          }
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    // Mise à l'échelle du contexte pour le HiDPI. setTransform (et non
    // scale) : idempotent — en StrictMode l'effet remonte sur le même
    // canvas et un scale cumulatif dessinerait la waveform 2x trop petite.
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  /** Extrait la valeur instantanée (pour tests). */
  const getLevels = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return null;
    return analyser.getValue() as Float32Array;
  }, []);

  // Actif = enabled ET analyser créé (les deux coïncident après l'effect).
  const getActive = useCallback(() => analyserRef.current !== null, []);
  return { canvasRef, getActive, getLevels };
}
