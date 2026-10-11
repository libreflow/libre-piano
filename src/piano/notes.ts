// Piano note layout: 2 octaves (C3 -> C5) mapped to the computer keyboard,
// like a typical virtual piano app.
export interface PianoKey {
  note: string; // e.g. "C4", "D#4"
  isBlack: boolean;
  keyboardKey: string; // physical computer key that triggers this note
  label: string; // what we show on the key (the keyboard key, uppercase)
}

// White keys row (bottom row of the "home" keyboard area)
const WHITE_KEYS: { note: string; key: string }[] = [
  { note: "C3", key: "a" },
  { note: "D3", key: "s" },
  { note: "E3", key: "d" },
  { note: "F3", key: "f" },
  { note: "G3", key: "g" },
  { note: "A3", key: "h" },
  { note: "B3", key: "j" },
  { note: "C4", key: "k" },
  { note: "D4", key: "l" },
  { note: "E4", key: ";" },
  { note: "F4", key: "q" },
  { note: "G4", key: "w" },
  { note: "A4", key: "e" },
  { note: "B4", key: "r" },
  { note: "C5", key: "t" },
];

// Black keys row (top row), null = no black key after this white key
const BLACK_KEYS: { note: string; key: string; afterIndex: number }[] = [
  { note: "C#3", key: "z", afterIndex: 0 },
  { note: "D#3", key: "x", afterIndex: 1 },
  { note: "F#3", key: "c", afterIndex: 3 },
  { note: "G#3", key: "v", afterIndex: 4 },
  { note: "A#3", key: "b", afterIndex: 5 },
  { note: "C#4", key: "n", afterIndex: 7 },
  { note: "D#4", key: "m", afterIndex: 8 },
  { note: "F#4", key: "2", afterIndex: 10 },
  { note: "G#4", key: "3", afterIndex: 11 },
  { note: "A#4", key: "4", afterIndex: 12 },
];

export const WHITE_KEY_COUNT = WHITE_KEYS.length;

export const KEYS: PianoKey[] = [
  ...WHITE_KEYS.map((k) => ({
    note: k.note,
    isBlack: false,
    keyboardKey: k.key,
    label: k.key.toUpperCase(),
  })),
  ...BLACK_KEYS.map((k) => ({
    note: k.note,
    isBlack: true,
    keyboardKey: k.key,
    label: k.key.toUpperCase(),
  })),
];

export function whiteKeyIndex(note: string): number {
  return WHITE_KEYS.findIndex((k) => k.note === note);
}

export function blackKeyAfterIndex(note: string): number {
  return BLACK_KEYS.find((k) => k.note === note)!.afterIndex;
}

export const KEY_TO_NOTE: Record<string, string> = Object.fromEntries(
  KEYS.map((k) => [k.keyboardKey, k.note])
);

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
