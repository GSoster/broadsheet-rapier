import { z } from "zod";
import { BaseNodeFieldsSchema, FactionInfluenceSchema } from "./shared";

export const DistrictSchema = BaseNodeFieldsSchema.extend({
  controllingFactionId: z.string().optional(),
  factionInfluence: FactionInfluenceSchema.optional(),
  settlementId: z.string(),
  poiIds: z.array(z.string()),
});
export type District = z.infer<typeof DistrictSchema>;
