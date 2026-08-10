import { z } from "zod";
import { SHIFTS } from "../../engine/types";

export const ShiftSchema = z.enum(SHIFTS);
export type Shift = z.infer<typeof ShiftSchema>;

export const BaseNodeFieldsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  isUnlocked: z.boolean(),
  imageAsset: z.string().optional(),
});
export type BaseNodeFields = z.infer<typeof BaseNodeFieldsSchema>;

export const FactionInfluenceSchema = z.record(z.string(), z.number());
