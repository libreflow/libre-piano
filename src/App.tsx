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
        Joue avec la souris ou au clavier : touches <strong>A S D F G H J K L ;</strong>{" "}
        pour les blanches, <strong>Z X C V B N M 2 3 4</strong> pour les noires. Maintiens{" "}
        <strong>Espace</strong> pour la pédale de sustain.
      </p>
      <Piano />
    </main>
  );
}

export default App;
