export type ProtectedAction =
  | "resolve_approval"
  | "report_contractor_completion"
  | "verify_outcome";

export function isOwnerRole(roleType?: string): boolean {
  return roleType === "business_owner" || roleType === "owner";
}

export function canResolveApproval(input: {
  actorPersonId?: string;
  actorRoleType?: string;
  ownerPersonId?: string;
}): boolean {
  if (!input.actorPersonId) {
    return false;
  }
  if (input.ownerPersonId && input.actorPersonId === input.ownerPersonId) {
    return true;
  }
  return isOwnerRole(input.actorRoleType);
}

export function canReportContractorCompletion(input: {
  actorPersonId?: string;
  selectedContractorPersonId?: string;
}): boolean {
  return Boolean(
    input.actorPersonId &&
      input.selectedContractorPersonId &&
      input.actorPersonId === input.selectedContractorPersonId,
  );
}

export function canVerifyOutcome(input: {
  actorPersonId?: string;
  actorRoleType?: string;
  tenantPersonId?: string;
}): boolean {
  if (!input.actorPersonId) {
    return false;
  }
  if (input.tenantPersonId && input.actorPersonId === input.tenantPersonId) {
    return true;
  }
  return input.actorRoleType === "tenant";
}

export function unauthorizedActionMessage(_action: ProtectedAction): string {
  return "Noted.";
}
