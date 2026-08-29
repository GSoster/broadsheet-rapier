import type { z } from "zod";
import { loadContent } from "./contentLoader";
import type { BaseNodeTranslatable } from "./content/schemas/shared";
import type { Actor } from "./content/schemas/actor.schema";
import type { ActorTranslatable } from "./content/schemas/actor.schema";
import type { Endeavor } from "./content/schemas/endeavor.schema";
import type { EndeavorTranslatable } from "./content/schemas/endeavor.schema";
import type { Dialogue, DialogueNode } from "./content/schemas/dialogue.schema";
import type { DialogueTranslatable } from "./content/schemas/dialogue.schema";

// Merges a locale overlay onto a canonical (English) content object,
// substituting only the overlay's DEFINED leaf fields — everything the
// overlay omits (including a field it never mentions at all) stays the
// canonical English value. Bridge layer: this needs content types, so it
// lives outside src/engine/, same reason dialogueResolution.ts/
// notificationResolution.ts do. See docs/features/feature_localization.md.

export function mergeBaseNodeTranslatable<T extends { name: string; description: string }>(
  canonical: T,
  overlay: BaseNodeTranslatable | undefined
): T {
  if (!overlay) return canonical;
  return {
    ...canonical,
    name: overlay.name ?? canonical.name,
    description: overlay.description ?? canonical.description,
  };
}

export function mergeActorTranslatable(canonical: Actor, overlay: ActorTranslatable | undefined): Actor {
  if (!overlay) return canonical;
  return {
    ...mergeBaseNodeTranslatable(canonical, overlay),
    title: overlay.title ?? canonical.title,
  };
}

export function mergeEndeavorTranslatable(canonical: Endeavor, overlay: EndeavorTranslatable | undefined): Endeavor {
  if (!overlay) return canonical;
  const phases = { ...canonical.phases };
  for (const [phaseId, phaseOverlay] of Object.entries(overlay.phases ?? {})) {
    const canonicalPhase = phases[phaseId];
    // An overlay phase id with no canonical match is orphaned content-authoring
    // error, not a merge concern — content-integrity.test.ts's referential
    // check catches it; silently skipping here avoids a runtime crash either way.
    if (!canonicalPhase) continue;
    phases[phaseId] = {
      ...canonicalPhase,
      objectiveText: phaseOverlay.objectiveText ?? canonicalPhase.objectiveText,
    };
  }
  return {
    ...canonical,
    title: overlay.title ?? canonical.title,
    description: overlay.description ?? canonical.description,
    phases,
  };
}

export function mergeDialogueTranslatable(canonical: Dialogue, overlay: DialogueTranslatable | undefined): Dialogue {
  if (!overlay?.nodes) return canonical;
  const nodes: Record<string, DialogueNode> = { ...canonical.nodes };
  for (const [nodeId, nodeOverlay] of Object.entries(overlay.nodes)) {
    const canonicalNode = nodes[nodeId];
    if (!canonicalNode) continue; // orphaned overlay node id — see mergeEndeavorTranslatable's comment
    let choices = canonicalNode.choices;
    if (nodeOverlay.choices) {
      // Matched by id, not array position — an overlay's choices array can
      // list a subset, in any order, and must still land on the right choice.
      const overlayById = new Map(nodeOverlay.choices.map((c) => [c.id, c]));
      choices = canonicalNode.choices.map((choice) => {
        const choiceOverlay = overlayById.get(choice.id);
        return choiceOverlay ? { ...choice, text: choiceOverlay.text ?? choice.text } : choice;
      });
    }
    nodes[nodeId] = {
      ...canonicalNode,
      speaker: nodeOverlay.speaker ?? canonicalNode.speaker,
      text: nodeOverlay.text ?? canonicalNode.text,
      choices,
    };
  }
  return { ...canonical, nodes };
}

/**
 * Parses the canonical file through the existing loadContent unchanged, then
 * — if a locale overlay exists for it — parses the overlay through its own
 * schema and merges it on top via the supplied merge function. Passing
 * `overlayRaw: undefined` (the common case until a file is actually
 * translated) is a pure pass-through to the canonical value.
 */
export function loadLocalizedContent<T, O>(
  schema: z.ZodType<T>,
  overlaySchema: z.ZodType<O>,
  raw: unknown,
  overlayRaw: unknown | undefined,
  label: string,
  merge: (canonical: T, overlay: O | undefined) => T
): T {
  const canonical = loadContent(schema, raw, label);
  if (overlayRaw === undefined) return canonical;
  const overlay = loadContent(overlaySchema, overlayRaw, `${label} (overlay)`);
  return merge(canonical, overlay);
}
