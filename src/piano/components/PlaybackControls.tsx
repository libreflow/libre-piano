// Groupe « Lecture » de la toolbar (refactor Phase B7) : sélection de
// morceau, favoris, lecture/arrêt, import, enregistrement, modes.
// E1 (audit ergonomie) : tous les textes passent par useI18n.

import { memo, useMemo } from "react";
import type { RefObject } from "react";
import type { Song } from "../songs";
import { sortLibrary } from "../hooks/useFavorites";
import { useI18n } from "../useI18n";
import type { Language } from "../i18n";
import {
  PlayIcon,
  StopIcon,
  ImportIcon,
  ExpandIcon,
  StarIcon,
  TrashIcon,
  PracticeIcon,
} from "../icons";

export interface PlaybackControlsProps {
  songs: Song[];
  selectedSongId: string;
  selectedSong: Song | undefined;
  isPlaying: boolean;
  isRecording: boolean;
  isImporting: boolean;
  statusReady: boolean;
  hasPendingImport: boolean;
  practiceActive: boolean;
  echoActive: boolean;
  lastRecordingId: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  language: Language;
  onSelectSong: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteSong: (id: string) => void;
  onPlay: () => void;
  onStop: () => void;
  onImportFile: (file: File) => void;
  onToggleRecording: () => void;
  onReplayLastRecording: () => void;
  onExportMidi: () => void;
  onTogglePractice: () => void;
  onToggleEcho: () => void;
}

// B14 (audit) : React.memo — évite les re-renders en cascade quand un état
// voisin change (ex: playbackSeconds à chaque frame de lecture).
const PlaybackControls = memo(function PlaybackControls({
  songs,
  selectedSongId,
  selectedSong,
  isPlaying,
  isRecording,
  isImporting,
  statusReady,
  hasPendingImport,
  practiceActive,
  echoActive,
  lastRecordingId,
  fileInputRef,
  language,
  onSelectSong,
  onToggleFavorite,
  onDeleteSong,
  onPlay,
  onStop,
  onImportFile,
  onToggleRecording,
  onReplayLastRecording,
  onExportMidi,
  onTogglePractice,
  onToggleEcho,
}: PlaybackControlsProps) {
  const { t } = useI18n(language);
  // P3 (audit perf) : tri mémoïsé — sortLibrary était recalculé à chaque
  // render (nouveau tableau à chaque fois, ce qui cassait aussi la
  // mémoïsation des <option> enfants).
  const sortedSongs = useMemo(() => sortLibrary(songs), [songs]);
  return (
    <div className="control-group" aria-label={t("groupPlayback")}>
      <select
        value={selectedSongId}
        onChange={(e) => onSelectSong(e.target.value)}
        // B3 (audit) : désactiver aussi pendant l'echo — changer de morceau
        // en cours de session echo la bloquerait dans un état incohérent.
        disabled={isPlaying || isRecording || echoActive}
      >
        {/* B8 (audit) : tri via sortLibrary (était dupliqué inline). */}
        {sortedSongs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.favorite ? "★ " : ""}
              {s.source === "imported" ? `♪ ${s.title}` : s.title}
            </option>
          ))}
      </select>

      {selectedSong && (
        <button
          className="import-btn"
          onClick={() => onToggleFavorite(selectedSong.id)}
          disabled={isPlaying || echoActive}
          aria-pressed={Boolean(selectedSong.favorite)}
          title={
            selectedSong.favorite
              ? t("removeFavorite")
              : t("addFavorite")
          }
          aria-label={t("toggleFavorite")}
        >
          <StarIcon />
        </button>
      )}
      {selectedSong?.source === "imported" && (
        <button
          className="import-btn delete-song"
          onClick={() => onDeleteSong(selectedSong.id)}
          // B3 (audit) : aussi désactivé pendant l'echo.
          disabled={isPlaying || isImporting || practiceActive || echoActive}
          title={t("deleteSongHint")}
          aria-label={t("deleteSongHint")}
        >
          <TrashIcon />
        </button>
      )}

      {!isPlaying ? (
        <button
          className="play-btn"
          onClick={onPlay}
          disabled={!statusReady || hasPendingImport || practiceActive || echoActive}
        >
          <PlayIcon /> {t("playSong")}
        </button>
      ) : (
        <button className="stop-btn" onClick={onStop}>
          <StopIcon /> {t("stopSong")}
        </button>
      )}

      <button
        className="import-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={isPlaying || isImporting}
      >
        {isImporting ? (
          t("importProgress")
        ) : (
          <>
            <ImportIcon /> {t("import")}
          </>
        )}
      </button>
      <button
        className={`import-btn ${isRecording ? "stop-btn" : ""}`}
        onClick={onToggleRecording}
        // M6 (audit) : l'arrêt d'enregistrement reste possible pendant la
        // lecture — sinon le démarrage de la lecture en plein enregistrement
        // créait une impasse (impossible de sauvegarder le morceau).
        disabled={isImporting || (!isRecording && isPlaying)}
        aria-pressed={isRecording}
        title={isRecording ? t("recordStopHint") : t("recordHint")}
      >
        {isRecording ? t("recordStopBtn") : t("recordStart")}
      </button>
      {/* E10 (audit ergonomie) : toujours visible, désactivé si pas d'enregistrement */}
      <button
        className="import-btn"
        onClick={onReplayLastRecording}
        disabled={!lastRecordingId}
        title={t("replayHint")}
        aria-label={t("replayHint")}
      >
        <PlayIcon /> {t("replayLast")}
      </button>
      <button
        className="import-btn"
        onClick={onExportMidi}
        disabled={isPlaying || !selectedSong}
        title={t("exportMidHint")}
      >
        <ExpandIcon /> {t("exportMid")}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onImportFile(file);
        }}
        style={{ display: "none" }}
      />

      <button
        className="import-btn"
        onClick={onTogglePractice}
        disabled={!statusReady || isPlaying || hasPendingImport}
        aria-pressed={practiceActive}
        title={t("practiceHint")}
      >
        <PracticeIcon />
        {practiceActive ? t("practiceQuitBtn") : t("practiceToggle")}
      </button>
      <button
        className="import-btn"
        onClick={onToggleEcho}
        disabled={!statusReady || isPlaying || hasPendingImport}
        aria-pressed={echoActive}
        title={t("echoHint")}
      >
        {t("echoToggle")}
      </button>
    </div>
  );
});

export default PlaybackControls;
