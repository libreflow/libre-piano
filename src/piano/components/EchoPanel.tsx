// Panneau echo / call & response (refactor Phase B4) : l'app joue une
// phrase, l'utilisateur la rejoue — affichage de la progression.
// E1 (audit ergonomie) : textes traduits via useI18n.

import { memo } from "react";
import type { CallResponseState } from "../useCallResponse";
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

interface EchoPanelProps {
  state: CallResponseState;
  language: Language;
  onRestart: () => void;
  onStop: () => void;
}

// B14 (audit) : React.memo — composant passif, props stables.
const EchoPanel = memo(function EchoPanel({ state, language, onRestart, onStop }: EchoPanelProps) {
  const { t } = useI18n(language);
  return (
    <div className="practice-panel" role="status">
      {state.done ? (
        <>
          <strong>{t("echoDone")}</strong>{" "}
          {interpolate(t("echoDoneDetail"), {
            phrases: state.phraseCount,
            mistakes: state.mistakes,
          })}
          <button className="import-btn" onClick={onRestart}>
            {t("restart")}
          </button>
          <button className="import-btn" onClick={onStop}>
            {t("close")}
          </button>
        </>
      ) : state.phase === "call" ? (
        <>
          <strong>{t("echoListenPhase")}</strong>{" "}
          {interpolate(t("echoPhraseLabel"), {
            current: state.phraseIndex + 1,
            total: state.phraseCount,
          })}
        </>
      ) : (
        <>
          <strong>{t("echoYourTurn")}</strong>{" "}
          {interpolate(t("echoPhraseLabel"), {
            current: state.phraseIndex + 1,
            total: state.phraseCount,
          })}{" "}
          — {interpolate(t("echoNoteProgress"), {
            step: state.responseStep + 1,
            total: state.expected.length,
          })}{" "}
          · {interpolate(t("practiceMistakes"), { count: state.mistakes })}
        </>
      )}
    </div>
  );
});

export default EchoPanel;
