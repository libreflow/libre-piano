// Panneau echo / call & response (refactor Phase B4) : l'app joue une
// phrase, l'utilisateur la rejoue — affichage de la progression.

import { memo } from "react";
import type { CallResponseState } from "../useCallResponse";

interface EchoPanelProps {
  state: CallResponseState;
  onRestart: () => void;
  onStop: () => void;
}

// B14 (audit) : React.memo — composant passif, props stables.
const EchoPanel = memo(function EchoPanel({ state, onRestart, onStop }: EchoPanelProps) {
  return (
    <div className="practice-panel" role="status">
      {state.done ? (
        <>
          <strong>Morceau rejoué en entier !</strong> {state.phraseCount}{" "}
          phrase(s), {state.mistakes} faute(s).
          <button className="import-btn" onClick={onRestart}>
            Recommencer
          </button>
          <button className="import-btn" onClick={onStop}>
            Fermer
          </button>
        </>
      ) : state.phase === "call" ? (
        <>
          <strong>Écoute…</strong> Phrase {state.phraseIndex + 1}/
          {state.phraseCount}
        </>
      ) : (
        <>
          <strong>À toi !</strong> Phrase {state.phraseIndex + 1}/
          {state.phraseCount} — note{" "}
          {state.responseStep + 1}/{state.expected.length} · {state.mistakes}{" "}
          faute(s)
        </>
      )}
    </div>
  );
});

export default EchoPanel;
