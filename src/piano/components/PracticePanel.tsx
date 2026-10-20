// Panneau apprentissage (refactor Phase B4) : stats, session en cours,
// fin de session avec rapport exportable.
// E1 (audit ergonomie) : textes traduits via useI18n.

import { memo } from "react";
import {
  summarize,
  formatSessionDate,
  buildSessionReport,
  downloadSessionReport,
} from "../practice-stats";
import type { PracticeSession } from "../practice-stats";
import type { PracticeState } from "../usePractice";
import type { Song } from "../songs";
import { useI18n } from "../useI18n";
import { interpolate } from "../i18n";
import type { Language } from "../i18n";

interface PracticePanelProps {
  state: PracticeState;
  /** Sessions brutes du morceau (stats[selectedSongId]). */
  stats: PracticeSession[] | undefined;
  eventsCount: number;
  selectedSong: Song | undefined;
  noteToKey: Map<string, string>;
  language: Language;
  onStart: () => void;
  onStop: () => void;
}

// B14 (audit) : React.memo — composant passif, props stables.
const PracticePanel = memo(function PracticePanel({
  state,
  stats,
  eventsCount,
  selectedSong,
  noteToKey,
  language,
  onStart,
  onStop,
}: PracticePanelProps) {
  const { t } = useI18n(language);
  const summary = summarize(stats);
  return (
    <div className="practice-panel" role="status">
      {summary.sessionCount > 0 ? (
        <span className="practice-stats">
          {interpolate(t("practiceStatsBest"), { score: summary.bestScore })}{" "}
          · {interpolate(t("practiceStatsSessions"), { count: summary.sessionCount })}{" "}
          · {interpolate(t("practiceStatsAverage"), { avg: summary.averageScore })}{" "}
          · {interpolate(t("practiceStatsLast"), { date: formatSessionDate(summary.lastSessionDate) })}
        </span>
      ) : null}
      {state.done ? (
        <>
          <strong>{t("practiceDone")}</strong>{" "}
          {interpolate(t("practiceDoneDetail"), {
            notes: eventsCount,
            mistakes: state.mistakes,
            score: state.score ?? 100,
          })}
          <button className="import-btn" onClick={onStart}>
            {t("practiceRestart")}
          </button>
          <button
            className="import-btn"
            onClick={() => {
              if (!selectedSong) return;
              // Rapport de session (roadmap #40) : export JSON.
              downloadSessionReport(
                selectedSong.title,
                buildSessionReport(
                  selectedSong.title,
                  { [selectedSong.id]: stats ?? [] },
                  selectedSong.id
                )
              );
            }}
            title={t("reportHint")}
          >
            {t("practiceReport")}
          </button>
          <button className="import-btn" onClick={onStop}>
            {t("practiceClose")}
          </button>
        </>
      ) : (
        <>
          {interpolate(t("practiceStep"), { step: state.step + 1, total: eventsCount })}{" "}
          {(() => {
            const note = state.expectedNote;
            const key = note ? noteToKey.get(note) : undefined;
            return key ? (
              <>
                {t("practicePressKey")} <kbd className="practice-key">{key}</kbd> ({note})
              </>
            ) : (
              <>{interpolate(t("practicePlayMouse"), { note: note ?? "" })}</>
            );
          })()}{" "}
          · {interpolate(t("practiceMistakes"), { count: state.mistakes })}
        </>
      )}
    </div>
  );
});

export default PracticePanel;
