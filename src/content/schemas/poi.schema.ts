import { z } from "zod";
import { BaseNodeFieldsSchema, FactionInfluenceSchema, ShiftSchema } from "./shared";

export const PoiSchema = BaseNodeFieldsSchema.extend({
  controllingFactionId: z.string().optional(),
  factionInfluence: FactionInfluenceSchema.optional(),
  districtId: z.string(),
  costShifts: z.number().default(0),
  availableShifts: z.array(ShiftSchema),
  actorIds: z.array(z.string()),
});
export type Poi = z.infer<typeof PoiSchema>;
