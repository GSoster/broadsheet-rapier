import { z } from "zod";
import { PoiEntryTriggerSchema } from "./shared";

export const EndeavorPhaseSchema = z.object({
  id: z.string(),
  objectiveText: z.string(),
  requiredClues: z.array(z.string()).optional(),
  nextPhaseOnSuccess: z.string().optional(),
  unlocksNodesOnComplete: z.array(z.string()),
  // Runs onPoiEnter.onEnter (typically a DIALOGUE effect) when the player
  // enters onPoiEnter.poiId while this phase is active — see
  // docs/features/feature_triggerable_effects.md. A DIALOGUE effect's
  // nodeId omitted means resolveDialogueEntryNodeId's normal resume/start logic.
  onPoiEnter: PoiEntryTriggerSchema.optional(),
});
export type EndeavorPhase = z.infer<typeof EndeavorPhaseSchema>;

export const EndeavorSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  isUnlocked: z.boolean(),
  initialPhaseId: z.string(),
  phases: z.record(z.string(), EndeavorPhaseSchema),
  // Auto-starts this endeavor (COMMAND_START_ENDEAVOR with initialPhaseId,
  // then runs onPoiEnter.onEnter) when the player enters onPoiEnter.poiId,
  // for an endeavor not yet in activeEndeavors — EndeavorPhase.onPoiEnter
  // above only fires for an endeavor already started. Gated on
  // isNodeUnlocked (this endeavor's isUnlocked || unlockedNodes[id]) — see
  // docs/features/feature_node_unlock_rendering.md, a hard dependency.
  // Deliberately does NOT let content author a START_ENDEAVOR effect inside
  // onPoiEnter.onEnter itself — the engine always synthesizes it from this
  // same Endeavor's own id/initialPhaseId, avoiding a second, driftable
  // source of truth for values already declared above. See
  // docs/features/feature_triggerable_effects.md.
  onPoiEnter: PoiEntryTriggerSchema.optional(),
});
export type Endeavor = z.infer<typeof EndeavorSchema>;
