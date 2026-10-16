// Piano note layout: 2 octaves (C3 -> C5) mapped to the computer keyboard.
// Deux dispositions supportees : QWERTY (rangée A S D F...) et AZERTY
// (rangée Q S D F..., touches numériques remplacées par leurs caracteres
// AZERTY directs é " ' pour éviter Shift).

export type KeyboardLayout = "qwerty" | "azerty";

export interface PianoKey {
  note: string; // e.g. "C4", "D#4"
  isBlack: boolean;
  keyboardKey: string; // character produced by the physical key (e.key)
  label: string; // what we show on the key (the keyboard key, uppercase)
}

// Position des touches blanches (ordre physique de gauche à droite) avec la
// touche correspondante pour chaque disposition.
const WHITE_KEYS: { note: string; qwerty: string; azerty: string }[] = [
  { note: "C3", qwerty: "a", azerty: "q" },
  { note: "D3", qwerty: "s", azerty: "s" },
  { note: "E3", qwerty: "d", azerty: "d" },
  { note: "F3", qwerty: "f", azerty: "f" },
  { note: "G3", qwerty: "g", azerty: "g" },
  { note: "A3", qwerty: "h", azerty: "h" },
  { note: "B3", qwerty: "j", azerty: "j" },
  { note: "C4", qwerty: "k", azerty: "k" },
  { note: "D4", qwerty: "l", azerty: "l" },
  { note: "E4", qwerty: ";", azerty: "m" },
  { note: "F4", qwerty: "q", azerty: "a" },
  { note: "G4", qwerty: "w", azerty: "z" },
  { note: "A4", qwerty: "e", azerty: "e" },
  { note: "B4", qwerty: "r", azerty: "r" },
  { note: "C5", qwerty: "t", azerty: "t" },
];

// Touches noires : afterIndex = index de la touche blanche qui précède.
const BLACK_KEYS: {
  note: string;
  afterIndex: number;
  qwerty: string;
  azerty: string;
}[] = [
  { note: "C#3", afterIndex: 0, qwerty: "z", azerty: "w" },
  { note: "D#3", afterIndex: 1, qwerty: "x", azerty: "x" },
  { note: "F#3", afterIndex: 3, qwerty: "c", azerty: "c" },
  { note: "G#3", afterIndex: 4, qwerty: "v", azerty: "v" },
  { note: "A#3", afterIndex: 5, qwerty: "b", azerty: "b" },
  { note: "C#4", afterIndex: 7, qwerty: "n", azerty: "n" },
  { note: "D#4", afterIndex: 8, qwerty: "m", azerty: "," },
  { note: "F#4", afterIndex: 10, qwerty: "2", azerty: "é" },
  { note: "G#4", afterIndex: 11, qwerty: "3", azerty: '"' },
  { note: "A#4", afterIndex: 12, qwerty: "4", azerty: "'" },
];

export const WHITE_KEY_COUNT = WHITE_KEYS.length;

function keyFor(entry: { qwerty: string; azerty: string }, layout: KeyboardLayout) {
  return layout === "azerty" ? entry.azerty : entry.qwerty;
}

function keyLabel(key: string): string {
  // ";" "," etc. s'affichent mieux en majuscule latine équivalente.
  const pretty: Record<string, string> = {
    ";": ";",
    ",": ",",
    é: "É",
    '"': '"',
    "'": "'",
  };
  return pretty[key] ?? key.toUpperCase();
}

/** Toutes les touches du piano pour une disposition donnée. */
export function getKeys(layout: KeyboardLayout): PianoKey[] {
  return [
    ...WHITE_KEYS.map((k) => ({
      note: k.note,
      isBlack: false,
      keyboardKey: keyFor(k, layout),
      label: keyLabel(keyFor(k, layout)),
    })),
    ...BLACK_KEYS.map((k) => ({
      note: k.note,
      isBlack: true,
      keyboardKey: keyFor(k, layout),
      label: keyLabel(keyFor(k, layout)),
    })),
  ];
}

/** Map touche PC (e.key en minuscule) -> note, pour une disposition. */
export function getKeyToNote(layout: KeyboardLayout): Record<string, string> {
  return Object.fromEntries(getKeys(layout).map((k) => [k.keyboardKey, k.note]));
}

export function whiteKeyIndex(note: string): number {
  return WHITE_KEYS.findIndex((k) => k.note === note);
}

export function blackKeyAfterIndex(note: string): number {
  return BLACK_KEYS.find((k) => k.note === note)!.afterIndex;
}

// Plage de notes couverte par le clavier affiché (en numéros MIDI).
// C3 = 48, C5 = 72 en notation MIDI standard (C4 = 60).
export const MIN_MIDI = 48;
export const MAX_MIDI = 72;

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Convertit un numéro MIDI en nom de note avec dièses (ex: 61 -> "C#4"),
 * pour rester cohérent avec la notation utilisée partout ailleurs
 * (KEYS, les échantillons du sampler, etc. utilisent tous des dièses). */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = SHARP_NAMES[((midi % 12) + 12) % 12];
  return `${name}${octave}`;
}

/** Ramène un numéro MIDI hors de la plage du clavier à l'intérieur de
 * celle-ci en le transposant par octaves entières (+/- 12 demi-tons). */
export function clampMidiToKeyboard(midi: number): number {
  let m = midi;
  while (m < MIN_MIDI) m += 12;
  while (m > MAX_MIDI) m -= 12;
  return m;
}
