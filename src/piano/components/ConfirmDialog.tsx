// E3 (audit ergonomie) : modale de confirmation custom — remplace
// window.confirm() (bloquant, non stylisable, non traduisible).

import { memo, useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = memo(function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // UX (audit) : action destructive — le focus initial est sur ANNULER,
  // pas sur « Supprimer » : une pression réflexe d'Enter doit être la
  // voie sûre. (Avant : le focus partait sur le bouton Supprimer.)
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      // Piège de focus Tab : le clavier ne doit pas ressortir de la
      // modale vers les contrôles masqués en arrière-plan.
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLButtonElement | null;
      e.preventDefault();
      if (e.shiftKey) {
        (active === first ? last : focusable[Math.max(0, focusable.indexOf(active ?? last) - 1)]).focus();
      } else {
        (active === last ? first : focusable[Math.min(focusable.length - 1, focusable.indexOf(active ?? first) + 1)]).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button ref={cancelRef} className="import-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="stop-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ConfirmDialog;
