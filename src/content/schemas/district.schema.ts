import { z } from "zod";
import { BaseNodeFieldsSchema, FactionInfluenceSchema, TriggerableSchema } from "./shared";

export const DistrictSchema = BaseNodeFieldsSchema.extend({
  controllingFactionId: z.string().optional(),
  factionInfluence: FactionInfluenceSchema.optional(),
  settlementId: z.string(),
  poiIds: z.array(z.string()),
}).extend(TriggerableSchema.shape);
export type District = z.infer<typeof DistrictSchema>;
