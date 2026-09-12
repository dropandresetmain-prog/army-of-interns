import type { StructuredEventType } from "../core/domain/vocabulary";

export const REQUIRED_FINALE_EVENT_TYPES = [
  "work_verified",
  "work_completed",
  "promotion_recommended",
  "approval_resolved",
  "worker_promoted",
] as const satisfies readonly StructuredEventType[];
