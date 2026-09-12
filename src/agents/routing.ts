import { isOwnerRole } from "./authority";
import type { AgentKind } from "./types";

export function selectAgentKind(input: {
  phase: string;
  roleType?: string;
  isSelectedContractor?: boolean;
  pendingManagerFollowUp?: boolean;
}): AgentKind {
  if (input.pendingManagerFollowUp) {
    return "manager";
  }

  if (
    isOwnerRole(input.roleType) &&
    (input.phase === "awaiting_owner_approval" || input.phase === "awaiting_promotion")
  ) {
    return "manager";
  }

  if (input.roleType === "tenant") {
    if (
      input.phase === "awaiting_tenant_diagnosis" ||
      input.phase === "awaiting_tenant_verification"
    ) {
      return "operations";
    }
    return "manager";
  }

  if (input.roleType === "contractor") {
    if (input.phase === "soliciting_quotes" || input.phase === "rejected_resourcing") {
      return "procurement";
    }
    if (input.phase === "awaiting_contractor_done" && input.isSelectedContractor) {
      return "operations";
    }
  }

  return "manager";
}
