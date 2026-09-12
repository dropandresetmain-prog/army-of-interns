export const EMPLOYMENT_TYPES = ["permanent", "intern"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORKER_RANKS = ["intern", "employee", "senior", "lead", "manager"] as const;
export type WorkerRank = (typeof WORKER_RANKS)[number];

export const WORKER_STATUSES = [
  "idle",
  "working",
  "blocked",
  "awaiting_approval",
  "offline",
] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const WORK_ITEM_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "awaiting_approval",
  "verifying",
  "completed",
  "cancelled",
] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  "pending",
  "active",
  "blocked",
  "completed",
  "cancelled",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const RISK_CLASSES = ["low", "medium", "high", "critical"] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export const STRUCTURED_EVENT_TYPES = [
  "work_received",
  "capabilities_identified",
  "worker_matched",
  "staffing_requested",
  "worker_created",
  "assignment_started",
  "tool_called",
  "human_contacted",
  "human_response_received",
  "approval_requested",
  "approval_resolved",
  "work_verified",
  "work_completed",
  "promotion_recommended",
  "worker_promoted",
] as const;
export type StructuredEventType = (typeof STRUCTURED_EVENT_TYPES)[number];
