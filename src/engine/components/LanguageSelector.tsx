import { useTranslation } from "react-i18next";
import { useLocaleStore } from "../store/localeStore";
import { LOCALES, type Locale } from "../types";

// Player-facing names for each locale, in that locale's own language (not
// translated per the viewer's current locale — a language picker
// conventionally shows each option in its own tongue, e.g. "Português
// (Brasil)" stays that regardless of whether the UI is currently in
// English or Portuguese).
const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};

// Header/HUD-level control (mounted inside WorldClockHud) — the one and
// only place useLocaleStore.setLocale is called from player interaction.
// Reads/writes useLocaleStore directly; App.tsx's own effect (keyed on the
// same store) is what actually calls i18n.changeLanguage — this component
// only ever sets the preference, never touches i18next directly.
export function LanguageSelector() {
  const { t } = useTranslation();
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  return (
    <select
      aria-label={t("common.language")}
      value={locale}
      onChange={(event) => setLocale(event.target.value as Locale)}
      className="rounded border border-indigo-700 bg-indigo-900/60 px-2 py-1 text-xs font-medium text-indigo-100"
    >
      {LOCALES.map((localeOption) => (
        <option key={localeOption} value={localeOption}>
          {LOCALE_NAMES[localeOption]}
        </option>
      ))}
    </select>
  );
}
