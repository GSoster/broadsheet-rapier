import { z } from "zod";
import { BaseNodeFieldsSchema } from "./shared";

export const ActorSchema = BaseNodeFieldsSchema.extend({
  poiId: z.string(),
  factionIds: z.array(z.string()).default([]),
  title: z.string(),
  initialDialogue: z.string(),
});
export type Actor = z.infer<typeof ActorSchema>;
