import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ensureAudioStarted, getContext } from "./tone-gate";
import {
  getKeyboardLayout,
  getWindowKeyMap,
  getWhitePositionOfNote,
  getOctaveShiftForNote,
  noteToSolfege,
  KeyboardLayout,
  LabelMode,
  OCTAVE_SHIFT_MIN,
  OCTAVE_SHIFT_MAX,
} from "./notes";
import { BUILTIN_SONGS, Song } from "./songs";
import { useMidiImport } from "./useMidiImport";
import { loadPersistedState, savePersistedState, STATE_VERSION } from "./storage";
import { useAudioEngine, SAMPLE_COUNT } from "./useAudioEngine";
import { usePlayback } from "./usePlayback";
import { usePractice } from "./usePractice";
import { useKeyboardInput } from "./useKeyboardInput";
import {
  SPEED_MIN_PERCENT,
  SPEED_MAX_PERCENT,
  SPEED_STEP_PERCENT,
  VOLUME_MIN_PERCENT,
  VOLUME_MAX_PERCENT,
  DISPLAY_CHORD_RATIO_THRESHOLD,
  STATUS_MESSAGE_TIMEOUT_MS,
} from "./constants";
import {
  PlayIcon,
  StopIcon,
  ImportIcon,
  KeyboardIcon,
  TagsIcon,
  ExpandIcon,
  CollapseIcon,
  SustainIcon,
  LoopIcon,
  VolumeIcon,
  StarIcon,
  TrashIcon,
  PracticeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./icons";
import "./Piano.css";

export default function Piano() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pianoScrollRef = useRef<HTMLDivElement | null>(null);
  // Notes allumées par une action directe (souris / clavier PC).
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  // Notes allumées par la lecture automatique (couleur distincte).
  const [autoActiveNotes, setAutoActiveNotes] = useState<Set<string>>(new Set());
  // Notes relâchées mais qui continuent de sonner (pédale de sustain).
  const [sustainedNotes, setSustainedNotes] = useState<Set<string>>(new Set());
  const [sustainOn, setSustainOn] = useState(false);

  // État persisté (localStorage) : lu une seule fois à l'initialisation.
  const [initialState] = useState(() => loadPersistedState());

  const [importedSongs, setImportedSongs] = useState<Song[]>(initialState.importedSongs);
  const [selectedSongId, setSelectedSongId] = useState(
    initialState.selectedSongId &&
      [...BUILTIN_SONGS, ...initialState.importedSongs].some(
        (s) => s.id === initialState.selectedSongId
      )
      ? initialState.selectedSongId
      : (BUILTIN_SONGS[0]?.id ?? "")
  );
  const [speed, setSpeed] = useState(initialState.speed);
  const [volume, setVolume] = useState(initialState.volume);
  const [labelMode, setLabelMode] = useState<LabelMode>(initialState.labelMode);
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>(
    initialState.keyboardLayout
  );
  const { keys: ALL_KEYS, whiteKeyCount } = getKeyboardLayout();
  const [octaveShift, setOctaveShift] = useState(0);
  const windowKeys = useMemo(
    () => getWindowKeyMap(keyboardLayout, octaveShift),
    [keyboardLayout, octaveShift]
  );
  // Inverse de windowKeys : note -> touche PC (pour le panneau apprentissage).
  const noteToKey = useMemo(() => {
    const map = new Map<string, string>();
    windowKeys.forEach((label, note) => map.set(note, label));
    return map;
  }, [windowKeys]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Efface automatiquement le message de statut après quelques secondes,
  // sauf s'il est remplacé entre-temps.
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
  // N'avertir qu'une fois par "session de dépassement" du quota.
  const quotaWarnedRef = useRef(false);

  // Boucle A-B. Les bornes sont clampées : Number("") ou une saisie
  // invalide dans les <input type="number"> donne NaN, qu'on ramène à 0.
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStartRaw] = useState(0);
  const [loopEnd, setLoopEndRaw] = useState(0);
  const setLoopStart = useCallback(
    (v: number) => setLoopStartRaw(Number.isFinite(v) ? Math.max(0, v) : 0),
    []
  );
  const setLoopEnd = useCallback(
    (v: number) => setLoopEndRaw(Number.isFinite(v) ? Math.max(0, v) : 0),
    []
  );

  const {
    samplerRef,
    status,
    loadedCount,
    noteOn: rawNoteOn,
    noteOff: rawNoteOff,
    triggerAttackRelease,
  } = useAudioEngine(volume);

  const markNoteOn = useCallback((note: string) => {
    setActiveNotes((prev) => new Set(prev).add(note));
  }, []);
  const markNoteOff = useCallback((note: string) => {
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);
  const markAutoNoteOn = useCallback((note: string) => {
    setAutoActiveNotes((prev) => new Set(prev).add(note));
  }, []);
  const markAutoNoteOff = useCallback((note: string) => {
    setAutoActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  // Pédale de sustain : si enfoncée au relâchement, la note continue de sonner.
  const sustainOnRef = useRef(false);
  useEffect(() => {
    sustainOnRef.current = sustainOn;
  }, [sustainOn]);
  const allSongs = useMemo(() => [...BUILTIN_SONGS, ...importedSongs], [importedSongs]);
  const selectedSong = useMemo(
    () => allSongs.find((s) => s.id === selectedSongId),
    [allSongs, selectedSongId]
  );

  // Mode apprentissage : la note attendue est surlignée, la session
  // avance quand l'utilisateur joue la bonne note.
  const practice = usePractice(selectedSong);
  const handlePlayedNote = practice.handlePlayedNote;
  const eventsCount = selectedSong?.events.length ?? 0;

  const noteOn = useCallback(
    (note: string) => {
      if (status !== "ready" || !samplerRef.current) return;
      rawNoteOn(note);
      markNoteOn(note);
      handlePlayedNote(note);
    },
    [status, samplerRef, rawNoteOn, markNoteOn, handlePlayedNote]
  );
  const clearSustainedNote = useCallback((note: string) => {
    setSustainedNotes((prev) => {
      if (!prev.has(note)) return prev;
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);
  const noteOff = useCallback(
    (note: string) => {
      if (!samplerRef.current) return;
      if (sustainOnRef.current) {
        markNoteOff(note);
        setSustainedNotes((prev) => new Set(prev).add(note));
        return;
      }
      rawNoteOff(note);
      markNoteOff(note);
      // Retirer aussi un éventuel reste de sustain : sinon la touche
      // resterait affichée « sustained » (muette) après re-jeu sans pédale.
      clearSustainedNote(note);
    },
    [samplerRef, rawNoteOff, markNoteOff, sustainOnRef, clearSustainedNote]
  );
  const releaseSustained = useCallback(() => {
    setSustainedNotes((prev) => {
      prev.forEach((note) => samplerRef.current?.triggerRelease(note));
      return new Set();
    });
  }, [samplerRef]);

  const { isPlaying, isPlayingRef, selectedSongDuration, playSong, stopPlayback } =
    usePlayback(
      status === "ready",
      allSongs,
      selectedSongId,
      speed,
      { loopEnabled, loopStart, loopEnd },
      triggerAttackRelease,
      markAutoNoteOn,
      markAutoNoteOff
    );

  useKeyboardInput({
    layout: keyboardLayout,
    isPlayingRef,
    noteOn,
    noteOff,
    onSustainChange: setSustainOn,
    releaseSustained,
    onTogglePlayback: () => {
      if (isPlayingRef.current) stopPlaybackAndClear();
      else if (!practiceRef.current) playSongGuarded();
    },
  });

  // Centrer le clavier sur la zone médiane (C4) au montage : le piano
  // 88 touches est plus large que la fenêtre.
  useEffect(() => {
    const el = pianoScrollRef.current;
    const piano = el?.querySelector(".piano");
    if (!el || !piano) return;
    const idx = getWhitePositionOfNote("C4");
    const keyW = parseFloat(getComputedStyle(piano).getPropertyValue("--key-w"));
    el.scrollLeft = Math.max(0, idx * keyW - el.clientWidth / 2);
  }, []);

  // Auto-scroll : suivre la note attendue (apprentissage) ou la note en
  // cours (lecture auto) si elle sort de la zone visible.
  const noteToFollow =
    practice.state.active && !practice.state.done ? practice.state.expectedNote : null;
  useEffect(() => {
    if (!noteToFollow) return;
    const el = pianoScrollRef.current;
    const piano = el?.querySelector(".piano");
    if (!el || !piano) return;
    const idx = getWhitePositionOfNote(noteToFollow);
    if (idx < 0) return;
    const keyW = parseFloat(
      getComputedStyle(piano).getPropertyValue("--key-w")
    );
    const x = idx * keyW;
    const view = el.clientWidth;
    // scroller seulement si la touche n'est pas (totalement) visible
    if (x < el.scrollLeft + keyW) {
      el.scrollTo({ left: Math.max(0, x - view / 3), behavior: "smooth" });
    } else if (x + keyW > el.scrollLeft + view - keyW) {
      el.scrollTo({
        left: x - view * (2 / 3),
        behavior: "smooth",
      });
    }
  }, [noteToFollow]);

  // Molette : la molette verticale fait défiler le clavier horizontalement.
  useEffect(() => {
    const el = pianoScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Arrêt de la lecture + nettoyage des touches en surbrillance
  // (hors effect : cf. règle set-state-in-effect).
  const stopPlaybackAndClear = useCallback(() => {
    stopPlayback();
    setAutoActiveNotes(new Set());
  }, [stopPlayback]);

  const addImportedSong = useCallback((song: Song) => {
    setImportedSongs((prev) => [...prev, song]);
    setSelectedSongId(song.id);
  }, []);

  const {
    pendingImport,
    selectedTrackIndices,
    isImporting,
    importFile,
    toggleTrack,
    confirmImport,
    cancelImport,
  } = useMidiImport(addImportedSong, setStatusMessageAuto);

  // La lecture ne démarre pas tant que le dialogue de sélection de
  // pistes est ouvert (sinon elle jouerait derrière le dialogue).
  const pendingImportRef = useRef(false);
  useEffect(() => {
    pendingImportRef.current = Boolean(pendingImport);
  }, [pendingImport]);

  // Mode apprentissage : si la note attendue est hors de la fenêtre
  // clavier PC, décaler automatiquement la fenêtre pour la couvrir —
  // l'utilisateur peut toujours jouer au clavier.
  // Pattern "adjusting state during render" (cf. docs React) : pas
  // d'effect, le reset se fait au render suivant la nouvelle note.
  if (practice.state.active && practice.state.expectedNote) {
    const shift = getOctaveShiftForNote(practice.state.expectedNote, octaveShift);
    if (shift !== null && shift !== octaveShift) {
      setOctaveShift(shift);
    }
  }

  // Lecture et apprentissage sont exclusifs : le raccourci Entrée ne doit
  // pas lancer la lecture pendant une session (réf lue au moment de
  // l'appui, le handler n'est pas re-créé à chaque render).
  const practiceRef = useRef(false);
  useEffect(() => {
    practiceRef.current = practice.state.active;
  }, [practice.state.active]);
  const playSongGuarded = useCallback(() => {
    if (pendingImportRef.current) return;
    void playSong();
  }, [playSong]);

  // Suppression d'un morceau importé (libère aussi le localStorage).
  const deleteImportedSong = useCallback(
    (id: string) => {
      // Le confirm est AVANT les setters : en StrictMode les updaters sont
      // appelés deux fois, un side-effect dedans afficherait le confirm
      // en double (et updater non pur).
      const song = importedSongs.find((s) => s.id === id);
      if (!song) return;
      if (!window.confirm(`Supprimer "${song.title}" ? Cette action est définitive.`)) {
        return;
      }
      setImportedSongs((prev) => prev.filter((s) => s.id !== id));
      setSelectedSongId((current) =>
        current === id ? (BUILTIN_SONGS[0]?.id ?? "") : current
      );
    },
    [importedSongs]
  );

  // Persistance : réécrit l'état complet à chaque changement pertinent.
  useEffect(() => {
    const saved = savePersistedState({
      version: STATE_VERSION,
      importedSongs,
      selectedSongId,
      speed,
      volume,
      showKeyLabels: labelMode !== "none",
      labelMode,
      keyboardLayout,
      theme: "dark",
    });
    // Quota localStorage dépassé : avertir au lieu d'échouer en silence.
    if (!saved && !quotaWarnedRef.current) {
      quotaWarnedRef.current = true;
      setStatusMessageAuto(
        "Stockage local plein : les derniers réglages ne sont pas sauvegardés. Supprime des morceaux importés pour libérer de l'espace."
      );
    } else if (saved) {
      quotaWarnedRef.current = false;
    }
  }, [importedSongs, selectedSongId, speed, volume, labelMode, keyboardLayout, setStatusMessageAuto]);

  const toggleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const next = !isFullscreen;
      await win.setFullscreen(next);
      setIsFullscreen(next);
    } catch {
      // API Tauri indisponible (ex: navigateur) : on ignore.
    }
  };

  const handlePointerDown = (note: string) => {
    if (isPlayingRef.current) return;
    if (getContext().state !== "running") void ensureAudioStarted();
    noteOn(note);
  };
  const handlePointerUp = (note: string) => {
    // Toujours relâcher une note active : si la lecture a démarré pendant
    // le clic maintenu, la note sonnerait à l'infini après l'arrêt.
    if (!activeNotes.has(note)) return;
    noteOff(note);
  };

  const keyStateClass = (note: string): string => {
    if (practice.state.expectedNote === note) return "expected";
    if (activeNotes.has(note)) return "active";
    if (autoActiveNotes.has(note)) return "auto-active";
    if (sustainedNotes.has(note)) return "sustained";
    return "";
  };

  return (
    <div className="piano-wrap">
      {status === "loading" && (
        <div className="piano-loading" role="status" aria-live="polite">
          Chargement des sons du piano… {loadedCount}/{SAMPLE_COUNT}
          <progress
            max={SAMPLE_COUNT}
            value={loadedCount}
            aria-label="Progression du chargement"
          />
        </div>
      )}
      {status === "error" && (
        <div className="piano-loading">
          Impossible de charger les sons du piano. Vérifie l'installation ou réinstalle
          l'application.
        </div>
      )}

      <div className="playback-controls" role="toolbar" aria-label="Contrôles du piano">
        <div className="control-group" aria-label="Lecture">
          <select
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            disabled={isPlaying}
          >
            {allSongs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.source === "imported" ? `♪ ${s.title}` : s.title}
              </option>
            ))}
          </select>

          {selectedSong?.source === "imported" && (
            <button
              className="import-btn delete-song"
              onClick={() => deleteImportedSong(selectedSong.id)}
              disabled={isPlaying || isImporting || practice.state.active}
              title="Supprimer ce morceau importé"
              aria-label="Supprimer ce morceau importé"
            >
              <TrashIcon />
            </button>
          )}

          {!isPlaying ? (
            <button
              className="play-btn"
              onClick={playSongGuarded}
              disabled={
                status !== "ready" || Boolean(pendingImport) || practice.state.active
              }
            >
              <PlayIcon /> Lecture
            </button>
          ) : (
            <button className="stop-btn" onClick={stopPlaybackAndClear}>
              <StopIcon /> Arrêter
            </button>
          )}

          <button
            className="import-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPlaying || isImporting}
          >
            {isImporting ? (
              "Import…"
            ) : (
              <>
                <ImportIcon /> Importer
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFile(file);
            }}
            style={{ display: "none" }}
          />

          <button
            className="import-btn"
            onClick={() => {
              if (practice.state.active) {
                practice.stop();
              } else {
                if (isPlayingRef.current) stopPlaybackAndClear();
                practice.start();
              }
            }}
            disabled={status !== "ready" || isPlaying || Boolean(pendingImport)}
            aria-pressed={practice.state.active}
            title="Mode apprentissage : joue la note attendue pour avancer"
          >
            <PracticeIcon />
            {practice.state.active ? "Quitter apprentissage" : "Apprentissage"}
          </button>
        </div>

        <div className="control-group" aria-label="Réglages">
          <label className="speed-label">
            Vitesse
            <input
              type="range"
              min={SPEED_MIN_PERCENT}
              max={SPEED_MAX_PERCENT}
              step={SPEED_STEP_PERCENT}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={isPlaying}
            />
            <span>{speed}%</span>
          </label>

          <label className="speed-label volume">
            <VolumeIcon />
            <input
              type="range"
              min={VOLUME_MIN_PERCENT}
              max={VOLUME_MAX_PERCENT}
              step={5}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
            <span>{volume}%</span>
          </label>
        </div>

        <div className="control-group" aria-label="Disposition du clavier">
          <div
            className="segmented"
            role="group"
            aria-label="Octave de la fenêtre clavier PC"
          >
            <button
              onClick={() => setOctaveShift((v) => Math.max(OCTAVE_SHIFT_MIN, v - 1))}
              disabled={
                octaveShift <= OCTAVE_SHIFT_MIN || practice.state.active
              }
              title="Fenêtre PC : octave précédente"
              aria-label="Fenêtre clavier : octave précédente"
            >
              <ChevronLeftIcon />
            </button>
            <span className="octave-label" aria-live="polite">
              C{3 + octaveShift}
            </span>
            <button
              onClick={() => setOctaveShift((v) => Math.min(OCTAVE_SHIFT_MAX, v + 1))}
              disabled={
                octaveShift >= OCTAVE_SHIFT_MAX || practice.state.active
              }
              title="Fenêtre PC : octave suivante"
              aria-label="Fenêtre clavier : octave suivante"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="segmented" role="radiogroup" aria-label="AZERTY ou QWERTY">
            {(["azerty", "qwerty"] as const).map((layout) => (
              <button
                key={layout}
                role="radio"
                aria-checked={keyboardLayout === layout}
                className={keyboardLayout === layout ? "seg-active" : ""}
                onClick={() => setKeyboardLayout(layout)}
                title={`Disposition ${layout.toUpperCase()}`}
              >
                <KeyboardIcon />
                {layout.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group" aria-label="Affichage">
          <div
            className="segmented"
            role="radiogroup"
            aria-label="Étiquettes des touches"
          >
            {(
              [
                ["lettres", "A B C"],
                ["solfege", "Do Ré"],
                ["both", "A B C + Do"],
                ["none", "Rien"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                role="radio"
                aria-checked={labelMode === mode}
                className={labelMode === mode ? "seg-active" : ""}
                onClick={() => setLabelMode(mode)}
                title={`Étiquettes : ${label}`}
              >
                <TagsIcon />
                {label}
              </button>
            ))}
          </div>

          <button
            className="import-btn"
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
            {isFullscreen ? "Quitter" : "Plein écran"}
          </button>

          <span
            className={`pedal-badge ${sustainOn ? "pedal-on" : ""}`}
            title="Maintenir la barre d'espace = pédale de sustain"
          >
            <SustainIcon />
            {sustainOn ? "Sustain" : "Espace"}
          </span>
        </div>
      </div>
      <div className="loop-controls">
        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => setLoopEnabled(e.target.checked)}
            disabled={isPlaying}
          />
          <LoopIcon /> Boucle A-B
        </label>
        <label className="loop-bound">
          Début
          <input
            type="number"
            min={0}
            max={Math.max(0, loopEnd - 0.1)}
            step={0.5}
            value={loopStart.toFixed(1)}
            onChange={(e) => setLoopStart(Number(e.target.value))}
            disabled={isPlaying || !loopEnabled}
          />
          s
        </label>
        <label className="loop-bound">
          Fin
          <input
            type="number"
            min={loopStart + 0.1}
            max={selectedSongDuration}
            step={0.5}
            value={loopEnd.toFixed(1)}
            onChange={(e) => setLoopEnd(Number(e.target.value))}
            disabled={isPlaying || !loopEnabled}
          />
          s
        </label>
        <span className="loop-total">/ {selectedSongDuration.toFixed(1)}s au total</span>
      </div>

      {statusMessage && <div className="status-message">{statusMessage}</div>}

      {practice.state.active && (
        <div className="practice-panel" role="status">
          {practice.state.done ? (
            <>
              <strong>Session terminée !</strong> {eventsCount} notes,{" "}
              {practice.state.mistakes} faute(s).
              <button className="import-btn" onClick={practice.start}>
                Recommencer
              </button>
              <button className="import-btn" onClick={practice.stop}>
                Fermer
              </button>
            </>
          ) : (
            <>
              Note {practice.state.step + 1}/{eventsCount} —{" "}
              {(() => {
                const note = practice.state.expectedNote;
                const key = note ? noteToKey.get(note) : undefined;
                return key ? (
                  <>
                    appuie sur <kbd className="practice-key">{key}</kbd> ({note})
                  </>
                ) : (
                  <>joue {note} à la souris</>
                );
              })()}{" "}
              · {practice.state.mistakes} faute(s)
            </>
          )}
        </div>
      )}

      {pendingImport && (
        <div className="track-picker">
          <h3>Pistes de "{pendingImport.title}"</h3>
          <p className="track-picker-hint">
            Choisis les pistes à importer (décoche l'accompagnement/basse pour n'entendre
            que la mélodie, par exemple).
          </p>
          <ul className="track-list">
            {pendingImport.tracks.map((t) => (
              <li key={t.index}>
                <label className={t.likelyMelody ? "likely-melody" : ""}>
                  <input
                    type="checkbox"
                    checked={selectedTrackIndices.has(t.index)}
                    onChange={() => toggleTrack(t.index)}
                  />
                  <span className="track-info">
                    <span className="track-title">
                      {t.name} — {t.noteCount} notes
                      {t.likelyMelody && (
                        <span className="melody-tag">
                          <StarIcon /> mélodie
                        </span>
                      )}
                    </span>
                    <span className="track-details">
                      tessiture {t.pitchRange} ·{" "}
                      {t.chordRatio > DISPLAY_CHORD_RATIO_THRESHOLD
                        ? "accords/accompagnement"
                        : "monophonique"}
                      {t.percussion ? " · percussion" : ""}
                      {t.instrumentName ? ` · ${t.instrumentName}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="track-picker-actions">
            <button className="import-btn" onClick={cancelImport}>
              Annuler
            </button>
            <button className="play-btn" onClick={confirmImport}>
              Importer la sélection
            </button>
          </div>
        </div>
      )}

      <div className="piano-scroll" ref={pianoScrollRef}>
        <div
          className={`piano ${isPlaying ? "piano-readonly" : ""}`}
          style={{ ["--white-keys" as any]: whiteKeyCount }}
        >
          {ALL_KEYS.filter((k) => !k.isBlack).map((k) => (
            <button
              key={k.note}
              className={`key white ${keyStateClass(k.note)}${
                k.note.startsWith("C") ? " octave-marker" : ""
              }`}
              style={{ ["--index" as any]: k.whiteIndex }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                handlePointerDown(k.note);
              }}
              onPointerUp={() => handlePointerUp(k.note)}
              onPointerCancel={() => handlePointerUp(k.note)}
              onPointerLeave={() => activeNotes.has(k.note) && handlePointerUp(k.note)}
              title={`${noteToSolfege(k.note)} (${k.note})`}
              aria-label={`Touche ${k.note}`}
            >
              {labelMode !== "none" && (
                <span className="key-label">
                  {(labelMode === "lettres" || labelMode === "both") &&
                    windowKeys.get(k.note)}
                  {labelMode === "solfege" && noteToSolfege(k.note)}
                  {labelMode === "both" && (
                    <span className="key-label-solfege">{noteToSolfege(k.note)}</span>
                  )}
                </span>
              )}
            </button>
          ))}
          {ALL_KEYS.filter((k) => k.isBlack).map((k) => (
            <button
              key={k.note}
              className={`key black ${keyStateClass(k.note)}`}
              style={{ ["--index" as any]: k.whiteIndex }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                handlePointerDown(k.note);
              }}
              onPointerUp={() => handlePointerUp(k.note)}
              onPointerCancel={() => handlePointerUp(k.note)}
              onPointerLeave={() => activeNotes.has(k.note) && handlePointerUp(k.note)}
              title={`${noteToSolfege(k.note)} (${k.note})`}
              aria-label={`Touche ${k.note}`}
            >
              {labelMode !== "none" && (
                <span className="key-label">
                  {(labelMode === "lettres" || labelMode === "both") &&
                    windowKeys.get(k.note)}
                  {labelMode === "solfege" && noteToSolfege(k.note)}
                  {labelMode === "both" && (
                    <span className="key-label-solfege">{noteToSolfege(k.note)}</span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
