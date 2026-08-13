import { z } from "zod";

export const EndeavorPhaseSchema = z.object({
  id: z.string(),
  objectiveText: z.string(),
  requiredClues: z.array(z.string()).optional(),
  nextPhaseOnSuccess: z.string().optional(),
  unlocksNodesOnComplete: z.array(z.string()),
  // Auto-opens a dialogue when the player enters poiId while this phase is
  // active — see docs/features/feature_dialogue_visibility_and_auto_triggers.md.
  // nodeId omitted means resolveDialogueEntryNodeId's normal resume/start logic.
  autoDialogueOnEnter: z
    .object({
      poiId: z.string(),
      dialogueId: z.string(),
      nodeId: z.string().optional(),
    })
    .strict()
    .optional(),
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
  // then opens dialogueId) when the player enters poiId, for an endeavor
  // not yet in activeEndeavors — autoDialogueOnEnter above only fires for
  // an endeavor already started. Gated on isNodeUnlocked (this endeavor's
  // isUnlocked || unlockedNodes[id]) — see
  // docs/features/feature_node_unlock_rendering.md, a hard dependency.
  autoStartOnEnter: z
    .object({
      poiId: z.string(),
      dialogueId: z.string(),
      nodeId: z.string().optional(),
    })
    .strict()
    .optional(),
});
export type Endeavor = z.infer<typeof EndeavorSchema>;
