import type { AgentKind } from "./types";

export function inboundAgentPrompt(input: {
  kind: AgentKind;
  body: string;
  roleType?: string;
  phase: string;
}): string {
  const header = `Inbound ${input.roleType ?? "person"} message:\n${input.body}`;

  if (input.kind === "manager") {
    if (input.phase === "awaiting_owner_approval") {
      return [
        header,
        "",
        "The Business Owner is responding to the current pending spend approval.",
        "Interpret their natural-language intent. Exact APPROVE/REJECT are optional shortcuts, not required.",
        'If they clearly approve, call resolve_approval({ decision: "approved" }), then send_message the selected contractor and the tenant.',
        "Ask the selected contractor to report when the work is finished. Do not notify any contractor unless the approval is approved.",
        'If they clearly reject, call resolve_approval({ decision: "rejected" }) and make no external commitment.',
        'Clear examples: "yeah C is fine, go ahead" is approve. "nah too expensive, find someone else" is reject.',
        "Do not ask redundant confirmation. Act when intent is reasonably clear.",
        "If the intent is genuinely ambiguous, send_message one concise clarification. Then stop.",
      ].join("\n");
    }
    if (input.phase === "awaiting_promotion") {
      return [
        header,
        "",
        "The Business Owner is responding to the pending promote_worker approval, not a historical spend approval.",
        "Interpret their natural-language intent. Exact PROMOTE is optional.",
        'If they clearly approve, call resolve_approval({ decision: "approved" }).',
        'If they clearly reject, call resolve_approval({ decision: "rejected" }).',
        'Clear example: "yeah keep her" is approve promotion. Do not seek redundant confirmation.',
        "If the intent is genuinely ambiguous, send_message one concise clarification. Then stop.",
      ].join("\n");
    }
    return `${header}\n\nDecide the next management action using your tools.`;
  }

  if (input.kind === "operations") {
    if (input.phase === "awaiting_contractor_done") {
      return [
        header,
        "",
        "This is the selected contractor. Decide whether they are reporting completion.",
        "Exact DONE is optional.",
        'If completion is clear, call update_work_context({ phase: "awaiting_tenant_verification" }) and send_message the tenant asking them to verify the outcome.',
        "If they are asking a question or reporting failure, do not mark completion. Then stop.",
      ].join("\n");
    }
    if (input.phase === "awaiting_tenant_verification") {
      return [
        header,
        "",
        "Interpret whether the tenant confirms the outcome is fixed. Do not require a canned phrase.",
        "If clearly confirmed, call verify_outcome({ confirmed: true, notes }).",
        "If clearly not fixed, call verify_outcome({ confirmed: false, notes }) and communicate appropriately.",
        "If genuinely ambiguous, send_message one concise clarification. Then stop.",
      ].join("\n");
    }
    return [
      header,
      "",
      "The initial tenant report already provides substantial context.",
      "Ask at most one diagnostic question, then stop and wait for the reply.",
      "After the tenant replies once, interpret the answer. If a contractor is required, call request_staffing with vendor_sourcing immediately and stop.",
      "Do not ask a second diagnostic question unless the first reply is genuinely unusable. Even then, ask at most one more clarification, then proceed.",
      "If this message or runtime context already has enough to proceed, skip the question and call request_staffing now.",
    ].join("\n");
  }

  return [
    header,
    "",
    "Extract price and availability from this natural contractor reply. Informal wording is enough — do not interview them.",
    'If both can reasonably be inferred (for example "Can come around 4, probably 120 bucks."), record immediately.',
    "If one critical field is missing, ask one concise clarification, then record once they answer.",
    "Maximum two clarification turns total. Then record or evaluate using the available information.",
  ].join("\n");
}

export function managerFollowUpPrompt(input: {
  phase: string;
  pendingStaffingCapabilityKeys: string[];
}): string {
  if (input.pendingStaffingCapabilityKeys.length > 0) {
    return `Staff the requested capability now: ${input.pendingStaffingCapabilityKeys.join(", ")}. Call staff_work with those capabilityKeys, then delegate_worker once to the new intern. Then stop.`;
  }
  if (input.phase === "awaiting_promotion") {
    return [
      "A worker is now promotion-eligible after a verified successful outcome.",
      "Call recommend_promotion once.",
      "Then send_message the Business Owner a natural recommendation to retain them in the proposed permanent role.",
      "Do not request spend approval and do not reuse a contractor-recommendation prompt. Then stop.",
    ].join(" ");
  }
  return "A worker reported a recommendation. Call request_approval once if spend needs authority. Then stop.";
}
