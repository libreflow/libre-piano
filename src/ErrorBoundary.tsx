import { Component, ErrorInfo, ReactNode } from "react";
import { detectLanguage, translate } from "./piano/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
}

// En React 19, une exception non attrapée démonte toute l'arborescence :
// sans boundary, un crash laisse un écran vide (juste le fond CSS).
// On affiche l'erreur pour que le bug soit diagnostiquable.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Libre Piano — erreur de rendu :", error, info);
  }

  render() {
    if (this.state.error) {
      // E1 (audit ergonomie) : l'écran de crash est traduit (langue détectée
      // au rendu — le boundary est hors de l'arbre React traduit).
      const lang = detectLanguage();
      return (
        <div className="app-crash" role="alert">
          <h2>{translate(lang, "crashTitle")}</h2>
          <p>{translate(lang, "crashBody")}</p>
          <pre>{this.state.error.message}</pre>
          <p className="app-crash-hint">{translate(lang, "crashHint")}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
