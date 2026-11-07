// Refonte IA (surface épurée) : le panneau Studio regroupe les réglages
// de fond — Son, Clavier, Boucle A-B — dans un tiroir latéral coulissant.
// NON MODAL volontairement : on ajuste l'EQ ou la fenêtre d'octave PENDANT
// qu'on joue, comme sur une vraie table de mixage. Escape ou le bouton
// de fermeture referment ; le focus entre dans le panneau à l'ouverture.

import { memo, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons";
import { useI18n } from "../useI18n";
import type { Language } from "../i18n";

interface StudioDrawerProps {
  open: boolean;
  onClose: () => void;
  language: Language;
  children: ReactNode;
}

const StudioDrawer = memo(function StudioDrawer({
  open,
  onClose,
  language,
  children,
}: StudioDrawerProps) {
  const { t } = useI18n(language);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-label={t("studioTitle")}
      className="studio-drawer"
      style={{ outline: "none" }}
    >
      <header className="studio-header">
        <h3>{t("studioTitle")}</h3>
        <button
          className="import-btn icon-btn"
          onClick={onClose}
          aria-label={t("close")}
          title={t("close")}
        >
          <CloseIcon />
        </button>
      </header>
      {children}
    </div>
  );
});

export default StudioDrawer;
