import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SettlementSchema } from "../content/schemas/settlement.schema";
import { DistrictSchema } from "../content/schemas/district.schema";
import { PoiSchema } from "../content/schemas/poi.schema";
import { ActorSchema, ActorTranslatableSchema } from "../content/schemas/actor.schema";
import { FactionSchema } from "../content/schemas/faction.schema";
import { EndeavorSchema, EndeavorTranslatableSchema } from "../content/schemas/endeavor.schema";
import { DialogueSchema, DialogueTranslatableSchema } from "../content/schemas/dialogue.schema";
import { ItemSchema } from "../content/schemas/item.schema";
import { BaseNodeTranslatableSchema } from "../content/schemas/shared";
import { LOCALES } from "../engine/types";

// A locale overlay file (e.g. actor_mara_venn.pt-BR.json,
// docs/features/feature_localization.md) sits in the SAME directory as its
// canonical file and also ends in .json, so the canonical globs below must
// exclude it explicitly — validating it against the full canonical schema
// would fail (an overlay deliberately omits required fields). Matches any
// currently-known locale suffix, not just pt-BR, so a future locale doesn't
// need this file touched again.
const LOCALE_SUFFIX_PATTERN = new RegExp(`\\.(${LOCALES.join("|")})\\.json$`);
function isLocaleOverlayPath(path: string): boolean {
  return LOCALE_SUFFIX_PATTERN.test(path);
}
function excludeOverlays(files: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(files).filter(([path]) => !isLocaleOverlayPath(path)));
}
function onlyOverlays(files: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(files).filter(([path]) => isLocaleOverlayPath(path)));
}

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
    files: excludeOverlays(import.meta.glob("../content/settlements/*.json", { eager: true })),
  },
  {
    label: "districts",
    schema: DistrictSchema,
    files: excludeOverlays(import.meta.glob("../content/districts/*.json", { eager: true })),
  },
  {
    label: "pois",
    schema: PoiSchema,
    files: excludeOverlays(import.meta.glob("../content/pois/*.json", { eager: true })),
  },
  {
    label: "actors",
    schema: ActorSchema,
    files: excludeOverlays(import.meta.glob("../content/actors/*.json", { eager: true })),
  },
  {
    label: "factions",
    schema: FactionSchema,
    files: excludeOverlays(import.meta.glob("../content/factions/*.json", { eager: true })),
  },
  {
    label: "endeavors",
    schema: EndeavorSchema,
    files: excludeOverlays(import.meta.glob("../content/endeavors/*.json", { eager: true })),
  },
  {
    label: "dialogues",
    schema: DialogueSchema,
    files: excludeOverlays(import.meta.glob("../content/dialogues/*.json", { eager: true })),
  },
  {
    label: "items",
    schema: ItemSchema,
    files: excludeOverlays(import.meta.glob("../content/items/*.json", { eager: true })),
  },
];

