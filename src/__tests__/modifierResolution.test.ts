import { describe, expect, it } from "vitest";
import { collectActiveModifiers } from "../modifierResolution";
import type { Item } from "../content/schemas/item.schema";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item_test",
    name: "Test Item",
    description: "A test fixture.",
    isUnlocked: true,
    imageAsset: "/content/assets/images/items/test.jpg",
    stackable: false,
    modifiers: [],
    ...overrides,
  };
}

describe("collectActiveModifiers", () => {
  it("returns an empty set for an empty inventory", () => {
    expect(collectActiveModifiers({ inventory: [] }, {})).toEqual([]);
  });

  it("returns an empty set when owned items grant no modifiers", () => {
    const items = { item_rapier: makeItem({ id: "item_rapier" }) };
    const modifiers = collectActiveModifiers(
      { inventory: [{ itemId: "item_rapier", quantity: 1 }] },
      items
    );
    expect(modifiers).toEqual([]);
  });

  it("collects a modifier from an owned item, stamped with the item's id/name as provenance", () => {
    const items = {
      item_duellists_rapier: makeItem({
        id: "item_duellists_rapier",
        name: "Duellist's Rapier",
        modifiers: [{ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: 3 }],
      }),
    };
    const modifiers = collectActiveModifiers(
      { inventory: [{ itemId: "item_duellists_rapier", quantity: 1 }] },
      items
    );
    expect(modifiers).toEqual([
      {
        key: "DUEL_DAMAGE_DEALT",
        op: "FLAT",
        value: 3,
        targetId: undefined,
        sourceId: "item_duellists_rapier",
        sourceLabel: "Duellist's Rapier",
      },
    ]);
  });

  it("preserves a modifier's targetId", () => {
    const items = {
      item_letter: makeItem({
        id: "item_letter",
        name: "Letter of Introduction",
        modifiers: [
          { key: "REPUTATION_GAIN", op: "PERCENT", value: 0.25, targetId: "faction_city_watch" },
        ],
      }),
    };
    const modifiers = collectActiveModifiers(
      { inventory: [{ itemId: "item_letter", quantity: 1 }] },
      items
    );
    expect(modifiers[0].targetId).toBe("faction_city_watch");
  });

  it("contributes a modifier once regardless of quantity (quantity independence, §2.6)", () => {
    const items = {
      item_pendant: makeItem({
        id: "item_pendant",
        modifiers: [{ key: "CURRENCY_GAIN", op: "PERCENT", value: 0.05 }],
      }),
    };
    const modifiers = collectActiveModifiers(
      { inventory: [{ itemId: "item_pendant", quantity: 5 }] },
      items
    );
    expect(modifiers).toHaveLength(1);
  });

  it("ignores an inventory entry with quantity 0", () => {
    const items = {
      item_pendant: makeItem({
        id: "item_pendant",
        modifiers: [{ key: "CURRENCY_GAIN", op: "PERCENT", value: 0.05 }],
      }),
    };
    const modifiers = collectActiveModifiers(
      { inventory: [{ itemId: "item_pendant", quantity: 0 }] },
      items
    );
    expect(modifiers).toEqual([]);
  });

  it("skips an owned itemId that isn't in the items lookup, rather than throwing", () => {
    const modifiers = collectActiveModifiers(
      { inventory: [{ itemId: "item_unknown", quantity: 1 }] },
      {}
    );
    expect(modifiers).toEqual([]);
  });

  it("aggregates modifiers from multiple owned items", () => {
    const items = {
      item_a: makeItem({ id: "item_a", modifiers: [{ key: "CURRENCY_GAIN", op: "PERCENT", value: 0.05 }] }),
      item_b: makeItem({ id: "item_b", modifiers: [{ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: 3 }] }),
    };
    const modifiers = collectActiveModifiers(
      {
        inventory: [
          { itemId: "item_a", quantity: 1 },
          { itemId: "item_b", quantity: 1 },
        ],
      },
      items
    );
    expect(modifiers).toHaveLength(2);
  });
});
