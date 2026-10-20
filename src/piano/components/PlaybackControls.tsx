// Groupe « Lecture » de la toolbar (refactor Phase B7) : sélection de
// morceau, favoris, lecture/arrêt, import, enregistrement, modes.

import { memo } from "react";
import type { RefObject } from "react";
import type { Song } from "../songs";
import { sortLibrary } from "../hooks/useFavorites";
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
  return (
    <div className="control-group" aria-label="Lecture">
      <select
        value={selectedSongId}
        onChange={(e) => onSelectSong(e.target.value)}
        // B3 (audit) : désactiver aussi pendant l'echo — changer de morceau
        // en cours de session echo la bloquerait dans un état incohérent.
        disabled={isPlaying || isRecording || echoActive}
      >
        {/* B8 (audit) : tri via sortLibrary (était dupliqué inline). */}
        {sortLibrary(songs).map((s) => (
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
          onClick={() => onDeleteSong(selectedSong.id)}
          // B3 (audit) : aussi désactivé pendant l'echo.
          disabled={isPlaying || isImporting || practiceActive || echoActive}
          title="Supprimer ce morceau importé"
          aria-label="Supprimer ce morceau importé"
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
          <PlayIcon /> Lecture
        </button>
      ) : (
        <button className="stop-btn" onClick={onStop}>
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
        className={`import-btn ${isRecording ? "stop-btn" : ""}`}
        onClick={onToggleRecording}
        disabled={isPlaying || isImporting}
        aria-pressed={isRecording}
        title={
          isRecording
            ? "Arrêter l'enregistrement et sauvegarder dans la bibliothèque"
            : "Enregistrer ce que tu joues"
        }
      >
        {isRecording ? "■ Stopper" : "● Enregistrer"}
      </button>
      {lastRecordingId && (
        <button
          className="import-btn"
          onClick={onReplayLastRecording}
          title="Rejouer le dernier enregistrement (le sélectionne)"
          aria-label="Rejouer le dernier enregistrement"
        >
          <PlayIcon /> Replay
        </button>
      )}
      <button
        className="import-btn"
        onClick={onExportMidi}
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
          if (file) onImportFile(file);
        }}
        style={{ display: "none" }}
      />

      <button
        className="import-btn"
        onClick={onTogglePractice}
        disabled={!statusReady || isPlaying || hasPendingImport}
        aria-pressed={practiceActive}
        title="Mode apprentissage : joue la note attendue pour avancer"
      >
        <PracticeIcon />
        {practiceActive ? "Quitter apprentissage" : "Apprentissage"}
      </button>
      <button
        className="import-btn"
        onClick={onToggleEcho}
        disabled={!statusReady || isPlaying || hasPendingImport}
        aria-pressed={echoActive}
        title="Mode echo : l'app joue une phrase, rejoue-la (roadmap #43)"
      >
        ♪ Echo
      </button>
    </div>
  );
});

export default PlaybackControls;
