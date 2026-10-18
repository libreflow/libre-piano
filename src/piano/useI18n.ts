// Hook d'internationalisation (roadmap #82) : langue persistée dans
// l'état principal, détection système au premier lancement.

import { useCallback } from "react";
import { translate, type Language } from "./i18n";

export function useI18n(lang: Language) {
  const t = useCallback((key: string) => translate(lang, key), [lang]);
  return { t, lang };
}
