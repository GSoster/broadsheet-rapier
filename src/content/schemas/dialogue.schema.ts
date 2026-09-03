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
  // Explicit, referentially-checked reference to the speaking Actor,
  // preferred over speaker-name matching when present (see
  // docs/features/feature_dialogue_speaker_reference.md). Left unset for a
  // narration-style speaker with no Actor to reference (e.g. "Narration").
  speakerActorId: z.string().optional(),
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

// Overlay schema for a locale translation of a Dialogue — per node, only
// speaker/text; per choice, only text. Choices stay an id-keyed ARRAY
// (mirroring DialogueNodeSchema's own shape, not a Record) so a translator's
// overlay file visually mirrors the canonical English file for easy
// diffing; the merge in contentLocalization.ts matches choices by `id`, not
// array position. See docs/features/feature_localization.md.
export const DialogueTranslatableChoiceSchema = z
  .object({
    id: z.string(),
    text: z.string().optional(),
  })
  .strict();

export const DialogueTranslatableNodeSchema = z
  .object({
    speaker: z.string().optional(),
    text: z.string().optional(),
    choices: z.array(DialogueTranslatableChoiceSchema).optional(),
  })
  .strict();

export const DialogueTranslatableSchema = z
  .object({
    nodes: z.record(z.string(), DialogueTranslatableNodeSchema).optional(),
  })
  .strict();
export type DialogueTranslatable = z.infer<typeof DialogueTranslatableSchema>;
