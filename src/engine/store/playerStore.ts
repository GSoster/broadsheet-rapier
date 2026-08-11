import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlayerState, StateCommand } from "../types";
import { PlayerStateSchema } from "../types";
import { applyCommand } from "./commands";
import { createEvent, type StateChangeEvent } from "./events";

export const initialPlayerState: PlayerState = {
  currencies: { gold: 0, silver: 0, bronze: 0 },
  worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" },
  currentLocation: { settlementId: "", districtId: "" },
  reputation: { factions: {}, actors: {} },
  inventory: [],
  unlockedNodes: {},
  unlockedClues: [],
  activeEndeavors: {},
  activeMinigame: null,
};

interface PlayerStore extends PlayerState {
  eventLog: StateChangeEvent[];
  dispatchCommand: (command: StateCommand) => void;
  exportSave: () => void;
  importSave: (file: File) => Promise<{ success: boolean; error?: string }>;
}

function extractPlayerState(store: PlayerStore): PlayerState {
  return {
    currencies: store.currencies,
    worldClock: store.worldClock,
    currentLocation: store.currentLocation,
    reputation: store.reputation,
    inventory: store.inventory,
    unlockedNodes: store.unlockedNodes,
    unlockedClues: store.unlockedClues,
    activeEndeavors: store.activeEndeavors,
    activeMinigame: store.activeMinigame,
  };
}

export type SaveValidationResult =
  | { success: true; data: PlayerState }
  | { success: false; error: string };

export function parseAndValidateSave(rawJson: string): SaveValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { success: false, error: "File is not valid JSON." };
  }
  const result = PlayerStateSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: "Save file does not match the expected PlayerState shape." };
  }
  return { success: true, data: result.data };
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      ...initialPlayerState,
      eventLog: [],

      dispatchCommand: (command) => {
        set((store) => {
          const nextPlayerState = applyCommand(extractPlayerState(store), command);
          return { ...nextPlayerState, eventLog: [...store.eventLog, createEvent(command)] };
        });
      },

      exportSave: () => {
        const playerState = extractPlayerState(get());
        const blob = new Blob([JSON.stringify(playerState, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "broadsheet_rapier_save.json";
        anchor.click();
        URL.revokeObjectURL(url);
      },

      importSave: async (file) => {
        const text = await file.text();
        const result = parseAndValidateSave(text);
        if (!result.success) {
          return { success: false, error: result.error };
        }
        set({ ...result.data, eventLog: [] });
        return { success: true };
      },
    }),
    {
      name: "broadsheet_rapier_player_state",
      partialize: (store) => extractPlayerState(store),
    }
  )
);
