import Piano from "./piano/Piano";
import "./App.css";

function App() {
  return (
    <main className="container">
      <h1>Libre Piano</h1>
      <p className="hint">
        Joue avec la souris, ou au clavier : touches <strong>A S D F G H J L</strong> ;
        pour les touches noires. Essaie aussi <strong>Z X C V B N M</strong> et{" "}
        <strong>2 3 4</strong>.
      </p>
      <Piano />
    </main>
  );
}

export default App;
