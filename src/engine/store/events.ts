import type { CommandType, StateCommand } from "../types";

export interface StateChangeEvent {
  type: CommandType;
  payload: unknown;
  timestamp: number;
}

export function createEvent(command: StateCommand): StateChangeEvent {
  return { type: command.type, payload: command.payload, timestamp: Date.now() };
}
