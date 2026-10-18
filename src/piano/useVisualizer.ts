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
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (canvas && analyser) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const values = analyser.getValue() as Float32Array;
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          ctx.lineWidth = 2;
          ctx.strokeStyle =
            getComputedStyle(canvas).getPropertyValue("--accent") || "#7c5cff";
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
