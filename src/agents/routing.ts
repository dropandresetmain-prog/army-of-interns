import type { AgentKind } from "./types";

export function selectAgentKind(input: {
  phase: string;
  roleType?: string;
  ownerCommand?: boolean;
  contractorDone?: boolean;
  pendingManagerFollowUp?: boolean;
}): AgentKind {
  if (input.pendingManagerFollowUp || input.ownerCommand) {
    return "manager";
  }
  if (input.contractorDone) {
    return "operations";
  }
  if (input.roleType === "contractor") {
    return "procurement";
  }
  if (
    input.roleType === "tenant" &&
    (input.phase === "awaiting_tenant_diagnosis" ||
      input.phase === "awaiting_tenant_verification")
  ) {
    return "operations";
  }
  return "manager";
}
