import type { ReactElement } from "react";
import type { Locale } from "../types";

// Inline SVG, not emoji or an image asset — deliberately, after emoji flags
// proved unreliable: Windows' bundled emoji font never renders regional-
// indicator flag emoji as a picture (it falls back to the plain two-letter
// text "US"/"BR" in every browser, on every Windows version), and a native
// <select>'s <option> elements can only ever contain plain text anyway, not
// an <img>/<svg>. An inline SVG has no font dependency and renders
// identically on every platform, but can't live inside the dropdown's
// options for the same native-<option> reason — see LanguageSelector.tsx
// for where it's actually placed (next to the select, showing the current
// selection, not inside the popup list).
// Deliberately simplified geometry, not vexillographically exact — small
// enough (~20x14px) that the exact stripe/star count or diamond angle
// wouldn't read anyway; the point is a recognizable, correctly-colored icon.
function UsFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} role="img" aria-label="United States flag">
      <rect width="24" height="16" fill="#B22234" />
      <g fill="#FFFFFF">
        <rect y="1.23" width="24" height="1.23" />
        <rect y="3.69" width="24" height="1.23" />
        <rect y="6.15" width="24" height="1.23" />
        <rect y="8.62" width="24" height="1.23" />
        <rect y="11.08" width="24" height="1.23" />
        <rect y="13.54" width="24" height="1.23" />
      </g>
      <rect width="10" height="8.62" fill="#3C3B6E" />
    </svg>
  );
}

function BrFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} role="img" aria-label="Brazil flag">
      <rect width="24" height="16" fill="#009739" />
      <polygon points="12,2 22,8 12,14 2,8" fill="#FEDD00" />
      <circle cx="12" cy="8" r="3.4" fill="#012169" />
    </svg>
  );
}

const FLAG_COMPONENTS: Record<Locale, (props: { className?: string }) => ReactElement> = {
  en: UsFlag,
  "pt-BR": BrFlag,
};

export function FlagIcon({ locale, className }: { locale: Locale; className?: string }) {
  const Flag = FLAG_COMPONENTS[locale];
  return <Flag className={className} />;
}
