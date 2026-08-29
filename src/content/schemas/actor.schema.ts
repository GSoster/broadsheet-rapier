import { z } from "zod";
import { BaseNodeFieldsSchema, BaseNodeTranslatableSchema } from "./shared";

export const ActorSchema = BaseNodeFieldsSchema.extend({
  poiId: z.string(),
  factionIds: z.array(z.string()).default([]),
  title: z.string(),
  dialogueId: z.string(),
});
export type Actor = z.infer<typeof ActorSchema>;

// Overlay schema for a locale translation of an Actor — BaseNodeTranslatable's
// name/description plus Actor's own displayed `title`. See
// docs/features/feature_localization.md.
export const ActorTranslatableSchema = BaseNodeTranslatableSchema.extend({
  title: z.string().optional(),
});
export type ActorTranslatable = z.infer<typeof ActorTranslatableSchema>;
