import type { PlayerState } from "../types";
import { currenciesToBronzeEquivalent } from "./commands";

export type NotificationTone = "gain" | "loss" | "info";

export type NotificationEvent =
  | { id: string; timestamp: number; tone: "gain" | "loss"; kind: "CURRENCY"; deltaBronze: number }
  | { id: string; timestamp: number; tone: "gain" | "loss"; kind: "ITEM"; itemId: string; quantity: number }
  | {
      id: string;
      timestamp: number;
      tone: "gain" | "loss";
      kind: "REPUTATION";
      targetType: "actor" | "faction";
      targetId: string;
      amount: number;
    }
  | { id: string; timestamp: number; tone: "info"; kind: "ENDEAVOR_COMPLETE"; endeavorId: string };

// A plain `Omit<NotificationEvent, "id" | "timestamp">` doesn't distribute
// over the union — it collapses to the shared-fields shape first, which
// would lose each branch's own discriminated fields (deltaBronze, itemId,
// etc.). `T extends unknown` with T naked in a generic conditional type is
// what actually triggers per-union-member distribution in TypeScript.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type RawNotificationEvent = DistributiveOmit<NotificationEvent, "id" | "timestamp">;

function diffCurrency(before: PlayerState, after: PlayerState): RawNotificationEvent[] {
  const deltaBronze = currenciesToBronzeEquivalent(after.currencies) - currenciesToBronzeEquivalent(before.currencies);
  if (deltaBronze === 0) return [];
  return [{ tone: deltaBronze > 0 ? "gain" : "loss", kind: "CURRENCY", deltaBronze }];
}

function toQuantityMap(inventory: PlayerState["inventory"]): Map<string, number> {
  return new Map(inventory.map((item) => [item.itemId, item.quantity]));
}

function diffItems(before: PlayerState, after: PlayerState): RawNotificationEvent[] {
  const beforeMap = toQuantityMap(before.inventory);
  const afterMap = toQuantityMap(after.inventory);
  const itemIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const events: RawNotificationEvent[] = [];
  for (const itemId of itemIds) {
    const delta = (afterMap.get(itemId) ?? 0) - (beforeMap.get(itemId) ?? 0);
    if (delta === 0) continue;
    events.push({ tone: delta > 0 ? "gain" : "loss", kind: "ITEM", itemId, quantity: delta });
  }
  return events;
}

function diffReputationBucket(
  targetType: "actor" | "faction",
  before: Record<string, number>,
  after: Record<string, number>
): RawNotificationEvent[] {
  const targetIds = new Set([...Object.keys(before), ...Object.keys(after)]);
  const events: RawNotificationEvent[] = [];
  for (const targetId of targetIds) {
    const delta = (after[targetId] ?? 0) - (before[targetId] ?? 0);
    if (delta === 0) continue;
    events.push({ tone: delta > 0 ? "gain" : "loss", kind: "REPUTATION", targetType, targetId, amount: delta });
  }
  return events;
}

function diffReputation(before: PlayerState, after: PlayerState): RawNotificationEvent[] {
  return [
    ...diffReputationBucket("actor", before.reputation.actors, after.reputation.actors),
    ...diffReputationBucket("faction", before.reputation.factions, after.reputation.factions),
  ];
}

// Pure diff: compares two PlayerState snapshots and returns zero or more raw
// notification events (no id/timestamp — assigned by the caller, keeping
// this function a plain, easily-testable comparison with no side effects
// and no notion of "now"). Endeavor completion is deliberately NOT covered
// here — it's a content fact (a phase having no nextPhaseOnSuccess) that
// src/engine/ may never read; see App.tsx's separate reactive effect and
// docs/features/feature_notification_system.md's Design section.
export function diffForNotifications(before: PlayerState, after: PlayerState): RawNotificationEvent[] {
  return [...diffCurrency(before, after), ...diffItems(before, after), ...diffReputation(before, after)];
}

let notificationIdCounter = 0;

export function toNotificationEvent(raw: RawNotificationEvent): NotificationEvent {
  notificationIdCounter += 1;
  return { ...raw, id: `notification_${notificationIdCounter}`, timestamp: Date.now() } as NotificationEvent;
}
