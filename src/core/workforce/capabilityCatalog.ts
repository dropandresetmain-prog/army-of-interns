/**
 * Controlled capability vocabulary and permission defaults.
 * Capability keys are application data — models must not invent new keys silently.
 */

export interface CapabilityRoleTemplate {
  title: string;
  personality: string;
  communicationStyle: string;
  standingInstructions: string[];
}

export interface CapabilityDefinition {
  key: string;
  name: string;
  description: string;
  /** Deterministic tool grants derived from this capability. */
  defaultToolPermissionIds: string[];
  /** Lowercase phrases that may indicate this capability is required. */
  signals: string[];
  /** Additional controlled keys always required alongside this capability. */
  implies?: string[];
  roleTemplate: CapabilityRoleTemplate;
}

export interface ToolPermissionDefinition {
  id: string;
  description: string;
  /** Capability keys that may grant this permission. */
  grantedByCapabilityKeys: string[];
}

/** Seeded catalog used by analysis, matching, and permission mapping. */
export const CONTROLLED_CAPABILITIES: readonly CapabilityDefinition[] = [
  {
    key: "maintenance_triage",
    name: "Maintenance triage",
    description: "Diagnose and coordinate facility or equipment repair work.",
    defaultToolPermissionIds: [
      "permission_read_business_record",
      "permission_update_work_item",
      "permission_send_message",
      "permission_log_event",
      "permission_request_staffing",
      "permission_verify_outcome",
    ],
    signals: [
      "leak",
      "leaking",
      "toilet",
      "pipe",
      "faucet",
      "broken",
      "repair",
      "maintenance",
      "hvac",
      "plumbing",
      "clogged",
      "flood",
    ],
    implies: ["stakeholder_messaging"],
    roleTemplate: {
      title: "Operations Intern",
      personality: "Efficient, proactive, slightly kancheong, and competent.",
      communicationStyle: "Concise; light natural Singlish is fine. No theatrics.",
      standingInstructions: [
        "Stay within assigned capabilities and tool permissions.",
        "Ask useful follow-up questions, then act.",
        "Request staffing when work falls outside the capability envelope.",
        "Escalate actions that require human authority.",
      ],
    },
  },
  {
    key: "stakeholder_messaging",
    name: "Stakeholder messaging",
    description: "Coordinate status updates with people affected by the work.",
    defaultToolPermissionIds: [
      "permission_send_message",
      "permission_log_event",
    ],
    signals: [
      "notify",
      "update the requester",
      "message the owner",
      "stakeholder",
      "keep them informed",
    ],
    roleTemplate: {
      title: "Coordination Intern",
      personality: "Empathetic and precise.",
      communicationStyle: "Brief, respectful updates.",
      standingInstructions: [
        "Never invent contact details.",
        "Keep messages factual and free of speculative promises.",
      ],
    },
  },
  {
    key: "vendor_sourcing",
    name: "Vendor sourcing",
    description: "Find and solicit options from external vendors or service providers.",
    defaultToolPermissionIds: [
      "permission_solicit_options",
      "permission_send_message",
      "permission_collect_response",
      "permission_evaluate_options",
      "permission_report_recommendation",
      "permission_log_event",
    ],
    signals: [
      "find a vendor",
      "source a vendor",
      "get options",
      "vendor sourcing",
      "procurement",
    ],
    roleTemplate: {
      title: "Procurement Intern",
      personality: "Concise, numbers-driven, and commercially practical.",
      communicationStyle: "Short structured questions; record replies faithfully.",
      standingInstructions: [
        "Solicit options without committing spend.",
        "Ask one clarification if price or availability is missing.",
        "Never approve spend or confirm a paid engagement.",
      ],
    },
  },
  {
    key: "content_marketing",
    name: "Content marketing",
    description: "Prepare marketing content such as social posts or campaigns.",
    defaultToolPermissionIds: [
      "permission_read_business_record",
      "permission_update_work_item",
      "permission_log_event",
    ],
    signals: [
      "instagram",
      "social media",
      "marketing post",
      "content calendar",
      "campaign copy",
      "linkedin post",
      "prepare our posts",
      "content marketing",
    ],
    roleTemplate: {
      title: "Marketing Intern",
      personality: "Creative within brand constraints.",
      communicationStyle: "Concise drafts with clear review asks.",
      standingInstructions: [
        "Prepare review-ready drafts; do not publish without approval.",
        "Stay within the assigned capability and tool permissions.",
      ],
    },
  },
  {
    key: "research",
    name: "Research",
    description: "Gather and summarize information for a business decision.",
    defaultToolPermissionIds: [
      "permission_read_business_record",
      "permission_log_event",
    ],
    signals: ["research", "look up", "competitive analysis", "market scan"],
    roleTemplate: {
      title: "Research Intern",
      personality: "Curious and source-aware.",
      communicationStyle: "Bullet summaries with cited assumptions.",
      standingInstructions: [
        "Separate facts from inference.",
        "Do not take external actions without permission.",
      ],
    },
  },
  {
    key: "bookkeeping",
    name: "Bookkeeping",
    description: "Track invoices, expenses, and simple financial records.",
    defaultToolPermissionIds: [
      "permission_read_business_record",
      "permission_update_work_item",
      "permission_log_event",
    ],
    signals: ["bookkeeping", "invoice", "expense report", "reconcile ledger"],
    roleTemplate: {
      title: "Bookkeeping Intern",
      personality: "Precise and conservative with numbers.",
      communicationStyle: "Numeric summaries; flag anomalies.",
      standingInstructions: [
        "Never move money without approval.",
        "Record assumptions when source data is incomplete.",
      ],
    },
  },
] as const;

