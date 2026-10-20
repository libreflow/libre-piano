import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureAudioStarted, getContext, getTransport } from "./tone-gate";
import {
  getKeyboardLayout,
  getWindowKeyMap,
  getWhitePositionOfNote,
  getOctaveShiftForNote,
  KeyboardLayout,
  LabelMode,
} from "./notes";
import { BUILTIN_SONGS, Song } from "./songs";
import { useMidiImport } from "./useMidiImport";
import { useTrackPreview } from "./useTrackPreview";
import { useRecorder } from "./useRecorder";
import { downloadSongAsMidi } from "./midi-export";
import { transposedSong } from "./transpose";
import { buildConfigFile, parseConfigFile } from "./config-io";
import { sanitizeState } from "./storage";
import {
  DEFAULT_STATE,
  getActiveProfile,
  setActiveProfile,
  listProfiles,
  DEFAULT_PROFILE,
} from "./storage";
import { useAudioEngine, SAMPLE_COUNT } from "./useAudioEngine";
import { usePlayback } from "./usePlayback";
import { usePractice } from "./usePractice";
import { useCallResponse } from "./useCallResponse";
import { useVisualizer } from "./useVisualizer";
import { detectLanguage, interpolate, type Language } from "./i18n";
import { useI18n } from "./useI18n";
import {
  loadStats,
  saveStats,
  removeStats,
  recordSession,
  sessionFrom,
} from "./practice-stats";
import { useKeyboardInput, DEFAULT_SHORTCUTS } from "./useKeyboardInput";
import { useStatusMessage } from "./hooks/useStatusMessage";
import { usePianoState } from "./hooks/usePianoState";
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
import {
  useFavorites,
  applyBuiltinFavorites,
  importedFavoriteIds,
} from "./hooks/useFavorites";
import {
  REFERENCE_BPM,
} from "./constants";
import { SustainIcon } from "./icons";
import "./Piano.css";

/**
 * Wrapper (roadmap #63) : le sélecteur de profil vit ici ; changer de
 * profil remonte le Piano interne (key) — tout l'état (morceaux,
 * préférences, stats) est relu depuis la clé du profil.
 */
export default function Piano() {
  const [profile, setProfile] = useState(getActiveProfile);
  const [profiles, setProfiles] = useState(listProfiles);
  const [newProfile, setNewProfile] = useState("");
  // E1 (audit ergonomie) : i18n pour la barre de profil. On lit la langue
  // persistée du profil actif (avant le mount de PianoInner).
  const lang = (() => {
    try {
      const raw = localStorage.getItem("libre-piano:profile");
      void raw;
    } catch { /* ignore */ }
    return detectLanguage();
  })();
  const { t } = useI18n(lang);

  const switchProfile = (next: string) => {
    setActiveProfile(next);
    setProfile(next);
    setProfiles(listProfiles());
  };

  return (
    <>
      <PianoInner key={profile} />
      <div className="profile-bar">
        {/* E9 (audit ergonomie) : label visible pour le sélecteur de profil */}
        <label>
          <span className="profile-label-text">{t("profileLabel")}</span>{" "}
          <select
            value={profile}
            onChange={(e) => switchProfile(e.target.value)}
            aria-label={t("profileAria")}
          >
            {profiles.map((p) => (
              <option key={p} value={p}>
                {p === DEFAULT_PROFILE ? t("profileDefault") : p}
              </option>
            ))}
          </select>
        </label>
        {/* E9 : label visible pour le champ de création */}
        <label>
          <span className="profile-label-text">{t("profileNameAria")}</span>{" "}
          <input
            type="text"
            value={newProfile}
            onChange={(e) => setNewProfile(e.target.value)}
            placeholder={t("profilePlaceholder")}
            aria-label={t("profileNameAria")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newProfile.trim().length > 0) {
                switchProfile(newProfile.trim());
                setNewProfile("");
              }
            }}
          />
        </label>
        <button
          className="import-btn"
          onClick={() => {
            if (newProfile.trim().length > 0) {
              switchProfile(newProfile.trim());
              setNewProfile("");
            }
          }}
        >
          {t("profileCreate")}
        </button>
      </div>
    </>
  );
}

