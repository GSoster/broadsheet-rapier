import { z } from "zod";
import { EntryEffectSchema, MODIFIER_KEYS, SHIFTS } from "../../engine/types";

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

// Overlay schema for a locale translation of a BaseNodeFields-derived
// content type (Settlement/District/POI/Faction/Item — all structurally
// identical here). Every field optional: a translation can cover only some
// fields, falling back to the canonical English value for the rest. No `id`
// field — an overlay file's target is its own filename (`<id>.<locale>.json`
// with the suffix stripped), not a field inside it. See
// docs/features/feature_localization.md and src/contentLocalization.ts.
export const BaseNodeTranslatableSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();
export type BaseNodeTranslatable = z.infer<typeof BaseNodeTranslatableSchema>;

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

// A single stat bonus an item grants while owned. See
// docs/features/feature_modifier_system.md §2.5 — targetId narrows the bonus
// to one faction/actor; omitted means untargeted (applies wherever no more
// specific modifier matches, per §2.4's targeting rule).
export const ModifierGrantSchema = z
  .object({
    key: z.enum(MODIFIER_KEYS),
    op: z.enum(["FLAT", "PERCENT"]),
    value: z.number(),
    targetId: z.string().optional(),
  })
  .strict();

// Composable capability fragment, mirroring TriggerableSchema above — an
// Item (or any future content type) merges this in to become a modifier
// source. Owned-gated only this phase; equip-gating is deferred (§2.6/§3.1).
export const ModifierSourceSchema = z.object({
  modifiers: z.array(ModifierGrantSchema).default([]),
});
