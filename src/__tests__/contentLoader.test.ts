import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loadContent } from "../contentLoader";
import { ItemSchema as RealItemSchema } from "../content/schemas/item.schema";
import validItem from "../content/items/item_rapier.json";

const ItemSchema = z.object({
  id: z.string(),
  tags: z.array(z.string()).default([]),
});

describe("loadContent", () => {
  it("returns the parsed-and-defaulted data on success", () => {
    const result = loadContent(ItemSchema, { id: "item_1" }, "item_1");
    expect(result).toEqual({ id: "item_1", tags: [] });
  });

  it("applies a field's .default() even when the raw data omits it entirely — the exact gap this closes", () => {
    const raw = { id: "item_1" };
    expect("tags" in raw).toBe(false);
    const result = loadContent(ItemSchema, raw, "item_1");
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toEqual([]);
  });

  it("throws a clear, labeled error when the data fails schema validation", () => {
    expect(() => loadContent(ItemSchema, { tags: [] }, "item_bad")).toThrow(/item_bad/);
  });
});

describe("loadContent — ItemSchema.modifiers reachability (content-schema scaling note)", () => {
  // The exact category of bug docs/decisions.md (2026-08-11) documents:
  // DialogueChoiceSchema.commands's .default([]) only applied when data was
  // actually run through .parse()/.safeParse(); App.tsx's raw JSON imports
  // weren't. Using the real ItemSchema and a real fixture (item_rapier.json,
  // which genuinely omits `modifiers`) through the real loadContent function
  // — not a standalone .safeParse() call — proves the same class of gap
  // can't recur here, matching how App.tsx actually loads every Item.
  it("defaults `modifiers` to [] for a real Item fixture that omits it, loaded through loadContent", () => {
    expect("modifiers" in validItem).toBe(false);
    const result = loadContent(RealItemSchema, validItem, "item_rapier");
    expect(Array.isArray(result.modifiers)).toBe(true);
    expect(result.modifiers).toEqual([]);
  });
});
