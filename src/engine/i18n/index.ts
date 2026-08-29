import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { ptBR } from "./locales/pt-BR";

// Bundled resources, no HTTP backend — only two languages today, no
// lazy-load benefit yet. 'en' is the deliberate default (see
// docs/features/feature_localization.md); no language-detector plugin is
// configured, so nothing auto-switches away from it based on the browser.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "pt-BR": { translation: ptBR },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes; i18next's own escaping isn't needed here.
  },
});

export default i18n;
