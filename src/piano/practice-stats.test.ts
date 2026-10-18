import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadStats,
  saveStats,
  recordSession,
  summarize,
  formatSessionDate,
  sessionFrom,
  buildSessionReport,
} from "./practice-stats";
import type { Song } from "./songs";

const song: Song = {
  id: "s1",
  title: "S",
  source: "builtin",
  events: [
    { time: 0, note: "C4", duration: 0.5 },
    { time: 1, note: "E4", duration: 0.5 },
  ],
};

const session = (score: number, mistakes = 0, date = "2026-10-18T10:00:00Z") => ({
  score,
  mistakes,
  noteCount: 2,
  date,
});

describe("practice-stats (roadmap #38)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retourne un historique vide sans stockage", () => {
    expect(loadStats()).toEqual({});
  });

  it("sauvegarde et recharge les sessions", () => {
    const stats = recordSession({}, "s1", session(90));
    expect(saveStats(stats)).toBe(true);
    expect(loadStats().s1).toHaveLength(1);
    expect(loadStats().s1[0].score).toBe(90);
  });

  it("repart de zéro sur JSON corrompu", () => {
    localStorage.setItem("libre-piano:practice-stats:v1", "{not json");
    expect(loadStats()).toEqual({});
  });

  it("filtre les sessions invalides au chargement", () => {
    localStorage.setItem(
      "libre-piano:practice-stats:v1",
      JSON.stringify({
        s1: [{ score: 50, mistakes: 1, noteCount: 2, date: "x" }, { score: "bad" }],
      })
    );
    const loaded = loadStats();
    expect(loaded.s1).toHaveLength(1);
    expect(loaded.s1[0].score).toBe(50);
  });

  it("plafonne l'historique à 20 sessions", () => {
    let stats: Parameters<typeof recordSession>[0] = {};
    for (let i = 1; i <= 25; i++) {
      stats = recordSession(stats, "s1", session(i));
    }
    const sessions = stats.s1;
    expect(sessions).toHaveLength(20);
    // Les 20 dernières sont gardées (scores 6 à 25).
    expect(sessions[0].score).toBe(6);
    expect(sessions[19].score).toBe(25);
  });

  it("summarize agrège correctement", () => {
    const stats = {
      s1: [session(60), session(80), session(100, 2)],
    };
    const s = summarize(stats.s1);
    expect(s.bestScore).toBe(100);
    expect(s.sessionCount).toBe(3);
    expect(s.averageScore).toBe(80);
    expect(s.lastSessionDate).toBe("2026-10-18T10:00:00Z");
  });

  it("summarize vide donne des zéros", () => {
    expect(summarize(undefined)).toEqual({
      bestScore: 0,
      sessionCount: 0,
      averageScore: 0,
      lastSessionDate: null,
    });
  });

  it("formatSessionDate formate ou replie sur —", () => {
    expect(formatSessionDate(null)).toBe("—");
    expect(formatSessionDate("not-a-date")).toBe("—");
    const formatted = formatSessionDate("2026-10-18T10:00:00Z");
    expect(formatted).toMatch(/2026/);
  });

  it("sessionFrom construit une session datée", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    const s = sessionFrom(75, 3, song);
    expect(s.score).toBe(75);
    expect(s.mistakes).toBe(3);
    expect(s.noteCount).toBe(2);
    expect(s.date).toBe("2026-10-18T12:00:00.000Z");
    vi.useRealTimers();
  });
});

describe("roadmap #40 : rapport de session", () => {
  it("produit un JSON complet avec agrégats et sessions", () => {
    const stats = recordSession({}, "s1", session(80));
    const report = buildSessionReport("Ma chanson", stats, "s1");
    const parsed = JSON.parse(report);
    expect(parsed.app).toBe("libre-piano");
    expect(parsed.song).toBe("Ma chanson");
    expect(parsed.summary.bestScore).toBe(80);
    expect(parsed.summary.sessionCount).toBe(1);
    expect(parsed.sessions).toHaveLength(1);
  });

  it("un morceau sans session donne un rapport vide mais valide", () => {
    const report = buildSessionReport("Vide", {}, "unknown");
    const parsed = JSON.parse(report);
    expect(parsed.summary.sessionCount).toBe(0);
    expect(parsed.sessions).toEqual([]);
  });
});
