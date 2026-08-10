import type { z } from "zod";
import { BaseNodeFieldsSchema } from "./shared";

export const FactionSchema = BaseNodeFieldsSchema;
export type Faction = z.infer<typeof FactionSchema>;
