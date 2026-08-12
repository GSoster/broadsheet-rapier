import type { DialogueRequirement, StateCommand } from "../types";
import { usePlayerStore } from "../store/playerStore";
import { evaluateDialogueRequirement } from "../utils/evaluator";
import { AssetFallback } from "./AssetFallback";

// Locally-owned shape, not imported from src/content/schemas/dialogue.schema.ts —
// src/engine/ never imports from src/content/ as hardcoded data (CLAUDE.md).
// App.tsx (which does read content) resolves a real Dialogue's node and passes
// it down structurally matching this shape, same pattern as
// NodeInteractionCanvas's locally-owned NodeInteractionActor/Action types.
export interface DialogueOverlayChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  requires?: DialogueRequirement;
  commands: StateCommand[];
}

export interface DialogueOverlayNode {
  id: string;
  speaker: string;
  text: string;
  choices: DialogueOverlayChoice[];
}

export interface DialogueOverlayProps {
  dialogueId: string;
  node: DialogueOverlayNode | null;
  // The current speaker's portrait — resolved by App.tsx from the Actor
  // content the open dialogue belongs to (src/engine/ never imports
  // src/content/ directly, so this arrives as a plain optional path, same
  // pattern as NodeInteractionCanvas's imageAsset).
  speakerImageAsset?: string;
  onClose: () => void;
}

export function DialogueOverlay({ dialogueId, node, speakerImageAsset, onClose }: DialogueOverlayProps) {
  const playerState = usePlayerStore((state) => state);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);

  if (!node) {
    return null;
  }

  const handleSelectChoice = (choice: DialogueOverlayChoice) => {
    dispatchCommand({
      type: "COMMAND_SELECT_DIALOGUE_CHOICE",
      payload: { dialogueId, nextNodeId: choice.nextNodeId ?? null, commands: choice.commands },
    });
    if (choice.nextNodeId === undefined) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded border border-indigo-800 bg-neutral-950 p-6 text-indigo-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {speakerImageAsset ? (
              <AssetFallback
                src={speakerImageAsset}
                alt={node.speaker}
                className="h-12 w-12 flex-none rounded-full object-cover"
              />
            ) : null}
            <p className="text-xs uppercase tracking-wide text-indigo-400">{node.speaker}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none text-xs uppercase tracking-wide text-indigo-400 hover:text-indigo-100"
          >
            Close
          </button>
        </div>
        <p className="text-sm italic text-indigo-200">&ldquo;{node.text}&rdquo;</p>
        <div className="flex flex-col gap-2 border-t border-indigo-900 pt-4">
          {node.choices.map((choice) => {
            const isAvailable = evaluateDialogueRequirement(playerState, choice.requires, node.id, dialogueId);
            return (
              <button
                key={choice.id}
                type="button"
                disabled={!isAvailable}
                onClick={() => handleSelectChoice(choice)}
                className="rounded border border-amber-700 bg-amber-950/40 px-3 py-2 text-left text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-amber-500"
              >
                {choice.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
