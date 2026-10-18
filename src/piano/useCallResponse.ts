// Mode "call & response" (roadmap #43) : l'app joue une phrase du
// morceau (call), puis attend que l'utilisateur la rejoue (response).
// Avance phrase par phrase — complément du mode apprentissage note à note.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Song, SongEvent } from "./songs";

/** Nombre de notes par phrase. */
export const PHRASE_LENGTH = 6;

export type CallResponsePhase = "idle" | "call" | "response";

export interface CallResponseState {
  active: boolean;
  phase: CallResponsePhase;
  /** Index de la phrase courante. */
  phraseIndex: number;
  /** Nombre total de phrases. */
  phraseCount: number;
  /** Notes attendues pendant la réponse (vide en phase call). */
  expected: string[];
  /** Position dans la réponse. */
  responseStep: number;
  /** Fautes de la phrase courante. */
  mistakes: number;
  done: boolean;
}

interface Phrase {
  events: SongEvent[];
}

/** Découpe les événements en phrases de PHRASE_LENGTH notes. */
export function splitPhrases(events: SongEvent[], length = PHRASE_LENGTH): Phrase[] {
  const phrases: Phrase[] = [];
  for (let i = 0; i < events.length; i += length) {
    const chunk = events.slice(i, i + length);
    if (chunk.length > 0) phrases.push({ events: chunk });
  }
  return phrases;
}

const IDLE: CallResponseState = {
  active: false,
  phase: "idle",
  phraseIndex: 0,
  phraseCount: 0,
  expected: [],
  responseStep: 0,
  mistakes: 0,
  done: false,
};

export function useCallResponse(
  song: Song | undefined,
  /** Joue une note de démonstration (phase call). */
  playDemoNote: (note: string, duration: number, time?: number) => void
) {
  const [state, setState] = useState<CallResponseState>(IDLE);
  const phrasesRef = useRef<Phrase[]>([]);
  const phaseRef = useRef<CallResponsePhase>("idle");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    phrasesRef.current = song ? splitPhrases(song.events) : [];
  }, [song]);

  // Ref miroir pour le trigger (joué par les timers de la phase call).
  const playDemoRef = useRef(playDemoNote);
  useEffect(() => {
    playDemoRef.current = playDemoNote;
  }, [playDemoNote]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const start = useCallback(() => {
    const phrases = phrasesRef.current;
    if (phrases.length === 0) return;
    clearTimers();
    setState({
      active: true,
      phase: "call",
      phraseIndex: 0,
      phraseCount: phrases.length,
      expected: [],
      responseStep: 0,
      mistakes: 0,
      done: false,
    });
    phaseRef.current = "call";
  }, [clearTimers]);

  const stop = useCallback(() => {
    clearTimers();
    phaseRef.current = "idle";
    setState(IDLE);
  }, [clearTimers]);

  /** Joue la phrase i (phase call) puis bascule en attente.
   * Stable : ne lit que des refs, aucune dep externe. */
  const playPhrase = useCallback(
    (index: number) => {
      const phrase = phrasesRef.current[index];
      if (!phrase) return;
      clearTimers();
      phraseRef.current = phrase;
      phaseRef.current = "call";
      setState((prev) => ({
        ...prev,
        active: true,
        phase: "call",
        phraseIndex: index,
        expected: [],
        responseStep: 0,
        mistakes: 0,
      }));
      // Les notes sont jouées séquentiellement, à leur intervalle relatif.
      const base = phrase.events[0].time;
      phrase.events.forEach((ev, i) => {
        const delay = (ev.time - base) * 1000;
        const timer = window.setTimeout(() => {
          playDemoRef.current(ev.note, ev.duration);
          // Dernière note écoulée : passer en phase réponse.
          if (i === phrase.events.length - 1) {
            window.setTimeout(() => {
              phaseRef.current = "response";
              setState((prev) => ({
                ...prev,
                phase: "response",
                expected: phrase.events.map((e) => e.note),
                responseStep: 0,
              }));
            }, ev.duration * 1000);
          }
        }, delay);
        timersRef.current.push(timer);
      });
    },
    [clearTimers]
  );

  // Phrase courante, accédée par playPhrase.
  const phraseRef = useRef<Phrase | null>(null);

  /** À brancher sur les notes jouées : avance la réponse. */
  const handlePlayedNote = useCallback(
    (note: string) => {
      if (phaseRef.current !== "response") return;
      setState((prev) => {
        if (!prev.active || prev.done) return prev;
        const expectedNote = prev.expected[prev.responseStep];
        if (note === expectedNote) {
          const nextStep = prev.responseStep + 1;
          if (nextStep >= prev.expected.length) {
            // Phrase rejouée : suivante ou fin.
            const nextPhrase = prev.phraseIndex + 1;
            if (nextPhrase >= prev.phraseCount) {
              phaseRef.current = "call";
              window.setTimeout(() => {
                // Fin : la session se termine.
                setState((p) => ({ ...p, phase: "call", done: true, expected: [] }));
                phaseRef.current = "idle";
              }, 0);
              return { ...prev, responseStep: nextStep, done: true, expected: [] };
            }
            window.setTimeout(() => {
              playPhrase(nextPhrase);
            }, 600);
            return { ...prev, responseStep: nextStep };
          }
          return { ...prev, responseStep: nextStep };
        }
        return { ...prev, mistakes: prev.mistakes + 1 };
      });
      // playPhrase est stable (refs internes uniquement).
    },
    [playPhrase]
  );

  return { state, start, stop, playPhrase, handlePlayedNote };
}
