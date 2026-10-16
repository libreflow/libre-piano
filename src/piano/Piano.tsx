import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { start as toneStart } from "./tone-gate";
import {
  getKeys,
  WHITE_KEY_COUNT,
  whiteKeyIndex,
  blackKeyAfterIndex,
  noteToSolfege,
  KeyboardLayout,
  LabelMode,
} from "./notes";
import { BUILTIN_SONGS, Song } from "./songs";
import {
  loadMidi,
  summarizeTracks,
  buildSongFromTracks,
  TrackSummary,
} from "./midi-import";
import type { Midi } from "@tonejs/midi";
import { loadPersistedState, savePersistedState } from "./storage";
import { useAudioEngine } from "./useAudioEngine";
import { usePlayback } from "./usePlayback";
import { useKeyboardInput } from "./useKeyboardInput";
import {
  SPEED_MIN_PERCENT,
  SPEED_MAX_PERCENT,
  SPEED_STEP_PERCENT,
  VOLUME_MIN_PERCENT,
  VOLUME_MAX_PERCENT,
  DISPLAY_CHORD_RATIO_THRESHOLD,
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
} from "./icons";
import "./Piano.css";

export default function Piano() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const KEYS = useMemo(() => getKeys(keyboardLayout), [keyboardLayout]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  // Sélecteur de pistes en attente de confirmation.
  const [pendingImport, setPendingImport] = useState<{
    midi: Midi;
    title: string;
    tracks: TrackSummary[];
  } | null>(null);
  const [selectedTrackIndices, setSelectedTrackIndices] = useState<Set<number>>(
    new Set()
  );

  const {
    samplerRef,
    status,
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
  const noteOn = useCallback(
    (note: string) => {
      if (status !== "ready" || !samplerRef.current) return;
      rawNoteOn(note);
      markNoteOn(note);
    },
    [status, samplerRef, rawNoteOn, markNoteOn]
  );
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
    },
    [samplerRef, rawNoteOff, markNoteOff, sustainOnRef]
  );
  const releaseSustained = useCallback(() => {
    setSustainedNotes((prev) => {
      prev.forEach((note) => samplerRef.current?.triggerRelease(note));
      return new Set();
    });
  }, [samplerRef]);

  const allSongs = [...BUILTIN_SONGS, ...importedSongs];
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
      else void playSong();
    },
  });

  // Arrêt de la lecture + nettoyage des touches en surbrillance
  // (hors effect : cf. règle set-state-in-effect).
  const stopPlaybackAndClear = useCallback(() => {
    stopPlayback();
    setAutoActiveNotes(new Set());
  }, [stopPlayback]);

  // Persistance : réécrit l'état complet à chaque changement pertinent.
  useEffect(() => {
    savePersistedState({
      importedSongs,
      selectedSongId,
      speed,
      volume,
      showKeyLabels: labelMode !== "none",
      labelMode,
      keyboardLayout,
      theme: "dark",
    });
  }, [importedSongs, selectedSongId, speed, volume, labelMode, keyboardLayout]);

  const handleImportClick = () => {
    if (isPlaying || isImporting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsImporting(true);
    setStatusMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const title = file.name.replace(/\.(mid|midi)$/i, "");
      const midi = loadMidi(buffer);
      const tracks = summarizeTracks(midi).filter((t) => t.noteCount > 0);
      if (tracks.length === 0) {
        throw new Error("Ce fichier ne contient aucune note exploitable.");
      }
      const defaultSelection = tracks.filter((t) => !t.percussion);
      const toSelect = defaultSelection.length > 0 ? defaultSelection : tracks;
      setSelectedTrackIndices(new Set(toSelect.map((t) => t.index)));
      setPendingImport({ midi, title, tracks });
    } catch (err) {
      setStatusMessage(
        `Échec de l'import : ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsImporting(false);
    }
  };

  const toggleTrack = (index: number) => {
    setSelectedTrackIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    if (selectedTrackIndices.size === 0) {
      setStatusMessage("Sélectionne au moins une piste à importer.");
      return;
    }
    try {
      const { song, warnings } = buildSongFromTracks(
        pendingImport.midi,
        [...selectedTrackIndices],
        pendingImport.title
      );
      setImportedSongs((prev) => [...prev, song]);
      setSelectedSongId(song.id);
      setStatusMessage(
        warnings.length > 0
          ? `"${song.title}" importé — ${warnings.join(" ")}`
          : `"${song.title}" importé avec succès (${song.events.length} notes).`
      );
    } catch (err) {
      setStatusMessage(
        `Échec de l'import : ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setPendingImport(null);
    }
  };

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

  const handleMouseDown = async (note: string) => {
    if (isPlayingRef.current) return;
    await toneStart();
    noteOn(note);
  };
  const handleMouseUp = (note: string) => {
    if (!activeNotes.has(note)) return;
    noteOff(note);
  };

  const keyStateClass = (note: string): string => {
    if (activeNotes.has(note)) return "active";
    if (autoActiveNotes.has(note)) return "auto-active";
    if (sustainedNotes.has(note)) return "sustained";
    return "";
  };

  return (
    <div className="piano-wrap">
      {status === "loading" && (
        <div className="piano-loading" role="status" aria-live="polite">
          Chargement des sons du piano…
        </div>
      )}
      {status === "error" && (
        <div className="piano-loading">
          Échec du chargement des sons du piano. Redémarre l'application.
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

          {!isPlaying ? (
            <button className="play-btn" onClick={playSong} disabled={status !== "ready"}>
              <PlayIcon /> Lecture
            </button>
          ) : (
            <button className="stop-btn" onClick={stopPlaybackAndClear}>
              <StopIcon /> Arrêter
            </button>
          )}

          <button
            className="import-btn"
            onClick={handleImportClick}
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
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
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
            <button className="import-btn" onClick={() => setPendingImport(null)}>
              Annuler
            </button>
            <button className="play-btn" onClick={confirmImport}>
              Importer la sélection
            </button>
          </div>
        </div>
      )}

      <div
        className={`piano ${isPlaying ? "piano-readonly" : ""}`}
        style={{ ["--white-keys" as any]: WHITE_KEY_COUNT }}
      >
        {KEYS.filter((k) => !k.isBlack).map((k) => (
          <button
            key={k.note}
            className={`key white ${keyStateClass(k.note)}`}
            style={{ ["--index" as any]: whiteKeyIndex(k.note) }}
            onMouseDown={() => handleMouseDown(k.note)}
            onMouseUp={() => handleMouseUp(k.note)}
            onMouseLeave={() => activeNotes.has(k.note) && handleMouseUp(k.note)}
            title={k.note}
            aria-label={`Touche ${k.note}`}
          >
            {labelMode !== "none" && (
              <span className="key-label">
                {(labelMode === "lettres" || labelMode === "both") && k.label}
                {labelMode === "solfege" && noteToSolfege(k.note)}
                {labelMode === "both" && (
                  <span className="key-label-solfege">{noteToSolfege(k.note)}</span>
                )}
              </span>
            )}
          </button>
        ))}
        {KEYS.filter((k) => k.isBlack).map((k) => (
          <button
            key={k.note}
            className={`key black ${keyStateClass(k.note)}`}
            style={{ ["--index" as any]: blackKeyAfterIndex(k.note) }}
            onMouseDown={() => handleMouseDown(k.note)}
            onMouseUp={() => handleMouseUp(k.note)}
            onMouseLeave={() => activeNotes.has(k.note) && handleMouseUp(k.note)}
            title={k.note}
            aria-label={`Touche ${k.note}`}
          >
            {labelMode !== "none" && (
              <span className="key-label">
                {(labelMode === "lettres" || labelMode === "both") && k.label}
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
  );
}
