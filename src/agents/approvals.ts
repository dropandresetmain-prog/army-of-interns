export function selectPendingApprovalId(input: {
  phase: string;
  approvalId?: string;
  promotionApprovalId?: string;
}): string | undefined {
  if (input.phase === "awaiting_promotion") {
    return input.promotionApprovalId;
  }
  if (input.phase === "awaiting_owner_approval") {
    return input.approvalId;
  }
  return input.promotionApprovalId ?? input.approvalId;
}