// Parallel groups: every LOCALE OVERLAY file validates against its type's
// translatable-fields schema instead of the full canonical one, and its
// base id (filename with the locale suffix stripped) must resolve to a
// real canonical file — an overlay with a typo'd or orphaned filename fails
// loudly here rather than being silently ignored. Settlement/District/
// POI/Faction/Item share BaseNodeTranslatableSchema (structurally
// identical — just name/description); Actor/Endeavor/Dialogue have their
// own bespoke overlay schemas.
const overlayGroups: Array<{ label: string; schema: z.ZodType; files: Record<string, unknown>; canonicalIds: Set<string> }> = [
  {
    label: "settlements",
    schema: BaseNodeTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/settlements/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
  {
    label: "districts",
    schema: BaseNodeTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/districts/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
  {
    label: "pois",
    schema: BaseNodeTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/pois/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
  {
    label: "actors",
    schema: ActorTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/actors/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
  {
    label: "factions",
    schema: BaseNodeTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/factions/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
  {
    label: "endeavors",
    schema: EndeavorTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/endeavors/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
  {
    label: "dialogues",
    schema: DialogueTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/dialogues/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
  {
    label: "items",
    schema: BaseNodeTranslatableSchema,
    files: onlyOverlays(import.meta.glob("../content/items/*.json", { eager: true })),
    canonicalIds: new Set(),
  },
];
// Backfill each overlay group's canonicalIds from its matching canonical
// group, now that both are built.
for (const overlayGroup of overlayGroups) {
  const canonicalGroup = contentGroups.find((g) => g.label === overlayGroup.label)!;
  for (const module of Object.values(canonicalGroup.files)) {
    overlayGroup.canonicalIds.add((module as { default: { id: string } }).default.id);
  }
}

function overlayBaseId(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return filename.replace(LOCALE_SUFFIX_PATTERN, "");
}

describe("content integrity: locale overlays", () => {
  for (const group of overlayGroups) {
    for (const [path, module] of Object.entries(group.files)) {
      it(`${path} validates against the ${group.label} translatable schema`, () => {
        const data = (module as { default: unknown }).default;
        const result = group.schema.safeParse(data);
        expect(result.success, result.success ? "" : JSON.stringify(result.error?.issues, null, 2)).toBe(true);
      });

      it(`${path}'s base id ("${overlayBaseId(path)}") resolves to a real ${group.label} file`, () => {
        expect(group.canonicalIds.has(overlayBaseId(path))).toBe(true);
      });
    }
  }
});

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
// Scoped deliberately to the relationships called out when each was
// added: Actor.factionIds -> Faction, POI.actorIds -> Actor (+ reverse:
// Actor.poiId), District.poiIds -> POI (+ reverse: POI.districtId),
// Actor.dialogueId -> Dialogue, DialogueNode.speakerActorId -> Actor
// (see docs/features/feature_dialogue_speaker_reference.md). Other
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
const endeavors = loadAll(groupFiles("endeavors"));

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

  describe("DialogueNode.speakerActorId -> Actor", () => {
    for (const dialogue of dialogues) {
      const nodes = dialogue.nodes as Record<string, { speakerActorId?: string }>;
      for (const [key, node] of Object.entries(nodes)) {
        if (node.speakerActorId === undefined) continue; // narration-style node with no Actor to reference
        it(`${dialogue.id}.nodes["${key}"].speakerActorId references an existing actor ("${node.speakerActorId}")`, () => {
          expect(actorIdSet.has(node.speakerActorId as string)).toBe(true);
        });
      }
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

  // A single test, not one `it` per trigger like the blocks above — real
  // content does set EndeavorPhase.onPoiEnter (endeavor_a_debt_in_steel.json,
  // see docs/features/feature_triggerable_effects.md), but the count varies
  // by content and an empty describe/it set from a zero-iteration loop is a
  // Vitest error, not a vacuous pass — so this stays a single always-present
  // test that iterates however many triggers actually exist.
  it("every EndeavorPhase.onPoiEnter reference resolves to real content", () => {
    for (const endeavor of endeavors) {
      const phases = endeavor.phases as Record<
        string,
        { onPoiEnter?: { poiId: string; onEnter: Array<{ type: string; dialogueId?: string }> } }
      >;
      for (const [phaseId, phase] of Object.entries(phases)) {
        const trigger = phase.onPoiEnter;
        if (!trigger) continue;
        expect(poiIdSet.has(trigger.poiId), `${endeavor.id}.phases["${phaseId}"].onPoiEnter.poiId`).toBe(true);
        for (const [i, effect] of trigger.onEnter.entries()) {
          if (effect.type !== "DIALOGUE") continue;
          expect(
            dialogueIdSet.has(effect.dialogueId as string),
            `${endeavor.id}.phases["${phaseId}"].onPoiEnter.onEnter[${i}].dialogueId`
          ).toBe(true);
        }
      }
    }
  });

  // Same reasoning as the onPoiEnter check above.
  it("every Endeavor.onPoiEnter reference resolves to real content", () => {
    for (const endeavor of endeavors) {
      const trigger = endeavor.onPoiEnter as
        | { poiId: string; onEnter: Array<{ type: string; dialogueId?: string }> }
        | undefined;
      if (!trigger) continue;
      expect(poiIdSet.has(trigger.poiId), `${endeavor.id}.onPoiEnter.poiId`).toBe(true);
      for (const [i, effect] of trigger.onEnter.entries()) {
        if (effect.type !== "DIALOGUE") continue;
        expect(dialogueIdSet.has(effect.dialogueId as string), `${endeavor.id}.onPoiEnter.onEnter[${i}].dialogueId`).toBe(
          true
        );
      }
    }
  });
});
