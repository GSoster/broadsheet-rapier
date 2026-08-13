import type { PlayerState } from "../types";
import { isNodeUnlocked } from "./isNodeUnlocked";

// Generalizes the old one-off triggerPoiEntryEffects/triggerDistrictEntryEffects
// functions into a typed registry, per game-design-spec.md Open Design Gap #9
// ("reasonable once a second real effect type exists, not before" — a
// dialogue auto-trigger is that second type). Pure computation only — the
// executor that turns an effect into a playSound()/dispatchCommand() call
// lives in App.tsx, since only it has dispatchCommand/dialogues in scope.
export type EntryEffect =
  | { type: "SOUND"; asset: string }
  | { type: "DIALOGUE"; dialogueId: string; nodeId?: string }
  | { type: "START_ENDEAVOR"; endeavorId: string; initialPhaseId: string };

// Locally-owned minimal shapes, not the real Poi/Endeavor content types —
// src/engine/ never imports src/content/ directly (web-implementation.md §3),
// same pattern as DialogueOverlayNode/NodeInteractionActor. The real loaded
// content objects satisfy these structurally, no cast needed at call sites.
interface EntryEffectPoi {
  id: string;
  entrySoundAsset?: string;
}

interface EntryEffectDistrict {
  entrySoundAsset?: string;
}

interface EntryEffectEndeavorPhase {
  autoDialogueOnEnter?: { poiId: string; dialogueId: string; nodeId?: string };
}

interface EntryEffectEndeavor {
  id: string;
  isUnlocked: boolean;
  initialPhaseId: string;
  phases: Record<string, EntryEffectEndeavorPhase>;
  autoStartOnEnter?: { poiId: string; dialogueId: string; nodeId?: string };
}

export function computePoiEntryEffects(
  poi: EntryEffectPoi,
  activeEndeavors: PlayerState["activeEndeavors"],
  endeavorsById: Record<string, EntryEffectEndeavor>,
  unlockedNodes: PlayerState["unlockedNodes"]
): EntryEffect[] {
  const effects: EntryEffect[] = [];
  if (poi.entrySoundAsset) {
    effects.push({ type: "SOUND", asset: poi.entrySoundAsset });
  }
  for (const [endeavorId, progress] of Object.entries(activeEndeavors)) {
    const trigger = endeavorsById[endeavorId]?.phases[progress.currentPhaseId]?.autoDialogueOnEnter;
    if (trigger && trigger.poiId === poi.id) {
      effects.push({ type: "DIALOGUE", dialogueId: trigger.dialogueId, nodeId: trigger.nodeId });
    }
  }
  // Auto-starting: only for endeavors NOT yet in activeEndeavors — an
  // endeavor already started (at any phase, including a completed/terminal
  // one, which stays in activeEndeavors forever) is handled by the loop
  // above instead, never both.
  for (const endeavorData of Object.values(endeavorsById)) {
    if (activeEndeavors[endeavorData.id]) continue;
    const trigger = endeavorData.autoStartOnEnter;
    if (trigger && trigger.poiId === poi.id && isNodeUnlocked(endeavorData, endeavorData.id, unlockedNodes)) {
      effects.push({ type: "START_ENDEAVOR", endeavorId: endeavorData.id, initialPhaseId: endeavorData.initialPhaseId });
      effects.push({ type: "DIALOGUE", dialogueId: trigger.dialogueId, nodeId: trigger.nodeId });
    }
  }
  return effects;
}

// Same EntryEffect[] shape as computePoiEntryEffects even though District can
// only ever produce a SOUND effect today (autoDialogueOnEnter is POI-scoped)
// — one code path instead of two near-duplicates, not a capability District
// actually has yet.
export function computeDistrictEntryEffects(district: EntryEffectDistrict): EntryEffect[] {
  return district.entrySoundAsset ? [{ type: "SOUND", asset: district.entrySoundAsset }] : [];
}
