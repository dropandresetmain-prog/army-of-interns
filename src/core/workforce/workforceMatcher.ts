import type { WorkerStatus } from "../domain/vocabulary";

export interface MatchableWorker {
  id: string;
  /** Capability document IDs or controlled keys — compared as opaque strings. */
  capabilityIds: string[];
  status: WorkerStatus;
  name?: string;
}

export interface WorkforceMatchInput {
  requiredCapabilityIds: string[];
  workers: MatchableWorker[];
  /** Statuses allowed to accept new work. Defaults to idle + working. */
  assignableStatuses?: WorkerStatus[];
}

export type WorkforceMatchResult =
  | {
      outcome: "matched";
      workerId: string;
      matchedCapabilityIds: string[];
      reason: string;
    }
  | {
      outcome: "no_match";
      missingCapabilityIds: string[];
      reason: string;
    };

const DEFAULT_ASSIGNABLE: WorkerStatus[] = ["idle", "working"];

function coversAllRequired(
  workerCapabilityIds: string[],
  requiredCapabilityIds: string[],
): boolean {
  const owned = new Set(workerCapabilityIds);
  return requiredCapabilityIds.every((id) => owned.has(id));
}

/**
 * Deterministic capability-based matching. Never matches by worker name.
 */
export function matchWorkforce(
  input: WorkforceMatchInput,
): WorkforceMatchResult {
  const required = [...new Set(input.requiredCapabilityIds)];
  if (required.length === 0) {
    return {
      outcome: "no_match",
      missingCapabilityIds: [],
      reason: "No required capabilities were identified for matching.",
    };
  }

  const assignable = new Set(input.assignableStatuses ?? DEFAULT_ASSIGNABLE);
  const candidates = input.workers.filter(
    (worker) =>
      assignable.has(worker.status) &&
      coversAllRequired(worker.capabilityIds, required),
  );

  if (candidates.length === 0) {
    return {
      outcome: "no_match",
      missingCapabilityIds: required,
      reason: "No assignable worker covers the required capability set.",
    };
  }

  // Prefer the smallest capability envelope among covers, then stable id order.
  candidates.sort((a, b) => {
    const sizeDelta = a.capabilityIds.length - b.capabilityIds.length;
    if (sizeDelta !== 0) {
      return sizeDelta;
    }
    const idleBoost =
      Number(b.status === "idle") - Number(a.status === "idle");
    if (idleBoost !== 0) {
      return idleBoost;
    }
    return a.id.localeCompare(b.id);
  });

  const selected = candidates[0]!;
  return {
    outcome: "matched",
    workerId: selected.id,
    matchedCapabilityIds: required,
    reason: "Existing worker covers the required capability set.",
  };
}
