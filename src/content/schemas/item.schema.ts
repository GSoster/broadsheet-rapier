import { z } from "zod";
import { BaseNodeFieldsSchema, ModifierSourceSchema } from "./shared";

// imageAsset is optional on BaseNodeFieldsSchema (POIs/Actors/etc. can go
// without an image), but items are specifically meant to always have a
// visible representation in inventory UI — overridden here to be required.
export const ItemSchema = BaseNodeFieldsSchema.extend({
  imageAsset: z.string(),
  // Distinguishes items that accumulate as a count (stackable: true) from
  // one-of-a-kind items (stackable: false) — schema-level only for now.
  // Nothing enforces it yet: COMMAND_ADD_ITEM still merges-by-id/sums
  // quantity regardless of this flag (src/engine/store/commands.ts) —
  // there's no second item yet that would expose the difference. See
  // game-design-spec.md's Open Design Gaps.
  stackable: z.boolean(),
}).merge(ModifierSourceSchema);
export type Item = z.infer<typeof ItemSchema>;
