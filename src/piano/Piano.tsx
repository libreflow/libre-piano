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
import { useTrackPreview } from "./useTrackPreview";
import { useRecorder } from "./useRecorder";
import { downloadSongAsMidi } from "./midi-export";
import { TRANSPOSE_MIN, TRANSPOSE_MAX, transposedSong } from "./transpose";
import { buildConfigFile, parseConfigFile } from "./config-io";
import { sanitizeState } from "./storage";
import { loadPersistedState, savePersistedState, STATE_VERSION } from "./storage";
import { useAudioEngine, SAMPLE_COUNT } from "./useAudioEngine";
import { usePlayback } from "./usePlayback";
import {
  useMetronome,
  makeTickTrigger,
  startTransportForMetronome,
} from "./useMetronome";
import { METRONOME_MIN_BPM, METRONOME_MAX_BPM } from "./useMetronome";
import { usePractice } from "./usePractice";
import {
  loadStats,
  saveStats,
  recordSession,
  sessionFrom,
  summarize,
  formatSessionDate,
} from "./practice-stats";
import { useKeyboardInput } from "./useKeyboardInput";
import {
  SPEED_MIN_PERCENT,
  SPEED_MAX_PERCENT,
  SPEED_STEP_PERCENT,
  VOLUME_MIN_PERCENT,
  VOLUME_MAX_PERCENT,
  REVERB_MIN_PERCENT,
  REVERB_MAX_PERCENT,
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
  SunIcon,
  MoonIcon,
} from "./icons";
import "./Piano.css";

