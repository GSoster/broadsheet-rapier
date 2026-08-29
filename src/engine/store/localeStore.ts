import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "../types";

// A second, wholly independent Zustand store — deliberately NOT a field on
// PlayerState/usePlayerStore. Locale is a device/browser-local UI
// preference, not game progress: it must never travel with an
// exported/imported save file, and must never be affected by
// resetProgress. 'en' is the deliberate default (see
// docs/features/feature_localization.md's Open Questions) — no
// navigator.language auto-detection.
interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "broadsheet_rapier_locale",
    }
  )
);
