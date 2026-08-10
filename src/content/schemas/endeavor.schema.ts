import { z } from "zod";

export const EndeavorPhaseSchema = z.object({
  id: z.string(),
  objectiveText: z.string(),
  requiredClues: z.array(z.string()).optional(),
  nextPhaseOnSuccess: z.string().optional(),
  unlocksNodesOnComplete: z.array(z.string()),
});
export type EndeavorPhase = z.infer<typeof EndeavorPhaseSchema>;

export const EndeavorSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  isUnlocked: z.boolean(),
  initialPhaseId: z.string(),
  phases: z.record(z.string(), EndeavorPhaseSchema),
});
export type Endeavor = z.infer<typeof EndeavorSchema>;
