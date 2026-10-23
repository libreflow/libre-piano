// Comportements de scroll du clavier 88 touches (extrait de Piano.tsx) :
// centrage initial sur C4, auto-scroll vers la note attendue (apprentissage),
// molette verticale convertie en scroll horizontal.
// B13 : repli 60px si la variable CSS --key-w est absente.

import { useEffect } from "react";
import { getWhitePositionOfNote } from "../notes";

/** Largeur d'une touche blanche, lue depuis la variable CSS (B13 : repli 60px). */
function readKeyWidth(piano: Element): number {
  return parseFloat(getComputedStyle(piano).getPropertyValue("--key-w")) || 60;
}

export function usePianoScroll(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  /** Note à suivre (apprentissage), null pour aucun suivi. */
  noteToFollow: string | null
) {
  // Centrer le clavier sur la zone médiane (C4) au montage.
  useEffect(() => {
    const el = scrollRef.current;
    const piano = el?.querySelector(".piano");
    if (!el || !piano) return;
    const idx = getWhitePositionOfNote("C4");
    const keyW = readKeyWidth(piano);
    el.scrollLeft = Math.max(0, idx * keyW - el.clientWidth / 2);
  }, [scrollRef]);

  // Auto-scroll : suivre la note attendue si elle sort de la zone visible.
  useEffect(() => {
    if (!noteToFollow) return;
    const el = scrollRef.current;
    const piano = el?.querySelector(".piano");
    if (!el || !piano) return;
    const idx = getWhitePositionOfNote(noteToFollow);
    if (idx < 0) return;
    const keyW = readKeyWidth(piano);
    const x = idx * keyW;
    const view = el.clientWidth;
    if (x < el.scrollLeft + keyW) {
      el.scrollTo({ left: Math.max(0, x - view / 3), behavior: "smooth" });
    } else if (x + keyW > el.scrollLeft + view - keyW) {
      el.scrollTo({
        left: x - view * (2 / 3),
        behavior: "smooth",
      });
    }
  }, [noteToFollow, scrollRef]);

  // Molette : la molette verticale fait défiler le clavier horizontalement.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scrollRef]);
}
