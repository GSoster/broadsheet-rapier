import { describe, expect, it } from "vitest";
import {
  loadLocalizedContent,
  mergeActorTranslatable,
  mergeBaseNodeTranslatable,
  mergeDialogueTranslatable,
  mergeEndeavorTranslatable,
} from "../contentLocalization";
import { ActorSchema, ActorTranslatableSchema } from "../content/schemas/actor.schema";
import { DialogueSchema, DialogueTranslatableSchema } from "../content/schemas/dialogue.schema";
import type { Actor } from "../content/schemas/actor.schema";
import type { Dialogue } from "../content/schemas/dialogue.schema";
import type { Endeavor } from "../content/schemas/endeavor.schema";

describe("mergeBaseNodeTranslatable", () => {
  const canonical = { name: "The Crooked Hour", description: "A tavern.", id: "poi_x" };

  it("substitutes an overlay field that's present", () => {
    const result = mergeBaseNodeTranslatable(canonical, { name: "A Hora Torta" });
    expect(result).toEqual({ ...canonical, name: "A Hora Torta" });
  });

  it("falls back to canonical for a field the overlay omits", () => {
    const result = mergeBaseNodeTranslatable(canonical, { description: "Uma taverna." });
    expect(result.name).toBe("The Crooked Hour");
    expect(result.description).toBe("Uma taverna.");
  });

  it("is a pure pass-through when no overlay is supplied", () => {
    expect(mergeBaseNodeTranslatable(canonical, undefined)).toEqual(canonical);
  });

  it("is a pure pass-through for an overlay with every field omitted", () => {
    expect(mergeBaseNodeTranslatable(canonical, {})).toEqual(canonical);
  });
});

describe("mergeActorTranslatable", () => {
  const canonical: Actor = {
    id: "actor_mara_venn",
    name: "Mara Venn",
    description: "A fixture at the tavern.",
    isUnlocked: true,
    poiId: "poi_crooked_hour_tavern",
    factionIds: ["faction_wagering_ring"],
    title: "Wagering Ring Regular",
    dialogueId: "dialogue_mara_venn",
  };

  it("translates description and title while leaving name (a proper noun) untouched when the overlay omits it", () => {
    const result = mergeActorTranslatable(canonical, {
      description: "Uma presença fixa na taverna.",
      title: "Frequentadora do Círculo das Apostas",
    });
    expect(result.name).toBe("Mara Venn");
    expect(result.description).toBe("Uma presença fixa na taverna.");
    expect(result.title).toBe("Frequentadora do Círculo das Apostas");
    // Mechanical fields are never touched by a translation merge.
    expect(result.poiId).toBe(canonical.poiId);
    expect(result.factionIds).toEqual(canonical.factionIds);
    expect(result.dialogueId).toBe(canonical.dialogueId);
  });

  it("is a pure pass-through with no overlay", () => {
    expect(mergeActorTranslatable(canonical, undefined)).toEqual(canonical);
  });
});

describe("mergeEndeavorTranslatable", () => {
  const canonical: Endeavor = {
    id: "endeavor_test",
    title: "The Missing Broadsheet",
    description: "A vanished press.",
    isUnlocked: true,
    initialPhaseId: "phase_ask_around",
    phases: {
      phase_ask_around: {
        id: "phase_ask_around",
        objectiveText: "Ask around town.",
        unlocksNodesOnComplete: [],
      },
    },
  };

  it("translates title/description and a phase's objectiveText by phase id", () => {
    const result = mergeEndeavorTranslatable(canonical, {
      title: "O Panfleto Desaparecido",
      phases: { phase_ask_around: { objectiveText: "Pergunte pela cidade." } },
    });
    expect(result.title).toBe("O Panfleto Desaparecido");
    expect(result.description).toBe(canonical.description);
    expect(result.phases.phase_ask_around.objectiveText).toBe("Pergunte pela cidade.");
    // Mechanical phase fields untouched.
    expect(result.phases.phase_ask_around.unlocksNodesOnComplete).toEqual([]);
  });

  it("silently skips an overlay phase id with no canonical match, rather than throwing", () => {
    const result = mergeEndeavorTranslatable(canonical, {
      phases: { phase_does_not_exist: { objectiveText: "..." } },
    });
    expect(result.phases).toEqual(canonical.phases);
  });

  it("is a pure pass-through with no overlay", () => {
    expect(mergeEndeavorTranslatable(canonical, undefined)).toEqual(canonical);
  });
});

