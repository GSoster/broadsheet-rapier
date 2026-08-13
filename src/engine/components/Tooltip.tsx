import type { ReactNode } from "react";

export interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

// Minimal, dependency-free hover/focus tooltip — Tailwind's `group`/
// `group-hover`/`group-focus-within` only, no portal or positioning
// library. The tooltip bubble is always in the DOM (visibility toggled via
// opacity, not mount/unmount) so it's trivially queryable in tests.
// Deliberately small in scope: a short, single-line-ish label anchored
// above its trigger. Not meant for rich content or edge-of-screen
// repositioning — reach for something heavier if a future need outgrows that.
export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={`group relative inline-flex focus-within:z-20 hover:z-20 ${className ?? ""}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded border border-stone-600 bg-stone-950 p-2 text-left text-[11px] normal-case leading-snug text-stone-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
