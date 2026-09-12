export const DEMO_STATE_KEY = "live";

export const DEMO_OWNER = {
  displayName: "Tim",
  roleType: "business_owner",
  demoCallsign: "OWNER",
} as const;

export const DEMO_TENANT = {
  displayName: "Tenant",
  roleType: "tenant",
  demoCallsign: "TENANT",
} as const;

export const CONTRACTOR_CALLSIGNS = ["CONTRACTOR_A", "CONTRACTOR_B", "CONTRACTOR_C"] as const;
export const CONTRACTOR_LABELS = ["Contractor A", "Contractor B", "Contractor C"] as const;

export const DEMO_OPS_WORKER = {
  name: "Shu Zhen",
  title: "Operations Intern",
  promotedTitle: "Property Operations Executive",
  employmentTypeOnCreate: "intern" as const,
  employmentTypeOnPromote: "permanent" as const,
};

export const DEMO_PROCUREMENT_WORKER = {
  name: "Daniel",
  title: "Procurement Intern",
};

export const DEMO_MANAGER = {
  name: "Alex",
  title: "General Manager",
  employmentType: "permanent" as const,
};

export const PROMOTION_SUCCESS_THRESHOLD = 3;
export const SEEDED_OPS_SUCCESSFUL_TASKS = 2;

export const DEMO_BUDGET = { amount: 150, currency: "SGD" } as const;
export const DEMO_DEADLINE_LABEL = "today";

export const TENANT_FOLLOW_UP =
  "Does the leak happen continuously, or only after flushing?";

export const CONTRACTOR_SOLICITATION =
  "Need someone for a leaking toilet today. Target budget ≤ S$150. Reply with your price and earliest availability.";

export type DemoRole = "owner" | "tenant" | "contractor";

export type DemoPhase =
  | "idle"
  | "awaiting_tenant_diagnosis"
  | "soliciting_quotes"
  | "awaiting_owner_approval"
  | "rejected_resourcing"
  | "awaiting_contractor_done"
  | "awaiting_tenant_verification"
  | "awaiting_promotion"
  | "completed";
