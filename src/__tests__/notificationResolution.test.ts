import { describe, expect, it } from "vitest";
import { resolveNotificationMessage } from "../notificationResolution";
import type { NotificationEvent } from "../engine/store/notifications";

const ctx = {
  itemNames: { item_vantry_rapier: "Vantry's Rapier" },
  actorNames: { actor_mara_venn: "Mara Venn" },
  factionNames: { faction_wagering_ring: "The Wagering Ring" },
  endeavorTitles: { endeavor_a_debt_in_steel: "A Debt in Steel" },
};

function event(overrides: Partial<NotificationEvent> & Pick<NotificationEvent, "kind">): NotificationEvent {
  return { id: "n1", timestamp: 0, tone: "gain", ...overrides } as NotificationEvent;
}

describe("resolveNotificationMessage", () => {
  it("formats a CURRENCY event via formatCurrencyDelta", () => {
    const result = resolveNotificationMessage(event({ kind: "CURRENCY", deltaBronze: 60 }), ctx);
    expect(result).toEqual({ id: "n1", tone: "gain", message: "+3 Silver" });
  });

  it("resolves an ITEM event's name via itemNames, with a signed quantity", () => {
    const result = resolveNotificationMessage(
      event({ kind: "ITEM", itemId: "item_vantry_rapier", quantity: 1 }),
      ctx
    );
    expect(result.message).toBe("+1 Vantry's Rapier");
  });

  it("falls back to the raw itemId when it has no resolvable name", () => {
    const result = resolveNotificationMessage(event({ kind: "ITEM", itemId: "item_unknown", quantity: -1 }), ctx);
    expect(result.message).toBe("-1 item_unknown");
  });

  it("resolves a REPUTATION event's actor name", () => {
    const result = resolveNotificationMessage(
      event({ kind: "REPUTATION", targetType: "actor", targetId: "actor_mara_venn", amount: 5 }),
      ctx
    );
    expect(result.message).toBe("Mara Venn reputation +5");
  });

  it("resolves a REPUTATION event's faction name for a loss", () => {
    const result = resolveNotificationMessage(
      event({ tone: "loss", kind: "REPUTATION", targetType: "faction", targetId: "faction_wagering_ring", amount: -10 }),
      ctx
    );
    expect(result.message).toBe("The Wagering Ring reputation -10");
  });

  it("resolves an ENDEAVOR_COMPLETE event's title", () => {
    const result = resolveNotificationMessage(
      event({ tone: "info", kind: "ENDEAVOR_COMPLETE", endeavorId: "endeavor_a_debt_in_steel" }),
      ctx
    );
    expect(result.message).toBe("Completed: A Debt in Steel");
  });
});