export const TOOL_PERMISSIONS: readonly ToolPermissionDefinition[] = [
  {
    id: "permission_send_message",
    description: "Send channel messages to people.",
    grantedByCapabilityKeys: [
      "maintenance_triage",
      "stakeholder_messaging",
      "vendor_sourcing",
    ],
  },
  {
    id: "permission_read_business_record",
    description: "Read business records relevant to assigned work.",
    grantedByCapabilityKeys: [
      "maintenance_triage",
      "content_marketing",
      "research",
      "bookkeeping",
    ],
  },
  {
    id: "permission_update_work_item",
    description: "Update work item fields within policy.",
    grantedByCapabilityKeys: [
      "maintenance_triage",
      "content_marketing",
      "bookkeeping",
    ],
  },
  {
    id: "permission_solicit_options",
    description: "Solicit structured options from external parties.",
    grantedByCapabilityKeys: ["vendor_sourcing"],
  },
  {
    id: "permission_collect_response",
    description: "Collect and attach structured responses.",
    grantedByCapabilityKeys: ["vendor_sourcing"],
  },
  {
    id: "permission_request_approval",
    description: "Request human approval for authority-sensitive actions.",
    grantedByCapabilityKeys: ["vendor_sourcing", "bookkeeping"],
  },
  {
    id: "permission_log_event",
    description: "Emit structured runtime events.",
    grantedByCapabilityKeys: [
      "maintenance_triage",
      "stakeholder_messaging",
      "vendor_sourcing",
      "content_marketing",
      "research",
      "bookkeeping",
    ],
  },
  {
    id: "permission_request_staffing",
    description: "Request additional workforce staffing for a missing capability.",
    grantedByCapabilityKeys: ["maintenance_triage"],
  },
  {
    id: "permission_verify_outcome",
    description: "Record outcome verification from the affected stakeholder.",
    grantedByCapabilityKeys: ["maintenance_triage"],
  },
  {
    id: "permission_evaluate_options",
    description: "Invoke deterministic option evaluation.",
    grantedByCapabilityKeys: ["vendor_sourcing"],
  },
  {
    id: "permission_report_recommendation",
    description: "Report a sourcing recommendation to the manager.",
    grantedByCapabilityKeys: ["vendor_sourcing"],
  },
] as const;

const capabilityByKey = new Map(
  CONTROLLED_CAPABILITIES.map((capability) => [capability.key, capability]),
);

export function listControlledCapabilityKeys(): string[] {
  return CONTROLLED_CAPABILITIES.map((capability) => capability.key);
}

export function getCapabilityDefinition(
  key: string,
): CapabilityDefinition | undefined {
  return capabilityByKey.get(key);
}

export function isControlledCapabilityKey(key: string): boolean {
  return capabilityByKey.has(key);
}
