import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Locally-owned minimal shape, not the raw NotificationEvent — App.tsx
// resolves content (item names, endeavor titles) into a final display
// string before this component ever sees it (src/engine/ never imports
// src/content/ directly), same pattern as DialogueOverlayNode/
// NodeInteractionActor.
export interface NotificationDisplayItem {
  id: string;
  tone: "gain" | "loss" | "info";
  message: string;
}

export interface NotificationTrayProps {
  notifications: NotificationDisplayItem[];
  onDismiss: (id: string) => void;
}

// Trivially tunable — not derived from any domain rule, just "long enough
// to read, short enough not to linger."
const AUTO_DISMISS_MS = 4500;

const TONE_STYLES: Record<NotificationDisplayItem["tone"], string> = {
  gain: "border-emerald-700 bg-emerald-950/90 text-emerald-100",
  loss: "border-red-800 bg-red-950/90 text-red-100",
  info: "border-indigo-700 bg-indigo-950/90 text-indigo-100",
};

function Toast({ id, tone, message, onDismiss }: NotificationDisplayItem & { onDismiss: (id: string) => void }) {
  // Scoped to this specific toast's lifetime via `key={id}` at the call
  // site — mounting a fresh Toast per id means this effect (and its timer)
  // is independent per notification, not shared/reset by sibling toasts
  // being added or removed.
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "tween", duration: 0.2 }}
      data-tone={tone}
      className={`pointer-events-auto flex w-72 items-start justify-between gap-3 rounded border px-3 py-2 text-sm shadow-lg ${TONE_STYLES[tone]}`}
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="flex-none text-xs uppercase tracking-wide opacity-70 hover:opacity-100"
      >
        &times;
      </button>
    </motion.div>
  );
}

// Always mounted in App.tsx, gated on `notifications` being non-empty —
// same "always-mounted, self/prop-gated" pattern as MinigameOverlay/
// DialogueOverlay, not conditionally rendered by App.tsx's JSX. Deliberately
// NOT a full-screen backdrop like those z-50 overlays: notifications float
// above everything (z-[100], see docs/decisions.md) without blocking
// interaction with the rest of the screen.
export function NotificationTray({ notifications, onDismiss }: NotificationTrayProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {notifications.map((n) => (
          <Toast key={n.id} {...n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
