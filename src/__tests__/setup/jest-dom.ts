import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
// Side-effect import: initializes the i18next singleton (i18n.use(initReactI18next).init(...))
// once, globally, for every test file — the same guarantee App.tsx's own
// module-scope import gives the real app. Without this, a component test
// that renders something calling useTranslation() without any transitive
// import of src/engine/i18n would see t() return the raw key unresolved
// (react-i18next's fallback when no resources are loaded), not the
// translated string. See docs/features/feature_localization.md.
import "../../engine/i18n";

afterEach(() => {
  cleanup();
});
