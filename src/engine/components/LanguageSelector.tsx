import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "../store/localeStore";
import { LOCALES, type Locale } from "../types";
import { FlagIcon } from "./FlagIcon";

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
//
// A custom button+listbox, not a native <select> — deliberately. A native
// <option> can only ever hold plain text, never an <img>/<svg>, so a flag
// icon can appear on the closed control but never inside the open dropdown
// list itself while <select> is used. This trades away <select>'s built-in
// browser behavior (native platform styling, OS-level touch/keyboard
// handling) for the flag actually showing next to each option, open or
// closed — closes with Escape or a click outside; each option is a real
// <button>, so Tab/Enter/Space already work without extra plumbing.
export function LanguageSelector() {
  const { t } = useTranslation();
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectLocale = (next: Locale) => {
    setLocale(next);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t("common.language")}
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 rounded border border-indigo-700 bg-indigo-900/60 px-2 py-1 text-xs font-medium text-indigo-100 hover:bg-indigo-800"
      >
        <FlagIcon locale={locale} className="h-3.5 w-5 flex-none rounded-sm" />
        <span>{LOCALE_NAMES[locale]}</span>
      </button>
      {isOpen ? (
        // Options are <button role="option">, not <li role="option"> wrapping
        // a separately-clickable <button> — a click dispatched on the <li>
        // wouldn't reach an onClick handler on its own descendant (click
        // events bubble UP to ancestors, never down to children), which
        // would silently break both real clicks landing on the <li>'s own
        // padding and any accessibility-tree query targeting the "option"
        // role. Div/button elements with explicit ARIA roles are a valid,
        // common way to build a listbox without native <select>/<option>.
        <div
          role="listbox"
          aria-label={t("common.language")}
          className="absolute right-0 top-full z-10 mt-1 min-w-full overflow-hidden whitespace-nowrap rounded border border-indigo-700 bg-indigo-950 text-xs text-indigo-100 shadow-lg"
        >
          {LOCALES.map((localeOption) => (
            <button
              key={localeOption}
              type="button"
              role="option"
              aria-selected={localeOption === locale}
              onClick={() => selectLocale(localeOption)}
              className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-indigo-800 ${
                localeOption === locale ? "bg-indigo-900/60" : ""
              }`}
            >
              <FlagIcon locale={localeOption} className="h-3.5 w-5 flex-none rounded-sm" />
              <span>{LOCALE_NAMES[localeOption]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
