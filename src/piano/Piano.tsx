import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureAudioStarted, getContext } from "./tone-gate";
import {
  getKeyboardLayout,
  getWindowKeyMap,
  getOctaveShiftForNote,
  KeyboardLayout,
  LabelMode,
} from "./notes";
import { useMidiImport } from "./useMidiImport";
import { useTrackPreview } from "./useTrackPreview";
import { useRecorder } from "./useRecorder";
import { downloadSongAsMidi } from "./midi-export";
import { transposedSong } from "./transpose";
import { getActiveProfile } from "./storage";
import { useAudioEngine, SAMPLE_COUNT } from "./useAudioEngine";
import { usePlayback } from "./usePlayback";
import { usePractice } from "./usePractice";
import { useCallResponse } from "./useCallResponse";
import { useVisualizer } from "./useVisualizer";
import { detectLanguage, interpolate, type Language } from "./i18n";
import { useI18n } from "./useI18n";
import { useKeyboardInput, DEFAULT_SHORTCUTS } from "./useKeyboardInput";
import { useStatusMessage } from "./hooks/useStatusMessage";
import { usePianoState, type PersistedSnapshot } from "./hooks/usePianoState";
import { useFullscreen } from "./hooks/useFullscreen";
import PianoKeyboard from "./components/PianoKeyboard";
import StatusOverlays from "./components/StatusOverlays";
import TrackPicker from "./components/TrackPicker";
import PracticePanel from "./components/PracticePanel";
import EchoPanel from "./components/EchoPanel";
import LoopControls from "./components/LoopControls";
import SettingsMenu from "./components/SettingsMenu";
import PlaybackControls from "./components/PlaybackControls";
import SoundControls from "./components/SoundControls";
import KeyboardControls from "./components/KeyboardControls";
import ConfirmDialog from "./components/ConfirmDialog";
import PlaybackOverlay from "./components/PlaybackOverlay";
import ProfileBar from "./components/ProfileBar";
import { useActiveNotes } from "./hooks/useActiveNotes";
import { useSettingsMenuState } from "./hooks/useSettingsMenuState";
import { useSongLibrary } from "./hooks/useSongLibrary";
import { usePersistSnapshot } from "./hooks/usePersistSnapshot";
import { usePracticeStats } from "./hooks/usePracticeStats";
import { useConfigTransfer } from "./hooks/useConfigTransfer";
import { SustainIcon } from "./icons";
import "./Piano.css";

export default function Piano() {
  // Wrapper (roadmap #63) : la barre de profils (extraite) pilote la clé
  // du Piano interne — changer de profil le remonte et tout l'état est
  // relu depuis la clé du profil.
  const [profile, setProfile] = useState(getActiveProfile);
  return (
    <>
      <PianoInner key={profile} />
      <ProfileBar onSwitch={setProfile} />
    </>
  );
}

