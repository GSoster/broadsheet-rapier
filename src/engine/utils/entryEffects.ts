import type { EntryEffect, PlayerState } from "../types";
import { isNodeUnlocked } from "./isNodeUnlocked";

// EntryEffect itself now lives in ../types (it became directly
// content-authorable via TriggerableSchema/PoiEntryTriggerSchema, so its
// canonical definition moved to the shared engine/content vocabulary — see
// docs/features/feature_triggerable_effects.md). Re-exported here so
// existing call sites (App.tsx) don't need an import-path change.
export type { EntryEffect };

// Generalizes the old one-off triggerPoiEntryEffects/triggerDistrictEntryEffects
// functions into a typed registry, per game-design-spec.md Open Design Gap #9
// ("reasonable once a second real effect type exists, not before" — a
// dialogue auto-trigger is that second type). Pure computation only — the
// executor that turns an effect into a playSound()/dispatchCommand() call
// lives in App.tsx, since only it has dispatchCommand/dialogues in scope.

// Locally-owned minimal shapes, not the real Poi/Endeavor content types —
// src/engine/ never imports src/content/ directly (web-implementation.md §3),
// same pattern as DialogueOverlayNode/NodeInteractionActor. The real loaded
// content objects satisfy these structurally, no cast needed at call sites.
interface EntryEffectPoi {
  id: string;
  onEnter: EntryEffect[];
}

interface EntryEffectDistrict {
  onEnter: EntryEffect[];
}

interface PoiEntryTrigger {
  poiId: string;
  onEnter: EntryEffect[];
}

interface EntryEffectEndeavorPhase {
  onPoiEnter?: PoiEntryTrigger;
}

interface EntryEffectEndeavor {
  id: string;
  isUnlocked: boolean;
  initialPhaseId: string;
  phases: Record<string, EntryEffectEndeavorPhase>;
  onPoiEnter?: PoiEntryTrigger;
}

export function computePoiEntryEffects(
  poi: EntryEffectPoi,
  activeEndeavors: PlayerState["activeEndeavors"],
  endeavorsById: Record<string, EntryEffectEndeavor>,
  unlockedNodes: PlayerState["unlockedNodes"]
): EntryEffect[] {
  const effects: EntryEffect[] = [...poi.onEnter];
  for (const [endeavorId, progress] of Object.entries(activeEndeavors)) {
    const trigger = endeavorsById[endeavorId]?.phases[progress.currentPhaseId]?.onPoiEnter;
    if (trigger && trigger.poiId === poi.id) {
      effects.push(...trigger.onEnter);
    }
  }
  // Auto-starting: only for endeavors NOT yet in activeEndeavors — an
  // endeavor already started (at any phase, including a completed/terminal
  // one, which stays in activeEndeavors forever) is handled by the loop
  // above instead, never both. START_ENDEAVOR is always synthesized from
  // endeavorData itself, never authored in trigger.onEnter — see
  // EndeavorSchema.onPoiEnter's comment for why.
  for (const endeavorData of Object.values(endeavorsById)) {
    if (activeEndeavors[endeavorData.id]) continue;
    const trigger = endeavorData.onPoiEnter;
    if (trigger && trigger.poiId === poi.id && isNodeUnlocked(endeavorData, endeavorData.id, unlockedNodes)) {
      effects.push({ type: "START_ENDEAVOR", endeavorId: endeavorData.id, initialPhaseId: endeavorData.initialPhaseId });
      effects.push(...trigger.onEnter);
    }
  }
  return effects;
}

// Same EntryEffect[] shape as computePoiEntryEffects even though District can
// only ever produce a SOUND effect today in practice (nothing wires a
// district-level DIALOGUE/START_ENDEAVOR trigger yet) — one code path
// instead of two near-duplicates, not a capability District actually
// exercises yet.
export function computeDistrictEntryEffects(district: EntryEffectDistrict): EntryEffect[] {
  return district.onEnter;
}
