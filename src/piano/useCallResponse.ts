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
  // B8 (audit) : fautes cumulées sur toute la session — l'état ne porte
  // que les fautes de la phrase courante pour l'affichage.
  const totalMistakesRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    phrasesRef.current = song ? splitPhrases(song.events) : [];
  }, [song]);

  // B3 (audit) : un changement de morceau (ou sa suppression) pendant une
  // session echo active la termine proprement — sinon les timers continuent
  // sur un morceau qui n'existe plus et l'état reste bloqué.
  // Pattern "adjusting state during render" (cf. React docs, cf. usePractice).
  const [lastSong, setLastSong] = useState(song);
  if (song !== lastSong) {
    setLastSong(song);
    if (state.active) setState(IDLE);
  }
  // Quand la session passe à inactive (reset ci-dessus ou stop()), annuler
  // les timers encore en vol pour ne pas jouer des notes fantômes.
  const wasActiveRef = useRef(state.active);
  useEffect(() => {
    if (wasActiveRef.current && !state.active) {
      clearTimers();
      phaseRef.current = "idle";
    }
    wasActiveRef.current = state.active;
  }, [state.active, clearTimers]);

  // Ref miroir pour le trigger (joué par les timers de la phase call).
  const playDemoRef = useRef(playDemoNote);
  useEffect(() => {
    playDemoRef.current = playDemoNote;
  }, [playDemoNote]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // B2 (audit) : playPhrase pose l'état ET les timers. start() délègue —
  // plus de double-programmation quand l'appelant enchaîne start() +
  // playPhrase(0). Le ref casse la dépendance circulaire
  // (playPhrase est déclaré plus bas).
  const playPhraseRef = useRef<((index: number) => void) | null>(null);
  const start = useCallback(() => {
    if (phrasesRef.current.length === 0) return;
    playPhraseRef.current?.(0);
  }, []);

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
      if (index === 0) totalMistakesRef.current = 0;
      phraseRef.current = phrase;
      phaseRef.current = "call";
      setState((prev) => ({
        ...prev,
        active: true,
        phase: "call",
        phraseIndex: index,
        // B2/B8 (audit) : playPhrase pose aussi le total — start()
        // délègue entièrement, phraseCount doit vivre ici.
        phraseCount: phrasesRef.current.length,
        expected: [],
        responseStep: 0,
        mistakes: 0,
      }));
      // Les notes sont jouées séquentiellement, à leur intervalle relatif.
      // Tous les timers (notes + bascule en phase réponse) sont suivis dans
      // timersRef : stop() doit pouvoir les annuler tous.
      const base = phrase.events[0].time;
      phrase.events.forEach((ev, i) => {
        const delay = (ev.time - base) * 1000;
        const timer = window.setTimeout(() => {
          playDemoRef.current(ev.note, ev.duration);
          // Dernière note écoulée : passer en phase réponse.
          if (i === phrase.events.length - 1) {
            const switchTimer = window.setTimeout(() => {
              phaseRef.current = "response";
              setState((prev) => ({
                ...prev,
                phase: "response",
                expected: phrase.events.map((e) => e.note),
                responseStep: 0,
              }));
            }, ev.duration * 1000);
            timersRef.current.push(switchTimer);
          }
        }, delay);
        timersRef.current.push(timer);
      });
    },
    [clearTimers]
  );

  // Phrase courante, accédée par playPhrase.
  const phraseRef = useRef<Phrase | null>(null);

  // Alimente le ref de start (B2) : playPhrase est stable (refs internes).
  useEffect(() => {
    playPhraseRef.current = playPhrase;
  }, [playPhrase]);

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
              // B8 (audit) : récap de fin avec les fautes cumulées.
              const total = totalMistakesRef.current;
              window.setTimeout(() => {
                setState((p) => ({
                  ...p,
                  phase: "call",
                  done: true,
                  expected: [],
                  mistakes: total,
                }));
                phaseRef.current = "idle";
              }, 0);
              return {
                ...prev,
                responseStep: nextStep,
                done: true,
                expected: [],
                mistakes: total,
              };
            }
            // Phrase validée : plus aucune note attendue pendant la
            // fenêtre d'avance (600 ms) — sinon elles comptent comme
            // des fautes fantômes dans le récap final.
            phaseRef.current = "call";
            const advanceTimer = window.setTimeout(() => {
              playPhrase(nextPhrase);
            }, 600);
            timersRef.current.push(advanceTimer);
            return { ...prev, responseStep: nextStep };
          }
          return { ...prev, responseStep: nextStep };
        }
        totalMistakesRef.current += 1;
        return { ...prev, mistakes: prev.mistakes + 1 };
      });
      // playPhrase est stable (refs internes uniquement).
    },
    [playPhrase]
  );

  return { state, start, stop, playPhrase, handlePlayedNote };
}
