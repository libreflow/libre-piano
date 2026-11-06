import { useState } from "react";
import "./App.css";
import Piano from "./piano/Piano";
import { useI18n } from "./piano/useI18n";
import { detectLanguage, type Language } from "./piano/i18n";
import { loadPersistedState } from "./piano/storage";

function App() {
  // E1 (audit ergonomie) : hint traduit. La langue effective est celle
  // de Piano (persistée) — Piano la remonte via onLanguageChange.
  const [language, setLanguage] = useState<Language>(
    () => loadPersistedState().language ?? detectLanguage()
  );
  const { t } = useI18n(language);
  const hint = t("appHint");
  // Le hint contient "Espace" et "Entrée" à mettre en évidence (<strong>).
  const parts = hint.split(/(Espace|Entrée|Space|Enter)/);
  return (
    <main className="container">
      <header className="app-header">
        <img src="logo.svg" alt="Logo Libre Piano" width={44} height={44} />
        <h1>Libre Piano</h1>
      </header>
      <p className="hint">
        {parts.map((part, i) =>
          part === "Espace" || part === "Entrée" || part === "Space" || part === "Enter" ? (
            <strong key={i}>{part}</strong>
          ) : (
            part
          )
        )}
      </p>
      <Piano onLanguageChange={setLanguage} />
    </main>
  );
}

export default App;
