import { describe, expect, it, vi } from "vitest";
import { resolveDialogueEntryNodeId } from "../dialogueResolution";
import type { Dialogue } from "../content/schemas/dialogue.schema";

const dialogue: Dialogue = {
  id: "dialogue_test",
  startNodeId: "node_start",
  nodes: {
    node_start: { id: "node_start", speaker: "Someone", text: "Hello.", choices: [] },
    node_other: { id: "node_other", speaker: "Someone", text: "Elsewhere.", choices: [] },
  },
};

describe("resolveDialogueEntryNodeId", () => {
  it("falls back to startNodeId when there is no saved progress", () => {
    expect(resolveDialogueEntryNodeId(dialogue, undefined)).toBe("node_start");
  });

  it("resumes at a valid saved node", () => {
    expect(resolveDialogueEntryNodeId(dialogue, { currentNodeId: "node_other" })).toBe("node_other");
  });

  it("falls back to startNodeId, with a dev-only warning, when the saved node no longer exists", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveDialogueEntryNodeId(dialogue, { currentNodeId: "node_deleted" })).toBe("node_start");
    warnSpy.mockRestore();
  });
});
