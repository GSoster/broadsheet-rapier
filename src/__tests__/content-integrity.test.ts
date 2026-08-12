import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SettlementSchema } from "../content/schemas/settlement.schema";
import { DistrictSchema } from "../content/schemas/district.schema";
import { PoiSchema } from "../content/schemas/poi.schema";
import { ActorSchema } from "../content/schemas/actor.schema";
import { FactionSchema } from "../content/schemas/faction.schema";
import { EndeavorSchema } from "../content/schemas/endeavor.schema";
import { DialogueSchema } from "../content/schemas/dialogue.schema";

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
  {
    label: "dialogues",
    schema: DialogueSchema,
    files: import.meta.glob("../content/dialogues/*.json", { eager: true }),
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

// Referential integrity: do cross-references between content files actually
// resolve? This catches *broken references* automatically (a typo'd id, a
// deleted file nothing else was updated for) — it does NOT catch
// attribute-level drift, like a title/description going stale after a
// related field changes elsewhere (see docs/feature-workflow.md's Category C
// for why that still needs a manual consistency sweep, not an automated
// check).
//
// Scoped deliberately to the three relationships called out when this was
// added: Actor.factionIds -> Faction, POI.actorIds -> Actor (+ reverse:
// Actor.poiId), District.poiIds -> POI (+ reverse: POI.districtId). Other
// reference-shaped fields (controllingFactionId, factionInfluence keys,
// District.settlementId, Endeavor.unlocksNodesOnComplete) are equally
// checkable in principle but intentionally out of scope for this pass —
// noted here so the gap is explicit, not silently assumed covered.
function loadAll(files: Record<string, unknown>): Array<Record<string, unknown>> {
  return Object.values(files).map((module) => (module as { default: Record<string, unknown> }).default);
}

function groupFiles(label: string): Record<string, unknown> {
  return contentGroups.find((group) => group.label === label)!.files;
}

const districts = loadAll(groupFiles("districts"));
const pois = loadAll(groupFiles("pois"));
const actors = loadAll(groupFiles("actors"));
const factions = loadAll(groupFiles("factions"));
const dialogues = loadAll(groupFiles("dialogues"));

const factionIdSet = new Set(factions.map((faction) => faction.id as string));
const actorIdSet = new Set(actors.map((actor) => actor.id as string));
const poiIdSet = new Set(pois.map((poi) => poi.id as string));
const dialogueIdSet = new Set(dialogues.map((dialogue) => dialogue.id as string));

describe("content integrity: referential integrity", () => {
  describe("Actor.factionIds -> Faction", () => {
    for (const actor of actors) {
      const factionIds = (actor.factionIds as string[] | undefined) ?? [];
      for (const factionId of factionIds) {
        it(`${actor.id}.factionIds references an existing faction ("${factionId}")`, () => {
          expect(factionIdSet.has(factionId)).toBe(true);
        });
      }
    }
  });

  describe("POI.actorIds -> Actor, and the reverse (Actor.poiId)", () => {
    for (const poi of pois) {
      const actorIds = (poi.actorIds as string[] | undefined) ?? [];
      for (const actorId of actorIds) {
        it(`${poi.id}.actorIds references an existing actor ("${actorId}")`, () => {
          expect(actorIdSet.has(actorId)).toBe(true);
        });

        it(`actor "${actorId}" (listed at ${poi.id}) has poiId pointing back to ${poi.id}`, () => {
          const actor = actors.find((candidate) => candidate.id === actorId);
          expect(actor?.poiId).toBe(poi.id);
        });
      }
    }
  });

  describe("District.poiIds -> POI, and the reverse (POI.districtId)", () => {
    for (const district of districts) {
      const poiIds = (district.poiIds as string[] | undefined) ?? [];
      for (const poiId of poiIds) {
        it(`${district.id}.poiIds references an existing poi ("${poiId}")`, () => {
          expect(poiIdSet.has(poiId)).toBe(true);
        });

        it(`poi "${poiId}" (listed at ${district.id}) has districtId pointing back to ${district.id}`, () => {
          const poi = pois.find((candidate) => candidate.id === poiId);
          expect(poi?.districtId).toBe(district.id);
        });
      }
    }
  });

  describe("Actor.dialogueId -> Dialogue", () => {
    for (const actor of actors) {
      const dialogueId = actor.dialogueId as string;
      it(`${actor.id}.dialogueId references an existing dialogue ("${dialogueId}")`, () => {
        expect(dialogueIdSet.has(dialogueId)).toBe(true);
      });
    }
  });

  describe("Dialogue node id consistency and node references", () => {
    for (const dialogue of dialogues) {
      const nodes = dialogue.nodes as Record<string, { id: string; choices?: Array<{ nextNodeId?: string }> }>;
      const nodeKeys = new Set(Object.keys(nodes));

      for (const [key, node] of Object.entries(nodes)) {
        it(`${dialogue.id}.nodes["${key}"].id matches its own key`, () => {
          expect(node.id).toBe(key);
        });
      }

      it(`${dialogue.id}.startNodeId ("${dialogue.startNodeId}") resolves to a real node`, () => {
        expect(nodeKeys.has(dialogue.startNodeId as string)).toBe(true);
      });

      for (const [key, node] of Object.entries(nodes)) {
        for (const choice of node.choices ?? []) {
          if (choice.nextNodeId === undefined) continue; // omitted = ends the conversation, not a reference
          it(`${dialogue.id}.nodes["${key}"] choice references an existing node ("${choice.nextNodeId}")`, () => {
            expect(nodeKeys.has(choice.nextNodeId as string)).toBe(true);
          });
        }
      }
    }
  });
});
