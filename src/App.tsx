import "./App.css";
import Piano from "./piano/Piano";

function App() {
  return (
    <main className="container">
      <header className="app-header">
        <img src="logo.svg" alt="Logo Libre Piano" width={44} height={44} />
        <h1>Libre Piano</h1>
      </header>
      <p className="hint">
        Joue avec la souris ou au clavier — maintiens <strong>Espace</strong> pour la
        pédale de sustain, <strong>Entrée</strong> pour la lecture.
      </p>
      <Piano />
    </main>
  );
}

export default App;
