// Piano : clavier 88 touches (A0 -> C8) affiché avec défilement, et une
// fenêtre de 2 octaves (C3 -> C5) mappée sur le clavier PC — la fenêtre
// pourra être décalée par octaves (roadmap #12).
// Deux dispositions clavier PC supportées : QWERTY (rangée A S D F...) et
// AZERTY (rangée Q S D F..., touches numériques remplacées par é " ').

export type KeyboardLayout = "qwerty" | "azerty";

/** Mode d'affichage des étiquettes sur les touches. */
export type LabelMode = "lettres" | "solfege" | "both" | "none";

export interface PianoKey {
  note: string; // e.g. "C4", "D#3"
  isBlack: boolean;
  /** Touche PC mappée (caractère e.key), undefined hors fenêtre de jeu. */
  keyboardKey?: string;
  label: string; // ce qu'on affiche sur la touche
  /** Numéro MIDI (utile pour positionner/importer). */
  midi: number;
  /** Index de la touche blanche (position dans le rang des blanches). */
  whiteIndex: number;
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Convertit un numéro MIDI en nom de note avec dièses (ex: 61 -> "C#4"). */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = SHARP_NAMES[((midi % 12) + 12) % 12];
  return `${name}${octave}`;
}

/** Convertit un nom de note ("C#4") en numéro MIDI (61), ou null. */
export function noteNameToMidi(note: string): number | null {
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return null;
  const idx = SHARP_NAMES.indexOf(m[1]);
  if (idx < 0) return null;
  return (parseInt(m[2], 10) + 1) * 12 + idx;
}

// Piano 88 touches : A0 (21) -> C8 (108), C4 = 60.
export const MIN_MIDI = 21;
export const MAX_MIDI = 108;

/** Octave de base de la fenêtre de mapping du clavier PC (C3 = 48). */
export const KEY_WINDOW_BASE = 48;

/** Ramène un numéro MIDI hors de la plage du clavier à l'intérieur de
 * celle-ci en le transposant par octaves entières (+/- 12 demi-tons). */
export function clampMidiToKeyboard(midi: number): number {
  let m = midi;
  while (m < MIN_MIDI) m += 12;
  while (m > MAX_MIDI) m -= 12;
  return m;
}

// --- Rendu du clavier complet (88 touches) ---------------------------------

export interface KeyLayout {
  keys: PianoKey[];
  whiteKeyCount: number;
}

const layoutCache = new Map<string, KeyLayout>();

/** Génère les 88 touches (cache par labelMode/keyboardKey : la géométrie
 * est pure, seules les étiquettes PC varient). */
export function getKeyboardLayout(): KeyLayout {
  const cached = layoutCache.get("geometry");
  if (cached) return cached;
  const keys: PianoKey[] = [];
  let whiteIndex = 0;
  for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
    const note = midiToNoteName(midi);
    const isBlack = note.includes("#");
    keys.push({
      note,
      isBlack,
      label: "",
      midi,
      whiteIndex: isBlack ? whiteIndex - 1 : whiteIndex,
    });
    if (!isBlack) whiteIndex += 1;
  }
  const layout = { keys, whiteKeyCount: whiteIndex };
  layoutCache.set("geometry", layout);
  return layout;
}

// --- Fenêtre de jeu au clavier PC (2 octaves ancrées sur KEY_WINDOW_BASE) --

// Position des touches blanches de la fenêtre (ordre physique), avec la
// touche correspondante pour chaque disposition.
const WINDOW_WHITE_KEYS: { offset: number; qwerty: string; azerty: string }[] = [
  { offset: 0, qwerty: "a", azerty: "q" },
  { offset: 2, qwerty: "s", azerty: "s" },
  { offset: 4, qwerty: "d", azerty: "d" },
  { offset: 5, qwerty: "f", azerty: "f" },
  { offset: 7, qwerty: "g", azerty: "g" },
  { offset: 9, qwerty: "h", azerty: "h" },
  { offset: 11, qwerty: "j", azerty: "j" },
  { offset: 12, qwerty: "k", azerty: "k" },
  { offset: 14, qwerty: "l", azerty: "l" },
  { offset: 16, qwerty: ";", azerty: "m" },
  { offset: 17, qwerty: "q", azerty: "a" },
  { offset: 19, qwerty: "w", azerty: "z" },
  { offset: 21, qwerty: "e", azerty: "e" },
  { offset: 23, qwerty: "r", azerty: "r" },
  { offset: 24, qwerty: "t", azerty: "t" },
];

// Touches noires de la fenêtre : offset relatif à KEY_WINDOW_BASE.
const WINDOW_BLACK_KEYS: {
  offset: number;
  qwerty: string;
  azerty: string;
}[] = [
  { offset: 1, qwerty: "z", azerty: "w" },
  { offset: 3, qwerty: "x", azerty: "x" },
  { offset: 6, qwerty: "c", azerty: "c" },
  { offset: 8, qwerty: "v", azerty: "v" },
  { offset: 10, qwerty: "b", azerty: "b" },
  { offset: 13, qwerty: "n", azerty: "n" },
  { offset: 15, qwerty: "m", azerty: "," },
  { offset: 18, qwerty: "2", azerty: "é" },
  { offset: 20, qwerty: "3", azerty: '"' },
  { offset: 22, qwerty: "4", azerty: "'" },
];

