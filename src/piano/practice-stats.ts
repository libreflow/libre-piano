// Statistiques de progression par morceau (roadmap #38) : chaque session
// d'apprentissage terminée est enregistrée ; on en déduit le meilleur
// score, le nombre de sessions, la précision moyenne et la dernière date.
// Stockées dans une clé localStorage dédiée, hors état principal.

import type { Song } from "./songs";

const STATS_KEY = "libre-piano:practice-stats:v1";

export interface PracticeSession {
  /** Score de la session (0-100). */
  score: number;
  /** Nombre de fautes. */
  mistakes: number;
  /** Nombre de notes du morceau. */
  noteCount: number;
  /** ISO date de la session. */
  date: string;
}

export interface SongStats {
  bestScore: number;
  sessionCount: number;
  /** Moyenne des scores, arrondie. */
  averageScore: number;
  /** Date ISO de la dernière session (null si aucune). */
  lastSessionDate: string | null;
}

export type StatsBySong = Record<string, PracticeSession[]>;

function isValidSession(raw: unknown): raw is PracticeSession {
  if (typeof raw !== "object" || raw === null) return false;
  const s = raw as Partial<PracticeSession>;
  return (
    typeof s.score === "number" &&
    Number.isFinite(s.score) &&
    s.score >= 0 &&
    s.score <= 100 &&
    typeof s.mistakes === "number" &&
    Number.isFinite(s.mistakes) &&
    s.mistakes >= 0 &&
    typeof s.noteCount === "number" &&
    s.noteCount > 0 &&
    typeof s.date === "string"
  );
}

export function loadStats(): StatsBySong {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: StatsBySong = {};
    for (const [songId, sessions] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(sessions)) continue;
      const valid = sessions.filter(isValidSession);
      if (valid.length > 0) out[songId] = valid;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveStats(stats: StatsBySong): boolean {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

export function recordSession(
  stats: StatsBySong,
  songId: string,
  session: PracticeSession
): StatsBySong {
  const next: StatsBySong = { ...stats };
  const sessions = [...(next[songId] ?? []), session];
  // Historique plafonné : les vieilles sessions au-delà de 20 sont perdues,
  // seuls les agrégats récents comptent.
  next[songId] = sessions.slice(-20);
  return next;
}

export function summarize(sessions: PracticeSession[] | undefined): SongStats {
  if (!sessions || sessions.length === 0) {
    return { bestScore: 0, sessionCount: 0, averageScore: 0, lastSessionDate: null };
  }
  const scores = sessions.map((s) => s.score);
  return {
    bestScore: Math.max(...scores),
    sessionCount: sessions.length,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    lastSessionDate: sessions[sessions.length - 1].date,
  };
}

/** Date ISO lisible : "2026-10-18" à partir d'une date complète. */
export function formatSessionDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/** Construit une session depuis un état de practice terminé. */
export function sessionFrom(
  score: number,
  mistakes: number,
  song: Song
): PracticeSession {
  return {
    score,
    mistakes,
    noteCount: song.events.length,
    date: new Date().toISOString(),
  };
}
