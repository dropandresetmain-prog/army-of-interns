import type { CommandCentreState } from "./command-centre-types";

export const emptyCommandCentreState: CommandCentreState = {
  workers: [],
  events: [],
  quotes: [],
  participants: {
    ownerReady: false,
    tenant: { joined: 0, required: 1 },
    contractors: { joined: 0, required: 3 },
  },
};

/** Pass-through adapter: Convex already returns the UI contract. */
export function toCommandCentreState(
  snapshot: CommandCentreState & { phase?: string },
): CommandCentreState {
  const { phase: _phase, ...state } = snapshot;
  return state;
}
