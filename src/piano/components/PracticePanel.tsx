// Panneau apprentissage (refactor Phase B4) : stats, session en cours,
// fin de session avec rapport exportable.

import {
  summarize,
  formatSessionDate,
  buildSessionReport,
  downloadSessionReport,
} from "../practice-stats";
import type { PracticeSession } from "../practice-stats";
import type { PracticeState } from "../usePractice";
import type { Song } from "../songs";

interface PracticePanelProps {
  state: PracticeState;
  /** Sessions brutes du morceau (stats[selectedSongId]). */
  stats: PracticeSession[] | undefined;
  eventsCount: number;
  selectedSong: Song | undefined;
  noteToKey: Map<string, string>;
  onStart: () => void;
  onStop: () => void;
}

export default function PracticePanel({
  state,
  stats,
  eventsCount,
  selectedSong,
  noteToKey,
  onStart,
  onStop,
}: PracticePanelProps) {
  const summary = summarize(stats);
  return (
    <div className="practice-panel" role="status">
      {summary.sessionCount > 0 ? (
        <span className="practice-stats">
          Meilleur : <strong>{summary.bestScore}/100</strong> ·{" "}
          {summary.sessionCount} session(s) · moyenne {summary.averageScore}% · le{" "}
          {formatSessionDate(summary.lastSessionDate)}
        </span>
      ) : null}
      {state.done ? (
        <>
          <strong>Session terminée !</strong> {eventsCount} notes,{" "}
          {state.mistakes} faute(s), score {state.score ?? 100}/100.
          <button className="import-btn" onClick={onStart}>
            Recommencer
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
            title="Exporter le rapport de progression en JSON"
          >
            Rapport
          </button>
          <button className="import-btn" onClick={onStop}>
            Fermer
          </button>
        </>
      ) : (
        <>
          Note {state.step + 1}/{eventsCount} —{" "}
          {(() => {
            const note = state.expectedNote;
            const key = note ? noteToKey.get(note) : undefined;
            return key ? (
              <>
                appuie sur <kbd className="practice-key">{key}</kbd> ({note})
              </>
            ) : (
              <>joue {note} à la souris</>
            );
          })()}{" "}
          · {state.mistakes} faute(s)
        </>
      )}
    </div>
  );
}
