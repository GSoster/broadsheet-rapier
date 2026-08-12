import { z } from "zod";
import type { DialogueRequirement } from "../../engine/types";
import { StateCommandSchema } from "../../engine/types";
import { ShiftSchema } from "./shared";

export const DialogueRequirementSchema: z.ZodType<DialogueRequirement> = z.object({
  requiredClues: z.array(z.string()).optional(),
  minActorReputation: z.object({ actorId: z.string(), value: z.number() }).optional(),
  minFactionReputation: z.object({ factionId: z.string(), value: z.number() }).optional(),
  allowedShifts: z.array(ShiftSchema).optional(),
  nodeVisits: z
    .object({ nodeId: z.string().optional(), min: z.number().optional(), max: z.number().optional() })
    .optional(),
});

export const DialogueChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  // Omitted means "this choice ends the conversation" — an author-facing
  // absence, distinct from the nullable `nextNodeId` COMMAND_SELECT_DIALOGUE_CHOICE's
  // payload uses at the command-payload level (see commands.ts).
  nextNodeId: z.string().optional(),
  requires: DialogueRequirementSchema.optional(),
  commands: z.array(StateCommandSchema).default([]),
});
export type DialogueChoice = z.infer<typeof DialogueChoiceSchema>;

export const DialogueNodeSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  text: z.string(),
  choices: z.array(DialogueChoiceSchema).default([]),
});
export type DialogueNode = z.infer<typeof DialogueNodeSchema>;

export const DialogueSchema = z.object({
  id: z.string(),
  startNodeId: z.string(),
  nodes: z.record(z.string(), DialogueNodeSchema),
});
export type Dialogue = z.infer<typeof DialogueSchema>;
