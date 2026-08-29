import type { TFunction } from "i18next";
import type { NotificationEvent } from "./engine/store/notifications";
import { formatCurrencyDelta } from "./engine/i18n/formatCurrency";
import type { NotificationDisplayItem } from "./engine/components/NotificationTray";

// Content lookup (resolving a NotificationEvent into player-facing text)
// requires item/actor/faction/endeavor names, which live in src/content/ —
// so, like dialogueResolution.ts, this lives outside src/engine/ rather
// than inside NotificationTray.tsx itself. Only ever called from App.tsx.
// `t` is threaded in (not imported as a module-level singleton) so this
// function reacts to the current locale exactly like every other consumer
// of useTranslation() — App.tsx passes it via useTranslation()'s own `t`.
export interface NotificationResolutionContext {
  itemNames: Record<string, string>;
  actorNames: Record<string, string>;
  factionNames: Record<string, string>;
  endeavorTitles: Record<string, string>;
  t: TFunction;
}

export function resolveNotificationMessage(
  event: NotificationEvent,
  ctx: NotificationResolutionContext
): NotificationDisplayItem {
  switch (event.kind) {
    case "CURRENCY":
      return { id: event.id, tone: event.tone, message: formatCurrencyDelta(event.deltaBronze, ctx.t) };
    case "ITEM": {
      // Falls back to the raw id if the lookup ever misses — a genuinely
      // different concern from a content field being un-defaulted
      // (web-implementation.md's Content Loading section), the same class
      // of defensive fallback NodeInteractionCanvas's actor lookups use.
      const name = ctx.itemNames[event.itemId] ?? event.itemId;
      const sign = event.quantity > 0 ? "+" : "";
      return { id: event.id, tone: event.tone, message: `${sign}${event.quantity} ${name}` };
    }
    case "REPUTATION": {
      const names = event.targetType === "actor" ? ctx.actorNames : ctx.factionNames;
      const name = names[event.targetId] ?? event.targetId;
      const sign = event.amount > 0 ? "+" : "";
      return {
        id: event.id,
        tone: event.tone,
        message: ctx.t("notifications.reputationDelta", { name, sign, amount: event.amount }),
      };
    }
    case "ENDEAVOR_COMPLETE": {
      const title = ctx.endeavorTitles[event.endeavorId] ?? event.endeavorId;
      return { id: event.id, tone: event.tone, message: ctx.t("notifications.completed", { title }) };
    }
  }
}
