import type { AgentKind } from "./types";

/** Normalize model-supplied role labels onto persisted people.roleType values. */
export function normalizeRoleType(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (
    normalized === "owner" ||
    normalized === "business_owner" ||
    normalized === "businessowner" ||
    normalized === "tim"
  ) {
    return "business_owner";
  }
  if (normalized === "tenant") {
    return "tenant";
  }
  if (normalized.startsWith("contractor")) {
    return "contractor";
  }
  return normalized;
}

export function isRoleAllowed(roleType: string, allowed: string[]): boolean {
  if (allowed.includes(roleType)) {
    return true;
  }
  if (roleType === "business_owner" && allowed.includes("owner")) {
    return true;
  }
  if (roleType === "owner" && allowed.includes("business_owner")) {
    return true;
  }
  return false;
}

/**
 * Who this agent may text in the current phase.
 * One send_message call reaches exactly one of these roles — never a broadcast.
 */
export function allowedSendRoles(input: {
  kind: AgentKind;
  phase: string;
  inboundRoleType?: string;
}): string[] {
  const inbound = normalizeRoleType(input.inboundRoleType);

  if (input.kind === "procurement") {
    return inbound === "contractor" ? ["contractor"] : [];
  }

  if (input.kind === "operations") {
    const roles = ["tenant"];
    if (input.phase === "awaiting_contractor_done" && inbound === "contractor") {
      roles.push("contractor");
    }
    return roles;
  }

  switch (input.phase) {
    case "awaiting_tenant_diagnosis":
    case "awaiting_tenant_verification":
      return ["tenant"];
    case "soliciting_quotes":
    case "rejected_resourcing":
    case "awaiting_owner_approval":
    case "awaiting_promotion":
      return ["business_owner"];
    case "awaiting_contractor_done":
      return ["contractor", "tenant"];
    default:
      return inbound ? [inbound] : [];
  }
}

export function resolveSendRole(input: {
  kind: AgentKind;
  phase: string;
  requestedRoleType?: string;
  inboundRoleType?: string;
}): { roleType: string } | { error: string } {
  const allowed = allowedSendRoles(input);
  const requested = normalizeRoleType(input.requestedRoleType);
  const inbound = normalizeRoleType(input.inboundRoleType);

  if (requested) {
    if (isRoleAllowed(requested, allowed)) {
      return { roleType: requested };
    }
    return {
      error: `Cannot message ${requested} from ${input.kind} during ${input.phase}.`,
    };
  }

  if (inbound && isRoleAllowed(inbound, allowed)) {
    return { roleType: inbound };
  }

  return {
    error: "send_message needs an in-lane roleType; refusing to guess another stakeholder.",
  };
}

export function kindFromWorker(worker?: {
  name?: string;
  rank?: string;
  capabilityKeys?: string[];
}): AgentKind {
  if (!worker) {
    return "manager";
  }
  if (worker.rank === "manager" || worker.name === "Alex") {
    return "manager";
  }
  if (worker.name === "Daniel" || worker.capabilityKeys?.includes("vendor_sourcing")) {
    return "procurement";
  }
  return "operations";
}