function PianoInner() {
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
  // État persisté (Phase A2) : chargement + callback de sauvegarde stable.
  const { initialState, persist } = usePianoState();

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
  const [eq, setEq] = useState(initialState.eq);
  const [showVisualizer, setShowVisualizer] = useState(initialState.visualizer ?? false);
  const [shortcuts, setShortcuts] = useState(initialState.shortcuts ?? DEFAULT_SHORTCUTS);
  // i18n (roadmap #82) : langue persistée, détection système au premier lancement.
  const [language, setLanguage] = useState<Language>(
    initialState.language ?? detectLanguage()
  );
  // E1 (audit ergonomie) : traductions pour les messages de statut et aria-labels.
  const { t } = useI18n(language);
  // E8 (audit ergonomie) : l'attribut lang du document suit la langue active
  // (index.html a un lang="fr" statique sinon).
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

  // Message de statut auto-expirant (Phase A1) : hook dédié.
  const { statusMessage, setStatusMessageAuto } =
    useStatusMessage();
  // Menu Paramètres (refonte UI) : les options secondaires y sont regroupées.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);
  // N'avertir qu'une fois par "session de dépassement" du quota.
  const quotaWarnedRef = useRef(false);
  // E13 (audit ergonomie) : flash visuel sur la barre de contrôles après un
  // import de configuration réussi (le message de statut seul passe inaperçu).
  const [configFlash, setConfigFlash] = useState(false);
  const configFlashTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (configFlashTimerRef.current !== null) {
        window.clearTimeout(configFlashTimerRef.current);
      }
    },
    []
  );

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
    releaseSustainedNote,
    triggerAttackRelease,
  } = useAudioEngine(volume, reverb, eq);

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
  // Favoris (roadmap #60, Phase A3) : hook dédié.
  const { builtinFavorites, toggleFavorite: toggleBuiltinFavorite } = useFavorites(
    importedFavoriteIds(initialState.importedSongs)
  );
  const allSongs = useMemo(
    () =>
      applyBuiltinFavorites([...BUILTIN_SONGS, ...importedSongs], builtinFavorites),
    [importedSongs, builtinFavorites]
  );
  const toggleFavorite = useCallback(
    (id: string) => {
      setImportedSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s))
      );
      toggleBuiltinFavorite(id);
    },
    [toggleBuiltinFavorite]
  );

  const selectedSong = useMemo(
    () => allSongs.find((s) => s.id === selectedSongId),
    [allSongs, selectedSongId]
  );

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
      captureNoteOff(note);
    },
    [
      samplerRef,
      rawNoteOff,
      markNoteOff,
      sustainOnRef,
      clearSustainedNote,
      captureNoteOff,
    ]
  );
  // Roadmap #28 : le relâchement de la pédale libère les notes tenues
  // avec un release réellement prolongé (elles s'éteignent doucement
  // au lieu d'être coupées net).
  const releaseSustained = useCallback(() => {
    setSustainedNotes((prev) => {
      prev.forEach((note) => releaseSustainedNote(note));
      return new Set();
    });
  }, [releaseSustainedNote]);

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

  // Capture d'une touche pour remapper un raccourci (roadmap #65).
  const remapCaptureRef = useRef<"sustain" | "togglePlayback" | null>(null);
  const [remapping, setRemapping] = useState<"sustain" | "togglePlayback" | null>(null);
  const setRemapCapture = useCallback((target: "sustain" | "togglePlayback" | null) => {
    remapCaptureRef.current = target;
    setRemapping(target);
  }, []);
  useEffect(() => {
    if (!remapping) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const code = e.code;
      // B12 (audit) : ignorer les modificateurs et touches système comme
      // raccourci — sinon Ctrl/Alt/Shift deviendrait la pédale ou le play.
      const MODIFIER_CODES = new Set([
        "ControlLeft", "ControlRight",
        "AltLeft", "AltRight",
        "ShiftLeft", "ShiftRight",
        "MetaLeft", "MetaRight",
        "CapsLock", "NumLock", "ScrollLock",
        "OSLeft", "OSRight",
      ]);
      if (code !== "Escape" && !MODIFIER_CODES.has(code)) {
        setShortcuts((prev) => ({ ...prev, [remapping]: code }));
      }
      setRemapCapture(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [remapping, setRemapCapture]);

  // Temps de lecture courant (roadmaps #41/#99) : rafraîchi par RAF
  // pendant la lecture, pour les marqueurs de mesures et les paroles.
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      setPlaybackSeconds(getTransport().seconds);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // Paroles synchronisées (roadmap #99) : ligne courante du morceau
  // sélectionné, selon le temps de lecture.
  const currentLyric = selectedSong?.lyrics
    ?.filter((l) => l.time <= playbackSeconds)
    .pop();

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

  // Centrer le clavier sur la zone médiane (C4) au montage : le piano
  // 88 touches est plus large que la fenêtre.
  useEffect(() => {
    const el = pianoScrollRef.current;
    const piano = el?.querySelector(".piano");
    if (!el || !piano) return;
    const idx = getWhitePositionOfNote("C4");
    // B13 (audit) : valeur par défaut 60px (cf. --key-w dans Piano.css) si
    // la variable CSS est absente — parseFloat("") = NaN casserait le scroll.
    const keyW =
      parseFloat(getComputedStyle(piano).getPropertyValue("--key-w")) || 60;
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
    // B13 (audit) : valeur par défaut 60px (cf. --key-w dans Piano.css).
    const keyW =
      parseFloat(getComputedStyle(piano).getPropertyValue("--key-w")) || 60;
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
  } = useMidiImport(addImportedSong, setStatusMessageAuto, language);

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
        addImportedSong(song);
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

  // E3 (audit ergonomie) : la suppression passe par une modale custom
  // (ConfirmDialog) au lieu de window.confirm() — le morceau à supprimer est
  // mémorisé dans deleteTarget, la suppression réelle a lieu à la confirmation.
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const requestDeleteSong = useCallback(
    (id: string) => {
      const song = importedSongs.find((s) => s.id === id);
      if (song) setDeleteTarget(song);
    },
    [importedSongs]
  );
  // Suppression d'un morceau importé (libère aussi le localStorage).
  const confirmDeleteSong = useCallback(() => {
    const song = deleteTarget;
    setDeleteTarget(null);
    if (!song) return;
    setImportedSongs((prev) => prev.filter((s) => s.id !== song.id));
    // B10 (audit) : nettoyer les stats du morceau supprimé.
    setStats((prev) => {
      const next = removeStats(prev, song.id);
      saveStats(next);
      return next;
    });
    setSelectedSongId((current) =>
      current === song.id ? (BUILTIN_SONGS[0]?.id ?? "") : current
    );
  }, [deleteTarget]);

  // Persistance : réécrit l'état complet à chaque changement pertinent.
  useEffect(() => {
    const saved = persist({
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
    });
    // Quota localStorage dépassé : avertir au lieu d'échouer en silence.
    if (!saved && !quotaWarnedRef.current) {
      quotaWarnedRef.current = true;
      setStatusMessageAuto(t("quotaFull"));
    } else if (saved) {
      quotaWarnedRef.current = false;
    }
  }, [
    persist,
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
    setStatusMessageAuto,
    t,
  ]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Export de la configuration complète (roadmap #62) : télécharge un JSON
  // avec morceaux importés + préférences, transférable vers une autre machine.
  const exportConfig = useCallback(() => {
    const cfg = buildConfigFile({
      ...DEFAULT_STATE,
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
    eq,
    showVisualizer,
    shortcuts,
    language,
  ]);

  const importConfig = useCallback(
    async (file: File) => {
      try {
        const parsed = parseConfigFile(JSON.parse(await file.text()));
        if (!parsed) {
          setStatusMessageAuto(t("configInvalid"));
          return;
        }
        const clean = sanitizeState(parsed.state);
        setImportedSongs(clean.importedSongs);
        setSpeed(clean.speed);
        setVolume(clean.volume);
        setLabelMode(clean.labelMode);
        setKeyboardLayout(clean.keyboardLayout);
        setTheme(clean.theme);
        // B1 (audit) : tous les champs exportés doivent être restaurés,
        // pas seulement une partie (sinon l'import est asymétrique).
        setReverb(clean.reverb);
        setTranspose(clean.transpose);
        setEq(clean.eq);
        setShowVisualizer(clean.visualizer ?? false);
        setShortcuts(clean.shortcuts ?? DEFAULT_SHORTCUTS);
        setLanguage(clean.language ?? detectLanguage());
        setStatusMessageAuto(
          interpolate(t("configImported"), { count: clean.importedSongs.length })
        );
        // E13 : flash visuel bref pour signaler que les réglages ont changé.
        if (configFlashTimerRef.current !== null) {
          window.clearTimeout(configFlashTimerRef.current);
        }
        setConfigFlash(true);
        configFlashTimerRef.current = window.setTimeout(
          () => setConfigFlash(false),
          1200
        );
      } catch {
        setStatusMessageAuto(t("configReadError"));
      }
    },
    [setStatusMessageAuto, t]
  );
  // B14 (audit) : mémoïsé — lu par React Compiler, passé à PianoKeyboard.
  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );
  // Plein écran (Phase A4) : hook dédié (B9 : suit les sorties natives).

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
              setRemapCapture("sustain");
              setSettingsOpen(false);
            }}
            onRemapTogglePlayback={() => {
              setStatusMessageAuto(t("remapPlayPrompt"));
              setRemapCapture("togglePlayback");
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
      {isPlaying && (currentLyric || isPlaying) && (
        <div className="playback-overlay" aria-live="off">
          {selectedSong?.lyrics && selectedSong.lyrics.length > 0 ? (
            <div className="lyrics-line" key={currentLyric?.text}>
              {currentLyric?.text ?? "…"}
            </div>
          ) : null}
          {isPlaying && (
            <div className="measure-track" aria-hidden="true">
              {/* B11 (audit) : le nombre de mesures est dérivé de la durée
                  du morceau (avant : plafond fixe de 32 mesures = 76,8 s à
                  100 BPM — les morceaux plus longs n'avaient plus de marqueurs). */}
              {Array.from(
                {
                  length: Math.max(
                    1,
                    Math.ceil(selectedSongDuration / ((4 * 60) / REFERENCE_BPM))
                  ),
                },
                (_, i) => {
                  const measureSec = (i * 4 * 60) / REFERENCE_BPM;
                  const active =
                    playbackSeconds >= measureSec &&
                    playbackSeconds < measureSec + (4 * 60) / REFERENCE_BPM;
                  return (
                    <span
                      key={i}
                      className={`measure-dot${active ? " active" : ""}${
                        i % 4 === 0 ? " strong" : ""
                      }`}
                    />
                  );
                }
              )}
            </div>
          )}
        </div>
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
        onConfirm={confirmDeleteSong}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
