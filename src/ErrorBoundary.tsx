import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// En React 19, une exception non attrapée démonte toute l'arborescence :
// sans boundary, un crash laisse un écran vide (juste le fond CSS).
// On affiche l'erreur pour que le bug soit diagnostiquable.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Libre Piano — erreur de rendu :", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash" role="alert">
          <h2>Une erreur est survenue</h2>
          <p>L'application n'a pas pu démarrer correctement.</p>
          <pre>{this.state.error.message}</pre>
          <p className="app-crash-hint">
            Redémarre l'application. Si le problème persiste, signale-le sur GitHub.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