function PianoInner() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const configInputRef = useRef<HTMLInputElement | null>(null);
  const pianoScrollRef = useRef<HTMLDivElement | null>(null);
  // Surbrillance des touches (hooks/useActiveNotes) : états active/auto/
  // sustained + routage sustain + miroirs refs pour les callbacks stables.
  const notes = useActiveNotes();
  const {
    activeNotes,
    autoActiveNotes,
    sustainedNotes,
    sustainOn,
    setSustainOn,
    markNoteOn,
    markAutoNoteOn,
    markAutoNoteOff,
    routeNoteOff,
    clearAutoNotes,
    sustainedNotesRef,
  } = notes;

  // État persisté (localStorage, Phase A2) : chargement + sauvegarde stable.
  const { initialState, persist } = usePianoState();

  const [speed, setSpeed] = useState(initialState.speed);
  const [reverb, setReverb] = useState(initialState.reverb);
  const [transpose, setTranspose] = useState(initialState.transpose);
  const [eq, setEq] = useState(initialState.eq);
  const [showVisualizer, setShowVisualizer] = useState(initialState.visualizer ?? false);
  // i18n (roadmap #82) : langue persistée, détection système au premier lancement.
  const [language, setLanguage] = useState<Language>(
    initialState.language ?? detectLanguage()
  );
  // E1 : traductions pour les messages de statut et aria-labels.
  const { t } = useI18n(language);
  // E8 : l'attribut lang du document suit la langue active.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const { canvasRef: visualizerCanvasRef } = useVisualizer(showVisualizer);
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
  // Thème clair/sombre (roadmap #64), persisté avec les préférences.
  const [theme, setTheme] = useState<"dark" | "light">(initialState.theme);
  // Plein écran (Phase A4) : hook dédié.
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Message de statut auto-expirant (Phase A1).
  const { statusMessage, setStatusMessageAuto } = useStatusMessage();

  // Menu Paramètres + remap des raccourcis (hooks/useSettingsMenuState, B12).
  const {
    settingsOpen,
    setSettingsOpen,
    settingsRef,
    shortcuts,
    setShortcuts: setConfigShortcuts,
    remapping,
    startRemap,
  } = useSettingsMenuState(initialState.shortcuts ?? DEFAULT_SHORTCUTS);

  // Boucle A-B. Les bornes sont clampées : Number("") ou une saisie
  // invalide dans les <input type="number"> donne NaN, qu'on ramène \u00e0 0.
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

  // Bibliothèque de morceaux (hooks/useSongLibrary) : fusion builtin/importés,
  // favoris (roadmap #60), sélection validée, suppression (E3).
  const library = useSongLibrary(initialState.importedSongs, initialState.selectedSongId);
  const { importedSongs } = library;
  const {
    allSongs,
    selectedSong,
    selectedSongId,
    setSelectedSongId,
    toggleFavorite,
    deleteTarget,
    requestDeleteSong,
    confirmDeleteSong,
    cancelDeleteSong,
  } = library;

  // Statistiques de progression (hooks/usePracticeStats, roadmap #38) :
  // une session est enregistrée quand practice passe à done ; la purge
  // d'un morceau supprimé (B10) est injectée à la confirmation.
  const {
    samplerRef,
    status,
    loadedCount,
    noteOn: rawNoteOn,
    noteOff: rawNoteOff,
    releaseSustainedNote,
    triggerAttackRelease,
  } = useAudioEngine(volume, reverb, eq);

  // Mode apprentissage : la note attendue est surlignée, la session
  // avance quand l'utilisateur joue la bonne note.
  // B1 (audit) : l'apprentissage travaille sur le morceau TRANSPOSÉ —
  // comme la lecture — sinon la touche attendue ne correspond pas à ce
  // qui est joué quand une transposition est active.
  const selectedPlayable = useMemo(
    () => (selectedSong ? transposedSong(selectedSong, transpose) : undefined),
    [selectedSong, transpose]
  );
  const practice = usePractice(selectedPlayable);
  const { stats, purgeSong } = usePracticeStats(
    selectedSong,
    practice.state
  );
  const handlePlayedNote = practice.handlePlayedNote;
  const eventsCount = selectedSong?.events.length ?? 0;
  // Call & response (roadmap #43) : l'app joue une phrase, l'utilisateur
  // la rejoue. Branché sur les notes jouées et la lecture de démo.
  const callResponse = useCallResponse(selectedSong, triggerAttackRelease);
  const callResponseOnPlayed = callResponse.handlePlayedNote;
  const playedNoteHandler = useCallback(
    (note: string) => {
      handlePlayedNote(note);
      callResponseOnPlayed(note);
    },
    [handlePlayedNote, callResponseOnPlayed]
  );

  // Enregistrement live (roadmap #46) : capture les notes jouées.
  // Destructuré : le Compiler veut des valeurs stables en deps, pas
  // l'objet entier du hook.
  const {
    isRecording,
    start: startRecording,
    stop: stopRecording,
    captureNoteOn,
    captureNoteOff,
  } = useRecorder();

  const noteOn = useCallback(
    (note: string) => {
      if (status !== "ready" || !samplerRef.current) return;
      rawNoteOn(note);
      markNoteOn(note);
      playedNoteHandler(note);
      // B3 (audit) : le clavier PC capture une vélocité par défaut
      // explicite (pas de position de frappe) — cohérent avec la souris.
      captureNoteOn(note, 0.8);
    },
    [status, samplerRef, rawNoteOn, markNoteOn, playedNoteHandler, captureNoteOn]
  );
  const noteOff = useCallback(
    (note: string) => {
      if (!samplerRef.current) return;
      // Routage sustain (hooks/useActiveNotes) : pédale enfoncée -> la
      // note rejoint les sustained ; sinon relâchée + reste nettoyé.
      routeNoteOff(note, (n) => {
        rawNoteOff(n);
        captureNoteOff(n);
      });
    },
    [samplerRef, routeNoteOff, rawNoteOff, captureNoteOff]
  );
  // Roadmap #28 : le relâchement de la pédale libère les notes tenues
  // avec un release réellement prolongé (m8 : lecture hors updater).
  const releaseSustained = useCallback(() => {
    const held = [...sustainedNotesRef.current];
    if (held.length === 0) return;
    notes.clearSustained();
    held.forEach((note) => releaseSustainedNote(note));
  }, [notes, sustainedNotesRef, releaseSustainedNote]);

  // P5 (audit perf) : seul le morceau sélectionné est transposé pour la
  // lecture (avant : toute la bibliothèque était transposée à chaque
  // changement de transposition, même les morceaux non sélectionnés).
  const selectedPlayableForPlayback = useMemo(
    () => (selectedSong ? transposedSong(selectedSong, transpose) : undefined),
    [selectedSong, transpose]
  );
  const { isPlaying, isPlayingRef, selectedSongDuration, playSong, stopPlayback } =
    usePlayback(
      status === "ready",
      selectedPlayableForPlayback,
      speed,
      { loopEnabled, loopStart, loopEnd },
      triggerAttackRelease,
      markAutoNoteOn,
      markAutoNoteOff
    );

  // Pré-écoute des pistes (roadmap #50) : dans le sélecteur d'import.
  const trackPreview = useTrackPreview(triggerAttackRelease);
  useKeyboardInput({
    layout: keyboardLayout,
    octaveShift,
    shortcuts,
    // B12 : la capture de remap neutralise le clavier de jeu.
    ignoreNotes: remapping !== null,
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

  // Arrêt de la lecture + nettoyage des touches en surbrillance
  // (hors effect : cf. règle set-state-in-effect).
  const stopPlaybackAndClear = useCallback(() => {
    stopPlayback();
    clearAutoNotes();
  }, [stopPlayback, clearAutoNotes]);

  const {
    pendingImport,
    selectedTrackIndices,
    isImporting,
    importFile,
    toggleTrack,
    confirmImport,
    cancelImport,
  } = useMidiImport(library.addImportedSong, setStatusMessageAuto, language);

  // Replay (roadmap #45) : dernier enregistrement sélectionnable en un
  // clic pour le rejouer.
  const [lastRecordingId, setLastRecordingId] = useState<string | null>(null);
  // Volontairement NON mémoïsé : le Compiler ne peut pas préserver une
  // mémoïsation lisant isPlayingRef (ref mutable), et ce handler UI n'a pas
  // besoin d'identité stable — il est passé à un composant mémoïsé (B14)
  // qui re-rendera de toute façon quand isRecording change.
  const toggleRecording = () => {
    if (isRecording) {
      const song = stopRecording();
      if (song) {
        setLastRecordingId(song.id);
        library.addImportedSong(song);
        setStatusMessageAuto(
          interpolate(t("recordSaved"), {
            title: song.title,
            count: song.events.length,
          })
        );
      } else {
        setStatusMessageAuto(t("recordEmpty"));
      }
    } else {
      if (isPlayingRef.current) stopPlaybackAndClear();
      startRecording();
    }
  };

  // La lecture ne démarre pas tant que le dialogue de sélection de
  // pistes est ouvert (sinon elle jouerait derrière le dialogue).
  const pendingImportRef = useRef(false);
  useEffect(() => {
    pendingImportRef.current = Boolean(pendingImport);
  }, [pendingImport]);
  // Fermeture du dialogue (import, annulation) : couper la pré-écoute
  // en cours pour ne pas continuer derrière l'UI.
  const { stop: stopTrackPreview } = trackPreview;
  useEffect(() => {
    if (!pendingImport) stopTrackPreview();
  }, [pendingImport, stopTrackPreview]);

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

  // Persistance debouncée (hooks/usePersistSnapshot, P4 audit perf) :
  // 300 ms après le dernier changement, + flush au démontage.
  const persistSnapshot = useMemo<PersistedSnapshot>(
    () => ({
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
      eq,
      visualizer: showVisualizer,
      shortcuts,
      language,
    }),
    [
      importedSongs,
      selectedSongId,
      speed,
      volume,
      labelMode,
      keyboardLayout,
      theme,
      reverb,
      transpose,
      eq,
      showVisualizer,
      shortcuts,
      language,
    ]
  );
  const quotaWarnRef = useRef(false);
  const handleQuotaFull = useCallback(() => {
    if (quotaWarnRef.current) return;
    quotaWarnRef.current = true;
    setStatusMessageAuto(t("quotaFull"));
  }, [setStatusMessageAuto, t]);
  usePersistSnapshot(persistSnapshot, persist, handleQuotaFull);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // B14 : mmémoïsé \u2014 lu par React Compiler, pass\u00e9 \u00e0 PianoKeyboard.
  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  // Export / import de la configuration (hooks/useConfigTransfer, roadmap #62).
  const configSetters = useMemo(
    () => ({
      setSpeed,
      setVolume,
      setLabelMode,
      setKeyboardLayout,
      setTheme,
      setReverb,
      setTranspose,
      setEq,
      setShowVisualizer,
      setShortcuts: setConfigShortcuts,
      setLanguage,
      setImportedSongs: library.setImportedSongs,
    }),
    [library, setConfigShortcuts]
  );
  const { exportConfig, importConfig, configFlash } = useConfigTransfer(
    {
      importedSongs,
      selectedSongId,
      speed,
      volume,
      labelMode,
      keyboardLayout,
      theme,
      reverb,
      transpose,
      eq,
      visualizer: showVisualizer,
      shortcuts,
      language,
    },
    configSetters,
    setStatusMessageAuto,
    t
  );

  // Vélocité au clic (roadmap #15) : plus le clic est bas sur la touche,
  // plus la note est forte — comme un vrai clavier (zone basse = frappe
  // pleine, haut = pianissimo).
  const noteOnWithVelocity = useCallback(
    (note: string, velocity?: number) => {
      if (status !== "ready" || !samplerRef.current) return;
      rawNoteOn(note, velocity);
      markNoteOn(note);
      playedNoteHandler(note);
      captureNoteOn(note, velocity);
    },
    [status, samplerRef, rawNoteOn, markNoteOn, playedNoteHandler, captureNoteOn]
  );
  // B14 (audit) : mémoïsés — recréés à chaque render sinon, ce qui fait
  // re-rendre PianoKeyboard (88 boutons) à chaque frame de lecture.
  const handlePointerDown = useCallback(
    (note: string, e: React.PointerEvent<HTMLButtonElement>) => {
      if (isPlayingRef.current) return;
      if (getContext().state !== "running") void ensureAudioStarted();
      // Position relative verticale : 0 (haut, doux) → 1 (bas, fort),
      // mappée sur une plage jouable 0.35–1.
      const rect = e.currentTarget.getBoundingClientRect();
      const rel = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      noteOnWithVelocity(note, 0.35 + rel * 0.65);
    },
    // isPlayingRef est une ref — le Compiler accepte la mémoïsation car la
    // ref n'est lue qu'à l'intérieur du callback (jamais pendant le render).
    [noteOnWithVelocity, isPlayingRef]
  );
  const handlePointerUp = useCallback(
    (note: string) => {
      // Toujours relâcher une note active : si la lecture a démarré pendant
      // le clic maintenu, la note sonnerait à l'infini après l'arrêt.
      if (!activeNotes.has(note)) return;
      noteOff(note);
    },
    [activeNotes, noteOff]
  );

  const keyStateClass = useCallback(
    (note: string): string => {
      if (practice.state.expectedNote === note) return "expected";
      if (activeNotes.has(note)) return "active";
      if (autoActiveNotes.has(note)) return "auto-active";
      if (sustainedNotes.has(note)) return "sustained";
      // Anticipation : la touche suivante, discrète tant qu'elle n'est pas
      // attendue (pas de halo, juste un liseré).
      if (practice.state.nextNote === note) return "next";
      return "";
    },
    [practice.state.expectedNote, practice.state.nextNote, activeNotes, autoActiveNotes, sustainedNotes]
  );

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
      {(status === "loading" || status === "error") && (
        <StatusOverlays
          status={status}
          loadedCount={loadedCount}
          sampleCount={SAMPLE_COUNT}
          statusMessage={statusMessage}
          isDragOver={isDragOver}
          language={language}
        />
      )}

      <div
        className={`playback-controls${configFlash ? " config-flash" : ""}`}
        role="toolbar"
        aria-label={t("controls")}
      >
        <PlaybackControls
          songs={allSongs}
          selectedSongId={selectedSongId}
          selectedSong={selectedSong}
          isPlaying={isPlaying}
          isRecording={isRecording}
          isImporting={isImporting}
          statusReady={status === "ready"}
          hasPendingImport={Boolean(pendingImport)}
          practiceActive={practice.state.active}
          echoActive={callResponse.state.active}
          lastRecordingId={lastRecordingId}
          fileInputRef={fileInputRef}
          language={language}
          onSelectSong={setSelectedSongId}
          onToggleFavorite={toggleFavorite}
          onDeleteSong={requestDeleteSong}
          onPlay={playSongGuarded}
          onStop={stopPlaybackAndClear}
          onImportFile={(file) => void importFile(file)}
          onToggleRecording={toggleRecording}
          onReplayLastRecording={() => {
            if (!lastRecordingId) return;
            setSelectedSongId(lastRecordingId);
            setStatusMessageAuto(t("replaySelected"));
          }}
          onExportMidi={() => {
            if (selectedSong)
              void downloadSongAsMidi(selectedSong).then((ok) => {
                if (!ok) setStatusMessageAuto(t("exportFailed"));
              });
          }}
          onTogglePractice={() => {
            if (practice.state.active) {
              practice.stop();
            } else {
              if (isPlayingRef.current) stopPlaybackAndClear();
              practice.start();
            }
          }}
          onToggleEcho={() => {
            if (callResponse.state.active) {
              callResponse.stop();
            } else {
              if (isPlayingRef.current) stopPlaybackAndClear();
              if (practice.state.active) practice.stop();
              // B2 (audit) : start() délègue déjà à playPhrase(0) via
              // playPhraseRef — ne pas appeler playPhrase(0) en plus.
              callResponse.start();
            }
          }}
        />

        <SoundControls
          speed={speed}
          onSpeedChange={setSpeed}
          volume={volume}
          onVolumeChange={setVolume}
          reverb={reverb}
          onReverbChange={setReverb}
          eq={eq}
          onEqChange={setEq}
          transpose={transpose}
          onTransposeChange={setTranspose}
          isPlaying={isPlaying}
          language={language}
        />

        <KeyboardControls
          octaveShift={octaveShift}
          onOctaveShiftChange={setOctaveShift}
          keyboardLayout={keyboardLayout}
          onLayoutChange={setKeyboardLayout}
          practiceActive={practice.state.active}
          language={language}
        />

        <div className="control-group" aria-label={t("groupDisplay")}>
          <SettingsMenu
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            menuRef={settingsRef}
            labelMode={labelMode}
            onLabelModeChange={setLabelMode}
            showVisualizer={showVisualizer}
            onToggleVisualizer={() => setShowVisualizer((v) => !v)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            language={language}
            onToggleLanguage={() => setLanguage((l) => (l === "fr" ? "en" : "fr"))}
            shortcuts={shortcuts}
            onRemapSustain={() => {
              setStatusMessageAuto(t("remapSustainPrompt"));
              startRemap("sustain");
              setSettingsOpen(false);
            }}
            onRemapTogglePlayback={() => {
              setStatusMessageAuto(t("remapPlayPrompt"));
              startRemap("togglePlayback");
              setSettingsOpen(false);
            }}
            isPlaying={isPlaying}
            onExportConfig={exportConfig}
            onImportConfig={() => configInputRef.current?.click()}
            configInputRef={configInputRef}
            onConfigFile={(file) => void importConfig(file)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
          <span
            className={`pedal-badge ${sustainOn ? "pedal-on" : ""}`}
            title={t("sustainHint")}
          >
            <SustainIcon />
            {sustainOn ? t("sustainOn") : t("sustainOff")}
          </span>
        </div>
      </div>

      <LoopControls
        loopEnabled={loopEnabled}
        loopStart={loopStart}
        loopEnd={loopEnd}
        songDuration={selectedSongDuration}
        isPlaying={isPlaying}
        language={language}
        onToggle={setLoopEnabled}
        onStartChange={setLoopStart}
        onEndChange={setLoopEnd}
      />



      {status === "ready" && (
        <StatusOverlays
          status={status}
          loadedCount={loadedCount}
          sampleCount={SAMPLE_COUNT}
          statusMessage={statusMessage}
          isDragOver={isDragOver}
          language={language}
        />
      )}

      {practice.state.active && (
        <PracticePanel
          state={practice.state}
          stats={stats[selectedSongId]}
          eventsCount={eventsCount}
          selectedSong={selectedSong}
          noteToKey={noteToKey}
          language={language}
          onStart={practice.start}
          onStop={practice.stop}
        />
      )}
      {callResponse.state.active && (
        <EchoPanel
          state={callResponse.state}
          language={language}
          // B2 (audit) : start() délègue à playPhrase(0) — un seul appel.
          onRestart={callResponse.start}
          onStop={callResponse.stop}
        />
      )}
      {pendingImport && (
        <TrackPicker
          pendingImport={pendingImport}
          selectedTrackIndices={selectedTrackIndices}
          previewingTrack={trackPreview.previewingTrack}
          language={language}
          onToggleTrack={toggleTrack}
          onPreview={(index) => {
            const notes = pendingImport.midi.tracks[index]?.notes ?? [];
            trackPreview.preview(index, notes);
          }}
          onStopPreview={trackPreview.stop}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      )}
      {showVisualizer && (() => {
        // B10 (audit) : support HiDPI — la résolution interne est multipliée
        // par devicePixelRatio (sinon flou sur écrans Retina), la taille CSS
        // reste 480×48. Le contexte est mis à l'échelle dans useVisualizer.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        return (
          <canvas
            ref={visualizerCanvasRef}
            className="waveform-canvas"
            width={Math.round(480 * dpr)}
            height={Math.round(48 * dpr)}
            data-dpr={dpr}
            aria-label={t("lyricsWave")}
          />
        );
      })()}
      {/* B6 (audit) : les paroles ne s'affichent que pendant la lecture
          automatique — pendant l'echo ou l'apprentissage, le temps de
          lecture est périmé et la ligne serait fausse. */}
      {isPlaying && (
        <PlaybackOverlay
          song={selectedSong}
          songDuration={selectedSongDuration}
          speed={speed}
        />
      )}
      <PianoKeyboard
        allKeys={ALL_KEYS}
        whiteKeyCount={whiteKeyCount}
        windowKeys={windowKeys}
        labelMode={labelMode}
        isPlaying={isPlaying}
        keyStateClass={keyStateClass}
        activeNotes={activeNotes}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        scrollRef={pianoScrollRef}
        language={language}
      />
      {/* E3 (audit ergonomie) : modale de confirmation de suppression. */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("deleteConfirmTitle")}
        message={
          deleteTarget
            ? interpolate(t("deleteConfirm"), { title: deleteTarget.title })
            : ""
        }
        confirmLabel={t("deleteConfirmOk")}
        cancelLabel={t("deleteConfirmCancel")}
        onConfirm={() => confirmDeleteSong(purgeSong)}
        onCancel={cancelDeleteSong}
      />
    </div>
  );
}