function keyLabel(key: string): string {
  const pretty: Record<string, string> = {
    ";": ";",
    ",": ",",
    é: "É",
    '"': '"',
    "'": "'",
  };
  return pretty[key] ?? key.toUpperCase();
}

/** Bornes du décalage d'octave de la fenêtre PC : la fenêtre couvre 2
 * octaves (24 demi-tons) et doit rester dans A0-C8.
 * Base C3 (48) : min -3 (fenêtre C0-C2, couvre les graves A0-B0),
 * max +3 (fenêtre C6-C8). -3 ne descend pas sous A0 car la fenêtre
 * blanche la plus grave jouée est A1 (21+12=33 >= base 12 + 21). */
export const OCTAVE_SHIFT_MIN = -3;
export const OCTAVE_SHIFT_MAX = 3;

/** Map touche PC (e.key minuscule) -> note. La fenêtre de jeu est ancrée
 * sur KEY_WINDOW_BASE + octaveShift*12 : déplaçable par octaves. */
export function getKeyToNote(
  layout: KeyboardLayout,
  octaveShift = 0
): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (offset: number, key: string) => {
    const base = KEY_WINDOW_BASE + octaveShift * 12;
    map[key] = midiToNoteName(base + offset);
  };
  for (const w of WINDOW_WHITE_KEYS)
    add(w.offset, layout === "azerty" ? w.azerty : w.qwerty);
  for (const b of WINDOW_BLACK_KEYS)
    add(b.offset, layout === "azerty" ? b.azerty : b.qwerty);
  return map;
}

/** Toutes les touches de la fenêtre PC avec leur touche clavier
 * (pour afficher les étiquettes), pour un décalage d'octave donné. */
export function getWindowKeyMap(
  layout: KeyboardLayout,
  octaveShift = 0
): Map<string, string> {
  const result = new Map<string, string>(); // note -> label
  const add = (offset: number, key: string) => {
    const base = KEY_WINDOW_BASE + octaveShift * 12;
    result.set(midiToNoteName(base + offset), keyLabel(key));
  };
  for (const w of WINDOW_WHITE_KEYS)
    add(w.offset, layout === "azerty" ? w.azerty : w.qwerty);
  for (const b of WINDOW_BLACK_KEYS)
    add(b.offset, layout === "azerty" ? b.azerty : b.qwerty);
  return result;
}

// Noms de note en notation solfège française (do ré mi fa sol la si).
const SOLFEGE_BY_LETTER: Record<string, string> = {
  C: "Do",
  "C#": "Do#",
  D: "Ré",
  "D#": "Ré#",
  E: "Mi",
  F: "Fa",
  "F#": "Fa#",
  G: "Sol",
  "G#": "Sol#",
  A: "La",
  "A#": "La#",
  B: "Si",
};

/** Convertit un nom de note ("C#4") en nom solfège ("Do#"), sans l'octave :
 * c'est la convention usuelle sur les instruments et méthodes de solfège. */
export function noteToSolfege(note: string): string {
  const match = note.match(/^([A-G]#?)/);
  return match ? (SOLFEGE_BY_LETTER[match[1]] ?? note) : note;
}

/** Meilleur décalage d'octave pour que la fenêtre PC couvre `note`,
 * en restant dans les bornes : minimise le déplacement par rapport à
 * `currentShift`. Retourne null si aucun shift ne couvre la note
 * (impossible sur 88 touches, mais défensif). */
export function getOctaveShiftForNote(note: string, currentShift: number): number | null {
  const midi = noteNameToMidi(note);
  if (midi === null) return null;
  const candidates: number[] = [];
  for (let shift = OCTAVE_SHIFT_MIN; shift <= OCTAVE_SHIFT_MAX; shift++) {
    const base = KEY_WINDOW_BASE + shift * 12;
    if (midi >= base && midi <= base + 24) candidates.push(shift);
  }
  if (candidates.length === 0) return null;
  // le plus proche du shift courant
  return candidates.reduce((best, c) =>
    Math.abs(c - currentShift) < Math.abs(best - currentShift) ? c : best
  );
}

/** Position horizontale d'une note en unités de touche blanche, exacte
 * pour les noires (elles sont décalées d'environ 0.69 touche après la
 * blanche qui les précède, cf. .key.black left dans le CSS).
 * Retourne -1 si la note n'existe pas. */
export function getWhitePositionOfNote(note: string): number {
  const { keys } = getKeyboardLayout();
  const key = keys.find((k) => k.note === note);
  if (!key) return -1;
  return key.isBlack ? key.whiteIndex + 0.69 : key.whiteIndex;
}