describe("mergeDialogueTranslatable", () => {
  const canonical: Dialogue = {
    id: "dialogue_test",
    startNodeId: "node_greeting",
    nodes: {
      node_greeting: {
        id: "node_greeting",
        speaker: "Mara Venn",
        text: "Another broadsheet gone quiet.",
        choices: [
          { id: "choice_a", text: "What do you know?", commands: [] },
          { id: "choice_b", text: "Never mind.", commands: [] },
        ],
      },
    },
  };

  it("translates node text and matches choice overlays by id, not array position", () => {
    const result = mergeDialogueTranslatable(canonical, {
      nodes: {
        node_greeting: {
          text: "Mais um panfleto silenciado.",
          // Deliberately reversed order and a subset (choice_a omitted) —
          // proving the match is by id, not position, and partial overlays
          // don't drop the untranslated choice.
          choices: [{ id: "choice_b", text: "Deixa pra lá." }],
        },
      },
    });
    const node = result.nodes.node_greeting;
    expect(node.text).toBe("Mais um panfleto silenciado.");
    expect(node.speaker).toBe("Mara Venn"); // untouched — proper noun, overlay omitted it
    expect(node.choices.find((c) => c.id === "choice_a")?.text).toBe("What do you know?");
    expect(node.choices.find((c) => c.id === "choice_b")?.text).toBe("Deixa pra lá.");
  });

  it("silently skips an overlay node id with no canonical match, rather than throwing", () => {
    const result = mergeDialogueTranslatable(canonical, {
      nodes: { node_does_not_exist: { text: "..." } },
    });
    expect(result.nodes).toEqual(canonical.nodes);
  });

  it("is a pure pass-through with no overlay, and with an overlay that has no nodes field", () => {
    expect(mergeDialogueTranslatable(canonical, undefined)).toEqual(canonical);
    expect(mergeDialogueTranslatable(canonical, {})).toEqual(canonical);
  });
});

describe("loadLocalizedContent", () => {
  const actorRaw = {
    id: "actor_mara_venn",
    name: "Mara Venn",
    description: "A fixture at the tavern.",
    isUnlocked: true,
    poiId: "poi_crooked_hour_tavern",
    factionIds: ["faction_wagering_ring"],
    title: "Wagering Ring Regular",
    dialogueId: "dialogue_mara_venn",
  };

  it("is a pure pass-through to the canonical value when overlayRaw is undefined", () => {
    const result = loadLocalizedContent(ActorSchema, ActorTranslatableSchema, actorRaw, undefined, "actor_mara_venn", mergeActorTranslatable);
    expect(result.title).toBe("Wagering Ring Regular");
  });

  it("parses and merges a real overlay through the real loadContent path — the content-schema scaling note's reachability proof", () => {
    const overlayRaw = { title: "Frequentadora do Círculo das Apostas" };
    const result = loadLocalizedContent(ActorSchema, ActorTranslatableSchema, actorRaw, overlayRaw, "actor_mara_venn", mergeActorTranslatable);
    expect(result.title).toBe("Frequentadora do Círculo das Apostas");
    expect(result.name).toBe("Mara Venn");
  });

  it("throws a clear, labeled error when the overlay itself fails schema validation", () => {
    const invalidOverlayRaw = { title: 5 }; // wrong type
    expect(() =>
      loadLocalizedContent(ActorSchema, ActorTranslatableSchema, actorRaw, invalidOverlayRaw, "actor_mara_venn", mergeActorTranslatable)
    ).toThrow(/actor_mara_venn/);
  });

  it("works for the dialogue shape too, confirmed through the real DialogueSchema/DialogueTranslatableSchema pair", () => {
    const dialogueRaw = {
      id: "dialogue_test",
      startNodeId: "node_greeting",
      nodes: {
        node_greeting: { id: "node_greeting", speaker: "Mara Venn", text: "Hello.", choices: [] },
      },
    };
    const overlayRaw = { nodes: { node_greeting: { text: "Olá." } } };
    const result = loadLocalizedContent(
      DialogueSchema,
      DialogueTranslatableSchema,
      dialogueRaw,
      overlayRaw,
      "dialogue_test",
      mergeDialogueTranslatable
    );
    expect(result.nodes.node_greeting.text).toBe("Olá.");
  });
});