export default function Piano() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const configInputRef = useRef<HTMLInputElement | null>(null);
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
  const [reverb, setReverb] = useState(initialState.reverb);
  const [transpose, setTranspose] = useState(initialState.transpose);
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
  // Thème clair/sombre (roadmap #64), persisté avec les préférences.
  const [theme, setTheme] = useState<"dark" | "light">(initialState.theme);

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
  } = useAudioEngine(volume, reverb);

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
  // Favoris (roadmap #60) : persistés pour les importés, en mémoire pour
  // les morceaux intégrés (ils sont des constantes du module songs).
  const [builtinFavorites, setBuiltinFavorites] = useState<Set<string>>(
    () => new Set(initialState.importedSongs.filter((s) => s.favorite).map((s) => s.id))
  );
  const allSongs = useMemo(() => {
    const withFav = [...BUILTIN_SONGS, ...importedSongs];
    if (builtinFavorites.size === 0) return withFav;
    return withFav.map((s) =>
      s.source === "builtin" && builtinFavorites.has(s.id) ? { ...s, favorite: true } : s
    );
  }, [importedSongs, builtinFavorites]);
  const toggleFavorite = useCallback((id: string) => {
    setImportedSongs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s))
    );
    setBuiltinFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedSong = useMemo(
    () => allSongs.find((s) => s.id === selectedSongId),
    [allSongs, selectedSongId]
  );

  // Mode apprentissage : la note attendue est surlignée, la session
  // avance quand l'utilisateur joue la bonne note.
  const practice = usePractice(selectedSong);
  // Statistiques de progression (roadmap #38) : persistées dans une clé
  // localStorage dédiée, hors état principal.
  const [stats, setStats] = useState(loadStats);
  const doneRef = useRef(false);
  useEffect(() => {
    if (practice.state.done && !doneRef.current && selectedSong) {
      doneRef.current = true;
      const next = recordSession(
        stats,
        selectedSong.id,
        sessionFrom(practice.state.score ?? 100, practice.state.mistakes, selectedSong)
      );
      setStats(next);
      saveStats(next);
    } else if (!practice.state.done) {
      doneRef.current = false;
    }
  }, [
    practice.state.done,
    practice.state.score,
    practice.state.mistakes,
    selectedSong,
    stats,
  ]);
  const handlePlayedNote = practice.handlePlayedNote;
  const eventsCount = selectedSong?.events.length ?? 0;

  // Enregistrement live (roadmap #46) : capture les notes jouées.
  const recorder = useRecorder();

  const noteOn = useCallback(
    (note: string) => {
      if (status !== "ready" || !samplerRef.current) return;
      rawNoteOn(note);
      markNoteOn(note);
      handlePlayedNote(note);
      recorderRef.current.captureNoteOn(note);
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
      recorderRef.current.captureNoteOff(note);
    },
    [samplerRef, rawNoteOff, markNoteOff, sustainOnRef, clearSustainedNote]
  );
  const releaseSustained = useCallback(() => {
    setSustainedNotes((prev) => {
      prev.forEach((note) => samplerRef.current?.triggerRelease(note));
      return new Set();
    });
  }, [samplerRef]);

  // Transposition (roadmap #53) : morceaux transposés au moment de la
  // lecture (l'original importé reste intact dans le localStorage).
  const playableSongs = useMemo(
    () => allSongs.map((song) => transposedSong(song, transpose)),
    [allSongs, transpose]
  );
  const { isPlaying, isPlayingRef, selectedSongDuration, playSong, stopPlayback } =
    usePlayback(
      status === "ready",
      playableSongs,
      selectedSongId,
      speed,
      { loopEnabled, loopStart, loopEnd },
      triggerAttackRelease,
      markAutoNoteOn,
      markAutoNoteOff
    );

  // Pré-écoute des pistes (roadmap #50) : dans le sélecteur d'import.
  const trackPreview = useTrackPreview(triggerAttackRelease);
  // Métronome (roadmap #27) : tick de sampler sur le Transport.
  // useCallback et pas useMemo : ne touche pas la ref pendant le render
  // (la lisera seulement à l'intérieur du callback, au moment du tick).
  const triggerTick = useCallback(() => {
    makeTickTrigger(samplerRef)();
  }, [samplerRef]);
  const metronome = useMetronome(triggerTick);
  const metronomeEnabledRef = useRef(false);
  useEffect(() => {
    metronomeEnabledRef.current = metronome.enabled;
  }, [metronome.enabled]);
  const toggleMetronome = useCallback(() => {
    metronome.toggle();
    // Le Transport doit tourner pour que le Loop du métronome tique :
    // si on l'active pendant l'arrêt de la lecture, on le démarre.
    if (!metronomeEnabledRef.current) startTransportForMetronome();
  }, [metronome]);
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
    const keyW = parseFloat(getComputedStyle(piano).getPropertyValue("--key-w"));
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

  const recorderRef = useRef(recorder);
  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);
  const toggleRecording = useCallback(() => {
    if (recorder.isRecording) {
      const song = recorder.stop();
      if (song) {
        addImportedSong(song);
        setStatusMessageAuto(
          `Enregistrement sauvegardé : « ${song.title} » (${song.events.length} notes).`
        );
      } else {
        setStatusMessageAuto("Enregistrement vide : aucune note capturée.");
      }
    } else {
      if (isPlayingRef.current) stopPlaybackAndClear();
      recorder.start();
    }
  }, [
    recorder,
    addImportedSong,
    setStatusMessageAuto,
    isPlayingRef,
    stopPlaybackAndClear,
  ]);

  // La lecture ne démarre pas tant que le dialogue de sélection de
  // pistes est ouvert (sinon elle jouerait derrière le dialogue).
  const pendingImportRef = useRef(false);
  useEffect(() => {
    pendingImportRef.current = Boolean(pendingImport);
  }, [pendingImport]);
  // Fermeture du dialogue (import, annulation) : couper la pré-écoute
  // en cours pour ne pas continuer derrière l'UI.
  useEffect(() => {
    if (!pendingImport) trackPreview.stop();
  }, [pendingImport, trackPreview.stop]);

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
      theme,
      reverb,
      transpose,
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
  }, [
    importedSongs,
    selectedSongId,
    speed,
    volume,
    labelMode,
    keyboardLayout,
    theme,
    reverb,
    transpose,
    setStatusMessageAuto,
  ]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Export de la configuration complète (roadmap #62) : télécharge un JSON
  // avec morceaux importés + préférences, transférable vers une autre machine.
  const exportConfig = useCallback(() => {
    const cfg = buildConfigFile({
      importedSongs,
      selectedSongId,
      speed,
      volume,
      showKeyLabels: labelMode !== "none",
      labelMode,
      keyboardLayout,
      theme,
    });
    const blob = new Blob([JSON.stringify(cfg, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "libre-piano-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [importedSongs, selectedSongId, speed, volume, labelMode, keyboardLayout, theme]);

  const importConfig = useCallback(
    async (file: File) => {
      try {
        const parsed = parseConfigFile(JSON.parse(await file.text()));
        if (!parsed) {
          setStatusMessageAuto(
            "Fichier de configuration invalide (pas un export Libre Piano)."
          );
          return;
        }
        const clean = sanitizeState(parsed.state);
        setImportedSongs(clean.importedSongs);
        setSpeed(clean.speed);
        setVolume(clean.volume);
        setLabelMode(clean.labelMode);
        setKeyboardLayout(clean.keyboardLayout);
        setTheme(clean.theme);
        setStatusMessageAuto(
          `Configuration importée : ${clean.importedSongs.length} morceau(x), préférences restaurées.`
        );
      } catch {
        setStatusMessageAuto("Impossible de lire ce fichier de configuration.");
      }
    },
    [setStatusMessageAuto]
  );
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
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
    // Anticipation : la touche suivante, discrète tant qu'elle n'est pas
    // attendue (pas de halo, juste un liseré).
    if (practice.state.nextNote === note) return "next";
    return "";
  };

  // Glisser-déposer un fichier .mid/.midi n'importe où sur la fenêtre.
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (isPlayingRef.current || isImporting) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void importFile(file);
    },
    [importFile, isImporting, isPlayingRef]
  );

  return (
    <div
      className="piano-wrap"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
            {[...allSongs]
              .sort((a, b) => Number(b.favorite ?? false) - Number(a.favorite ?? false))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.favorite ? "★ " : ""}
                  {s.source === "imported" ? `♪ ${s.title}` : s.title}
                </option>
              ))}
          </select>

          {selectedSong && (
            <button
              className="import-btn"
              onClick={() => toggleFavorite(selectedSong.id)}
              disabled={isPlaying}
              aria-pressed={Boolean(selectedSong.favorite)}
              title={
                selectedSong.favorite
                  ? "Retirer des favoris"
                  : "Ajouter aux favoris (remonte en tête)"
              }
              aria-label="Basculer le favori de ce morceau"
            >
              <StarIcon />
            </button>
          )}
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
          <button
            className={`import-btn ${recorder.isRecording ? "stop-btn" : ""}`}
            onClick={toggleRecording}
            disabled={isPlaying || isImporting}
            aria-pressed={recorder.isRecording}
            title={
              recorder.isRecording
                ? "Arrêter l'enregistrement et sauvegarder dans la bibliothèque"
                : "Enregistrer ce que tu joues"
            }
          >
            {recorder.isRecording ? "■ Stopper" : "● Enregistrer"}
          </button>
          <button
            className="import-btn"
            onClick={() => {
              if (selectedSong)
                void downloadSongAsMidi(selectedSong).then((ok) => {
                  if (!ok) setStatusMessageAuto("Échec de l'export MIDI.");
                });
            }}
            disabled={isPlaying || !selectedSong}
            title="Exporter le morceau sélectionné en fichier .mid"
          >
            <ExpandIcon /> .mid
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

          <label className="speed-label" title="Métronome (BPM)">
            <input
              type="checkbox"
              checked={metronome.enabled}
              onChange={toggleMetronome}
              disabled={false}
            />
            <input
              type="range"
              min={METRONOME_MIN_BPM}
              max={METRONOME_MAX_BPM}
              step={1}
              value={metronome.bpm}
              onChange={(e) => metronome.setBpm(Number(e.target.value))}
            />
            <span>{metronome.bpm} BPM</span>
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
          <label className="speed-label volume" title="Profondeur de la réverbe">
            <VolumeIcon />
            <input
              type="range"
              min={REVERB_MIN_PERCENT}
              max={REVERB_MAX_PERCENT}
              step={5}
              value={reverb}
              onChange={(e) => setReverb(Number(e.target.value))}
            />
            <span>Réverbe {reverb}%</span>
          </label>
          <div
            className="segmented"
            role="group"
            aria-label="Transposition en demi-tons"
            title="Transposer la lecture (± demi-tons)"
          >
            <button
              onClick={() => setTranspose((v) => Math.max(TRANSPOSE_MIN, v - 1))}
              disabled={transpose <= TRANSPOSE_MIN || isPlaying}
              aria-label="Transposer un demi-ton plus bas"
            >
              <ChevronLeftIcon />
            </button>
            <span className="octave-label" aria-live="polite">
              {transpose > 0 ? `+${transpose}` : transpose} st
            </span>
            <button
              onClick={() => setTranspose((v) => Math.min(TRANSPOSE_MAX, v + 1))}
              disabled={transpose >= TRANSPOSE_MAX || isPlaying}
              aria-label="Transposer un demi-ton plus haut"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>

        <div className="control-group" aria-label="Disposition du clavier">
          <div
            className="segmented"
            role="group"
            aria-label="Octave de la fenêtre clavier PC"
          >
            <button
              onClick={() => setOctaveShift((v) => Math.max(OCTAVE_SHIFT_MIN, v - 1))}
              disabled={octaveShift <= OCTAVE_SHIFT_MIN || practice.state.active}
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
              disabled={octaveShift >= OCTAVE_SHIFT_MAX || practice.state.active}
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
            onClick={toggleTheme}
            aria-pressed={theme === "light"}
            title={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
            aria-label={
              theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"
            }
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            {theme === "dark" ? "Clair" : "Sombre"}
          </button>
          <button
            className="import-btn"
            onClick={exportConfig}
            disabled={isPlaying}
            title="Exporter morceaux importés + préférences en JSON"
            aria-label="Exporter la configuration"
          >
            <ExpandIcon />
            Exporter
          </button>
          <button
            className="import-btn"
            onClick={() => configInputRef.current?.click()}
            disabled={isPlaying}
            title="Importer un fichier de configuration Libre Piano"
            aria-label="Importer la configuration"
          >
            <ImportIcon />
            Config
          </button>
          <input
            ref={configInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importConfig(file);
            }}
            style={{ display: "none" }}
          />
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

      {isDragOver && (
        <div className="drop-overlay" role="status">
          Dépose ton fichier .mid / .midi pour l'importer
        </div>
      )}
      {statusMessage && <div className="status-message">{statusMessage}</div>}

      {practice.state.active && (
        <div className="practice-panel" role="status">
          {(() => {
            const summary = summarize(stats[selectedSongId]);
            return summary.sessionCount > 0 ? (
              <span className="practice-stats">
                Meilleur : <strong>{summary.bestScore}/100</strong> ·{" "}
                {summary.sessionCount} session(s) · moyenne {summary.averageScore}% · le{" "}
                {formatSessionDate(summary.lastSessionDate)}
              </span>
            ) : null;
          })()}
          {practice.state.done ? (
            <>
              <strong>Session terminée !</strong> {eventsCount} notes,{" "}
              {practice.state.mistakes} faute(s), score {practice.state.score ?? 100}/100.
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
                <button
                  className="import-btn preview-btn"
                  onClick={() => {
                    if (trackPreview.previewingTrack === t.index) {
                      trackPreview.stop();
                      return;
                    }
                    const notes = pendingImport.midi.tracks[t.index]?.notes ?? [];
                    trackPreview.preview(t.index, notes);
                  }}
                  aria-pressed={trackPreview.previewingTrack === t.index}
                  title="Écouter un extrait de cette piste"
                  aria-label={`Pré-écouter la piste ${t.name}`}
                >
                  {trackPreview.previewingTrack === t.index ? (
                    <>
                      <StopIcon /> Écoute…
                    </>
                  ) : (
                    <>
                      <PlayIcon /> Écouter
                    </>
                  )}
                </button>
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
