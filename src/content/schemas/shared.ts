import { z } from "zod";
import { EntryEffectSchema, SHIFTS } from "../../engine/types";

export const ShiftSchema = z.enum(SHIFTS);
export type Shift = z.infer<typeof ShiftSchema>;

export const BaseNodeFieldsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  isUnlocked: z.boolean(),
  imageAsset: z.string().optional(),
});
export type BaseNodeFields = z.infer<typeof BaseNodeFieldsSchema>;

export const FactionInfluenceSchema = z.record(z.string(), z.number());

// Unconditional, node-local: effects that fire whenever THIS node itself is
// entered. Composed into District/POI. See docs/features/feature_triggerable_effects.md
// for why this is deliberately NOT the same shape as PoiEntryTriggerSchema
// below — District/POI's trigger condition is implicit ("this node was
// entered"), so a bare effect list is the whole story.
export const TriggerableSchema = z.object({
  onEnter: z.array(EntryEffectSchema).default([]),
});

// Targeted: effects that fire when a SPECIFIC, different POI (poiId) is
// entered while the owning EndeavorPhase/Endeavor is in the relevant runtime
// state (phase active / not-yet-started-and-unlocked respectively). Content
// is static JSON — it can't express "while this phase is active" except by
// having the phase/endeavor own the trigger and name its target. Composed
// into EndeavorPhase.onPoiEnter and Endeavor.onPoiEnter — same shape both
// places, removing what was previously two independently-declared identical
// `.strict()` objects.
export const PoiEntryTriggerSchema = z
  .object({
    poiId: z.string(),
    onEnter: z.array(EntryEffectSchema),
  })
  .strict();
