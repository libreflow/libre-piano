# Plan — Refactorisation de `Piano.tsx`

Objectif : réduire `Piano.tsx` (~1720 lignes) à un composant d'orchestration léger
(~300–400 lignes), sans changer aucun comportement. Uniquement des déplacements
de code, aucune nouvelle fonctionnalité. La roadmap (item 9) avait déjà extrait
les *hooks métier* ; ce plan extrait ce qui reste : composants UI + hooks d'état.

## Principes

- **Une étape = un commit = une PR** (ou une PR par phase). Chaque étape laisse
  la build verte et les 180 tests passants.
- **Pas de rewrite** : déplacement de code à l'identique (copier-coller du JSX
  et des callbacks, props pour les valeurs). Toute « amélioration » spotted en
  route va dans un TODO séparé, pas dans le diff.
- **Filets de sécurité avant le premier déplacement** :
  1. les 180 tests existants (Piano.test.tsx rend tout le composant racine) ;
  2. un test de non-régression du DOM (`Piano.dom.test.tsx`) qui snapshotte
     les rôles/labels de la toolbar et des panneaux (les tests existants
     reposent sur `getByRole`/`getByLabelText`, extraire un composant ne doit
     rien casser) ;
  3. vérification manuelle : import MIDI, lecture, métronome, echo,
     apprentissage, enregistrement (checklist dans la PR finale).

## Découpage cible

```
src/piano/
├── Piano.tsx                  (~350 l.) : orchestration des hooks + composition
├── components/
│   ├── PlaybackControls.tsx   toolbar : morceaux, lecture, import, record
│   ├── SoundControls.tsx      vitesse, métronome, volume, réverbe, EQ, transpose
│   ├── KeyboardControls.tsx   octave + AZERTY/QWERTY
│   ├── SettingsMenu.tsx       menu Paramètres + bouton thème
│   ├── LoopControls.tsx      boucle A-B
│   ├── TrackPicker.tsx       dialogue de sélection des pistes
│   ├── PracticePanel.tsx     panneau apprentissage (stats, session, rapport)
│   ├── EchoPanel.tsx         panneau call & response
│   ├── PianoKeyboard.tsx     clavier 88 touches (blanches/noires, labels)
│   └── StatusOverlays.tsx    loading/error, drag&drop, status message,
│                             paroles + marqueurs de mesures, santé audio
├── hooks/
│   ├── usePianoState.ts      état persisté (loadPersistedState + sanitize) + save
│   ├── useFavorites.ts       favoris builtin/importés + tri de la bibliothèque
│   ├── useFullscreen.ts      état plein écran + toggle (Tauri + events natifs)
│   └── useStatusMessage.ts   message auto-expirant (timeout + ref)
```

(`tone-gate.ts` et les hooks métier existants ne bougent pas.)

## Étapes

### Phase A — Extraire les hooks d'état (risque faible)

- **A1. `useStatusMessage`** : le message auto-expirant (statusMessageRef,
  STATUS_MESSAGE_TIMEOUT_MS). Le plus simple, idéalis le pattern props/return
  pour les suivants.
- **A2. `usePianoState`** : initialState (loadPersistedState), + l'effet de
  persistance (savePersistedState + avertissement quota). Attention : la
  persistance regroupe ~13 états, le hook prend la responsabilité de *save*,
  les setters restent chez le composant (pas de re-render inattendus).
- **A3. `useFavorites`** : builtinFavorites + toggleFavorite + tri de la
  liste (le double `.sort()` du `<select>` déménage dans un `useMemo`).
- **A4. `useFullscreen`** : isFullscreen, listener fullscreenchange, toggle
  (getCurrentWindow de Tauri).

### Phase B — Extraire les composants UI (risque modéré)

Ordre du plus isolé au plus câblé ; chaque composant reçoit valeurs et
callbacks en props (pas de contexte React dans un premier temps — explicite
même si verbeux ; un contexte pourra être introduit plus tard si les props
deviennent ingérables).

- **B1. `PianoKeyboard`** : le bloc `.piano-scroll` (88 touches, keyStateClass,
  labels, pointer handlers). Props : ALL_KEYS, windowKeys, labelMode,
  keyStateClass, handlePointerDown/Up. — Plus gros bloc de JSX, mais
  totalement passif.
- **B2. `StatusOverlays`** : loading, error, drop-overlay, status-message,
  audio-health, paroles + measure-track. Props scalaires.
- **B3. `TrackPicker`** : le dialogue de pistes (déjà un bloc autonome avec
  un seul hook consommé : trackPreview). Props : pendingImport,
  selectedTrackIndices, callbacks.
- **B4. `PracticePanel` + `EchoPanel`** : les deux panneaux role="status".
- **B5. `LoopControls`** : boucle A-B.
- **B6. `SettingsMenu`** : menu Paramètres + theme-toggle (récente refonte UI,
  logique encore fraîche). Props : ~12 toggles/setters.
- **B7. `SoundControls`, `KeyboardControls`, `PlaybackControls`** : le cœur de
  la toolbar, le plus câblé (isPlaying, isRecording, practice, echo,
  pendingImport…). Faire en dernier, quand le pattern est rôdé.

### Phase C — Nettoyage (risque faible)

- **C1.** Mise à jour de `ARCHITECTURE.md` (arborescence, conventions props).
- **C2.** Le test DOM de non-régression (A0) passe de « ajouté » à « conservé » ;
  vérifier qu'il couvre toolbar + menu + panneaux.

## Risques connus

- **Identité des callbacks** : plusieurs handlers sont volontairement
  non-mémorisés (toggleTheme, toggleRecording, handlePointerDown) avec des
  commentaires expliquant pourquoi. En passant par des composants enfants,
  ces callbacks reçoivent de nouvelles identités à chaque render parent →
  re-renders enfants. À surveiller : mesurer avec les tests perf existants
  (perf.test.ts) ; si dégradation, mémoriser au moment du passage en props.
- **`perf.test.ts`** : le benchmark de rendu doit rester dans les seuils —
  c'est le détecteur principal d'une refactorisation qui re-renderait trop.
- **Ordre des effets** : extraire un composant ne change pas l'ordre des
  hooks chez le parent, mais un hook déplacé dans un enfant s'exécute APRÈS
  les effets du parent. Les patterns "adjusting state during render"
  (octaveShift auto en apprentissage, reset practice au changement de
  morceau) doivent rester chez le parent.
- **A11y** : les tests ciblent des rôles/labels (radios QWERTY/AZERTY,
  bouton Paramètres, labels de touches). Un composant qui casse un
  aria-label sera attrapé par les tests — ne pas les affaiblir en route.

## Critères de réussite

- `Piano.tsx` ≤ 400 lignes.
- 180+ tests verts, aucun test supprimé ou affaibli (seuls ajustés s'ils
  ciblaient un détail d'implémentation).
- `perf.test.ts` dans les seuils existants.
- Checklist manuelle passée (lecture, import, métronome, echo, apprentissage,
  enregistrement, plein écran, thème, export config).
- Zéro changement de comportement observable.

## Estimation

- Phase A : 1 session (4 hooks simples).
- Phase B : 2–3 sessions (B1–B4 puis B5–B7).
- Phase C : ½ session.
- Chaque étape livrable indépendamment — peut s'étaler sur plusieurs PR
  sans bloquer la 0.5.0.
