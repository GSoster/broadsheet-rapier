import type { Dialogue } from "./content/schemas/dialogue.schema";

// Content lookup (resolving a dialogueId/nodeId to a real DialogueNode) requires
// importing src/content/, so — like the rest of App.tsx's content resolution —
// this lives outside src/engine/. Never called from inside the pure
// PlayerState reducer; only from render/dispatch code in App.tsx. Kept in its
// own module (rather than exported directly from App.tsx) so App.tsx stays a
// components-only export, per this project's react-refresh lint rule.
export function resolveDialogueEntryNodeId(dialogue: Dialogue, progress?: { currentNodeId: string }): string {
  const candidateId = progress?.currentNodeId ?? dialogue.startNodeId;
  if (dialogue.nodes[candidateId]) return candidateId;
  if (import.meta.env.DEV) {
    console.warn(
      `[dialogue] "${dialogue.id}" has no node "${candidateId}" (saved progress is stale); falling back to startNodeId.`
    );
  }
  return dialogue.startNodeId;
}
