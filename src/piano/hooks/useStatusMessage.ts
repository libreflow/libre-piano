// Message de statut auto-expirant (refactor Phase A1) : affiché en bas de
// l'app, effacé automatiquement après quelques secondes sauf s'il est
// remplacé entre-temps.

import { useCallback, useRef, useState } from "react";
import { STATUS_MESSAGE_TIMEOUT_MS } from "../constants";

export function useStatusMessage() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Ref miroir : savoir au moment du timeout si le message affiché est
  // encore le sien (un nouveau message ne doit pas être effacé par le
  // timer de l'ancien).
  const statusMessageRef = useRef<string | null>(null);

  const setStatusMessageAuto = useCallback((msg: string) => {
    statusMessageRef.current = msg;
    setStatusMessage(msg);
    window.setTimeout(() => {
      if (statusMessageRef.current === msg) {
        statusMessageRef.current = null;
        setStatusMessage(null);
      }
    }, STATUS_MESSAGE_TIMEOUT_MS);
  }, []);

  return { statusMessage, setStatusMessage, setStatusMessageAuto };
}
