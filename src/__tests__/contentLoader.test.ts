import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loadContent } from "../contentLoader";

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
