import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SettlementSchema } from "../content/schemas/settlement.schema";
import { DistrictSchema } from "../content/schemas/district.schema";
import { PoiSchema } from "../content/schemas/poi.schema";
import { ActorSchema } from "../content/schemas/actor.schema";
import { FactionSchema } from "../content/schemas/faction.schema";
import { EndeavorSchema } from "../content/schemas/endeavor.schema";

// Every real content file under src/content/ must validate against its
// schema — enumerated via import.meta.glob so this scales automatically as
// content grows. Adding a new actor/faction/etc. JSON file gets it covered
// here with zero test changes; schemas.test.ts still owns hand-crafted
// valid/invalid fixture tests for the schema's *shape*, this file only
// checks that real content actually conforms.
const contentGroups: Array<{ label: string; schema: z.ZodType; files: Record<string, unknown> }> = [
  {
    label: "settlements",
    schema: SettlementSchema,
    files: import.meta.glob("../content/settlements/*.json", { eager: true }),
  },
  {
    label: "districts",
    schema: DistrictSchema,
    files: import.meta.glob("../content/districts/*.json", { eager: true }),
  },
  { label: "pois", schema: PoiSchema, files: import.meta.glob("../content/pois/*.json", { eager: true }) },
  { label: "actors", schema: ActorSchema, files: import.meta.glob("../content/actors/*.json", { eager: true }) },
  {
    label: "factions",
    schema: FactionSchema,
    files: import.meta.glob("../content/factions/*.json", { eager: true }),
  },
  {
    label: "endeavors",
    schema: EndeavorSchema,
    files: import.meta.glob("../content/endeavors/*.json", { eager: true }),
  },
];

describe("content integrity: every file under src/content/ validates against its schema", () => {
  for (const group of contentGroups) {
    const entries = Object.entries(group.files);

    it(`src/content/${group.label}/ has at least one file`, () => {
      expect(entries.length).toBeGreaterThan(0);
    });

    for (const [path, module] of entries) {
      it(`${path} validates against the ${group.label} schema`, () => {
        const data = (module as { default: unknown }).default;
        const result = group.schema.safeParse(data);
        expect(result.success, result.success ? "" : JSON.stringify(result.error?.issues, null, 2)).toBe(
          true
        );
      });
    }
  }
});
