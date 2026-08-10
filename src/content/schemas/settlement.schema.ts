import { z } from "zod";
import { BaseNodeFieldsSchema } from "./shared";

export const SettlementSchema = BaseNodeFieldsSchema.extend({
  districtIds: z.array(z.string()),
});
export type Settlement = z.infer<typeof SettlementSchema>;
