// Barre de profils (extrait de Piano.tsx) : sélecteur de profil actif et
// création de profil (roadmap #63). Changer de profil remonte le Piano
// interne (key) — tout l'état (morceaux, préférences, stats) est relu
// depuis la clé du profil.
// E1/E9 (audit ergonomie) : labels visibles + textes traduits.

import { useState } from "react";
import { useI18n } from "../useI18n";
import { detectLanguage } from "../i18n";
import {
  getActiveProfile,
  listProfiles,
  setActiveProfile,
  DEFAULT_PROFILE,
} from "../storage";

interface ProfileBarProps {
  /** Appelé après le changement de profil persisté : remonte Piano (key). */
  onSwitch: (profile: string) => void;
}

const ProfileBar = function ProfileBar({ onSwitch }: ProfileBarProps) {
  const [profile, setProfile] = useState(getActiveProfile);
  const [profiles, setProfiles] = useState(listProfiles);
  const [newProfile, setNewProfile] = useState("");
  const { t } = useI18n(detectLanguage());

  const switchProfile = (next: string) => {
    setActiveProfile(next);
    setProfile(next);
    setProfiles(listProfiles());
    onSwitch(next);
  };

  return (
    <div className="profile-bar">
      {/* E9 : label visible pour le sélecteur de profil */}
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
  );
};

export default ProfileBar;
