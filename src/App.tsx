import "./App.css";
import Piano from "./piano/Piano";
import { useI18n } from "./piano/useI18n";
import { detectLanguage } from "./piano/i18n";

function App() {
  // E1 (audit ergonomie) : hint traduit. La langue effective est celle de
  // Piano (persistée) — on détecte ici pour le premier rendu avant le mount.
  const { t } = useI18n(detectLanguage());
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
      <Piano />
    </main>
  );
}

export default App;
