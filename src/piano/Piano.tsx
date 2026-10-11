import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  KEYS,
  KEY_TO_NOTE,
  WHITE_KEY_COUNT,
  whiteKeyIndex,
  blackKeyAfterIndex,
} from "./notes";
import { BUILTIN_SONGS, Song, SongEvent, songDuration } from "./songs";
import {
  loadMidi,
  summarizeTracks,
  buildSongFromTracks,
  TrackSummary,
} from "./midi-import";
import type { Midi } from "@tonejs/midi";
import { loadPersistedState, savePersistedState } from "./storage";
import {
  SPEED_MIN_PERCENT,
  SPEED_MAX_PERCENT,
  SPEED_STEP_PERCENT,
  VOLUME_MIN_PERCENT,
  VOLUME_MAX_PERCENT,
  DISPLAY_CHORD_RATIO_THRESHOLD,
  NOTE_HIGHLIGHT_RELEASE_FRACTION,
  PLAYBACK_END_BUFFER_SEC,
} from "./constants";
import "./Piano.css";

// Classic Salamander Grand Piano samples, hosted by the Tone.js project.
// Tone.Sampler interpolates/repitches between these recorded notes so we
// don't need a sample per semitone.
function createSampler(onLoaded: () => void) {
  return new Tone.Sampler({
    urls: {
      A0: "A0.mp3",
      C1: "C1.mp3",
      "D#1": "Ds1.mp3",
      "F#1": "Fs1.mp3",
      A1: "A1.mp3",
      C2: "C2.mp3",
      "D#2": "Ds2.mp3",
      "F#2": "Fs2.mp3",
      A2: "A2.mp3",
      C3: "C3.mp3",
      "D#3": "Ds3.mp3",
      "F#3": "Fs3.mp3",
      A3: "A3.mp3",
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
      C5: "C5.mp3",
      "D#5": "Ds5.mp3",
      "F#5": "Fs5.mp3",
      A5: "A5.mp3",
      C6: "C6.mp3",
      "D#6": "Ds6.mp3",
      "F#6": "Fs6.mp3",
      A6: "A6.mp3",
      C7: "C7.mp3",
      "D#7": "Ds7.mp3",
      "F#7": "Fs7.mp3",
      A7: "A7.mp3",
      C8: "C8.mp3",
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: onLoaded,
  }).toDestination();
}

export default function Piano() {
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const partRef = useRef<Tone.Part<SongEvent> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Notes allumées par une action directe (souris / clavier PC).
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  // Notes allumées par la lecture automatique (couleur distincte).
  const [autoActiveNotes, setAutoActiveNotes] = useState<Set<string>>(new Set());
  // Notes relâchées par l'utilisateur mais qui continuent de sonner car la
  // pédale de sustain est maintenue.
  const [sustainedNotes, setSustainedNotes] = useState<Set<string>>(new Set());
  const activeKeyboardKeys = useRef<Set<string>>(new Set());

  // Pédale de sustain (barre d'espace maintenue).
  const sustainRef = useRef(false);
  const [sustainOn, setSustainOn] = useState(false);

  // État persisté (localStorage) : chargé une seule fois à l'initialisation
  // (lazy initializer, pas de re-lecture à chaque render).
  const [initialState] = useState(() => loadPersistedState());

  // Mode lecture automatique
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [importedSongs, setImportedSongs] = useState<Song[]>(initialState.importedSongs);
  const allSongs = useMemo(() => [...BUILTIN_SONGS, ...importedSongs], [importedSongs]);
  const [selectedSongId, setSelectedSongId] = useState(
    allSongs.some((s) => s.id === initialState.selectedSongId)
      ? (initialState.selectedSongId as string)
      : BUILTIN_SONGS[0].id
  );
  const [speed, setSpeed] = useState(initialState.speed); // % de la vitesse d'origine
  const [volume, setVolume] = useState(initialState.volume); // % du volume maître
  const [showKeyLabels, setShowKeyLabels] = useState(initialState.showKeyLabels);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Boucle A-B : rejoue en continu une section du morceau sélectionné.
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const selectedSongDuration = useMemo(() => {
    const song = allSongs.find((s) => s.id === selectedSongId);
    return song ? songDuration(song) : 0;
  }, [allSongs, selectedSongId]);

  // Quand on change de morceau, la section A-B redémarre sur le morceau
  // entier (ajustement pendant le render, pas dans un effect : cf.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [prevSongIdForLoop, setPrevSongIdForLoop] = useState<string | null>(null);
  if (selectedSongId !== prevSongIdForLoop) {
    setPrevSongIdForLoop(selectedSongId);
    setLoopStart(0);
    setLoopEnd(selectedSongDuration);
  }

  // Sélecteur de pistes en attente, le temps que l'utilisateur choisisse
  // lesquelles importer (fichiers MIDI multi-pistes).
  const [pendingImport, setPendingImport] = useState<{
    midi: Midi;
    title: string;
    tracks: TrackSummary[];
  } | null>(null);
  const [selectedTrackIndices, setSelectedTrackIndices] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Persistance : on réécrit l'état complet à chaque changement pertinent.
  useEffect(() => {
    savePersistedState({
      importedSongs,
      selectedSongId,
      speed,
      volume,
      showKeyLabels,
      theme: "dark",
    });
  }, [importedSongs, selectedSongId, speed, volume, showKeyLabels]);

  // Volume maître : converti de % linéaire vers des dB pour Tone.js.
  useEffect(() => {
    if (!samplerRef.current) return;
    const pct = Math.max(VOLUME_MIN_PERCENT, Math.min(VOLUME_MAX_PERCENT, volume));
    // 0% -> -Infinity (muet), 100% -> 0dB, courbe simple en log.
    Tone.getDestination().volume.value =
      pct <= 0 ? -Infinity : 20 * Math.log10(pct / 100);
  }, [volume, loaded]);

  useEffect(() => {
    samplerRef.current = createSampler(() => setLoaded(true));
    return () => {
      partRef.current?.dispose();
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      samplerRef.current?.dispose();
    };
  }, []);

  const noteOn = useCallback(
    (note: string) => {
      if (!samplerRef.current || !loaded) return;
      samplerRef.current.triggerAttack(note);
      setActiveNotes((prev) => new Set(prev).add(note));
    },
    [loaded]
  );

  const noteOff = useCallback((note: string) => {
    if (!samplerRef.current) return;
    if (sustainRef.current) {
      // La pédale est enfoncée : la touche visuelle se relâche, mais le son
      // continue tant que la pédale n'est pas relâchée.
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
      setSustainedNotes((prev) => new Set(prev).add(note));
      return;
    }
    samplerRef.current.triggerRelease(note);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  const releaseSustain = useCallback(() => {
    sustainRef.current = false;
    setSustainOn(false);
    setSustainedNotes((prev) => {
      prev.forEach((note) => samplerRef.current?.triggerRelease(note));
      return new Set();
    });
  }, []);

  const stopPlayback = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    partRef.current?.dispose();
    partRef.current = null;
    setIsPlaying(false);
    setAutoActiveNotes(new Set());
  }, []);

  const playSong = useCallback(async () => {
    if (!samplerRef.current || !loaded || isPlayingRef.current) return;
    await Tone.start();
    stopPlayback();

    const song = allSongs.find((s) => s.id === selectedSongId) ?? allSongs[0];
    if (!song) return;
    const speedFactor = speed / 100;
    const fullDuration = songDuration(song);

    // Si la boucle A-B est active, on ne garde que les évènements de la
    // section choisie, retimés pour démarrer à 0.
    const sectionStart = loopEnabled ? Math.max(0, Math.min(loopStart, fullDuration)) : 0;
    const sectionEnd = loopEnabled
      ? Math.max(sectionStart + 0.1, Math.min(loopEnd, fullDuration))
      : fullDuration;

    const windowedEvents = song.events
      .filter((e) => e.time >= sectionStart && e.time < sectionEnd)
      .map((e) => ({ ...e, time: e.time - sectionStart }));

    // Les évènements du morceau sont déjà en secondes absolues (à vitesse x1) ;
    // on applique juste le facteur de vitesse choisi par l'utilisateur.
    const scaledEvents = windowedEvents.map((e) => ({
      time: e.time / speedFactor,
      note: e.note,
      duration: e.duration / speedFactor,
    }));
    const totalDuration = (sectionEnd - sectionStart) / speedFactor;

    const part = new Tone.Part<SongEvent>((time, event) => {
      samplerRef.current!.triggerAttackRelease(event.note, event.duration, time);
      Tone.getDraw().schedule(() => {
        setAutoActiveNotes((prev) => new Set(prev).add(event.note));
      }, time);
      Tone.getDraw().schedule(
        () => {
          setAutoActiveNotes((prev) => {
            const next = new Set(prev);
            next.delete(event.note);
            return next;
          });
        },
        time + event.duration * NOTE_HIGHLIGHT_RELEASE_FRACTION
      );
    }, scaledEvents);
    part.start(0);
    if (loopEnabled) {
      part.loop = true;
      part.loopStart = 0;
      part.loopEnd = totalDuration;
    }
    partRef.current = part;

    const transport = Tone.getTransport();
    if (!loopEnabled) {
      transport.scheduleOnce(() => {
        Tone.getDraw().schedule(() => stopPlayback(), totalDuration);
      }, totalDuration + PLAYBACK_END_BUFFER_SEC);
    }

    transport.start();
    setIsPlaying(true);
  }, [
    allSongs,
    loaded,
    loopEnabled,
    loopStart,
    loopEnd,
    selectedSongId,
    speed,
    stopPlayback,
  ]);

  const handleImportClick = () => {
    if (isPlaying || isImporting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de resélectionner le même fichier ensuite
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
      // Par défaut : toutes les pistes mélodiques (on décoche la percussion).
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

  const cancelImport = () => {
    setPendingImport(null);
  };

  const toggleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const next = !isFullscreen;
      await win.setFullscreen(next);
      setIsFullscreen(next);
    } catch {
      // API Tauri indisponible (ex: exécution dans un simple navigateur) :
      // on ignore silencieusement, ce n'est pas critique.
    }
  };

  // Computer keyboard -> piano keys (désactivé pendant la lecture auto)
  // + pédale de sustain sur la barre d'espace.
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // évite de scroller la page / déclencher un bouton
        if (!sustainRef.current && !isPlayingRef.current) {
          sustainRef.current = true;
          setSustainOn(true);
        }
        return;
      }
      if (e.repeat || isPlayingRef.current) return;
      const key = e.key.toLowerCase();
      const note = KEY_TO_NOTE[key];
      if (!note || activeKeyboardKeys.current.has(key)) return;
      activeKeyboardKeys.current.add(key);
      // Browsers require a user gesture before audio can start.
      await Tone.start();
      noteOn(note);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        releaseSustain();
        return;
      }
      const key = e.key.toLowerCase();
      const note = KEY_TO_NOTE[key];
      if (!note) return;
      activeKeyboardKeys.current.delete(key);
      if (!isPlayingRef.current) noteOff(note);
    };
    // Si la fenêtre perd le focus pédale enfoncée, on la relâche pour ne
    // pas laisser des notes sonner indéfiniment.
    const handleBlur = () => releaseSustain();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [noteOn, noteOff, releaseSustain]);

  const handleMouseDown = async (note: string) => {
    if (isPlayingRef.current) return;
    await Tone.start();
    noteOn(note);
  };

  const handleMouseUp = (note: string) => {
    if (isPlayingRef.current) return;
    noteOff(note);
  };

  // Détermine la classe CSS d'état d'une touche : appui manuel, lecture
  // automatique, ou note qui continue de sonner via la pédale de sustain.
  const keyStateClass = (note: string): string => {
    if (activeNotes.has(note)) return "active";
    if (autoActiveNotes.has(note)) return "auto-active";
    if (sustainedNotes.has(note)) return "sustained";
    return "";
  };

  return (
    <div className="piano-wrap">
      {!loaded && <div className="piano-loading">Chargement des sons du piano…</div>}

      <div className="playback-controls">
        <select
          value={selectedSongId}
          onChange={(e) => setSelectedSongId(e.target.value)}
          disabled={isPlaying}
        >
          {allSongs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source === "imported" ? `📄 ${s.title}` : s.title}
            </option>
          ))}
        </select>

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

        <label className="speed-label">
          🔊
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

        {!isPlaying ? (
          <button className="play-btn" onClick={playSong} disabled={!loaded}>
            ▶ Lecture automatique
          </button>
        ) : (
          <button className="stop-btn" onClick={stopPlayback}>
            ⏹ Arrêter
          </button>
        )}

        <button
          className="import-btn"
          onClick={handleImportClick}
          disabled={isPlaying || isImporting}
        >
          {isImporting ? "Import…" : "📁 Importer un MIDI"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mid,.midi"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <button
          className="import-btn"
          onClick={() => setShowKeyLabels((v) => !v)}
          title="Afficher/masquer les lettres sur les touches"
        >
          {showKeyLabels ? "🔤 Masquer labels" : "🔤 Afficher labels"}
        </button>

        <button className="import-btn" onClick={toggleFullscreen}>
          {isFullscreen ? "🗗 Quitter plein écran" : "🗖 Plein écran"}
        </button>

        <span
          className={`pedal-badge ${sustainOn ? "pedal-on" : ""}`}
          title="Maintenir la barre d'espace = pédale de sustain"
        >
          🦶 Pédale {sustainOn ? "ON" : "(Espace)"}
        </span>
      </div>

      <div className="loop-controls">
        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => setLoopEnabled(e.target.checked)}
            disabled={isPlaying}
          />
          🔁 Boucle A-B
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
                      {t.likelyMelody && " ⭐ probable mélodie"}
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
          >
            {showKeyLabels && <span className="key-label">{k.label}</span>}
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
          >
            {showKeyLabels && <span className="key-label">{k.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
