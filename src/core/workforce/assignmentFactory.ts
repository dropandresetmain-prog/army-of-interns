import type { Assignment } from "../domain/contracts";

export interface AssignmentDraftInput {
  workItemId: string;
  workerId: string;
  responsibility: string;
}

/**
 * Create a generic assignment draft. Responsibility is free text describing
 * what the worker is accountable for — not a scenario enum.
 */
export function createAssignmentDraft(
  input: AssignmentDraftInput,
): Assignment {
  if (!input.workItemId.trim()) {
    throw new Error("workItemId is required.");
  }
  if (!input.workerId.trim()) {
    throw new Error("workerId is required.");
  }
  const responsibility = input.responsibility.trim();
  if (!responsibility) {
    throw new Error("responsibility is required.");
  }

  return {
    workItemId: input.workItemId,
    workerId: input.workerId,
    responsibility,
    status: "active",
  };
}

export function defaultResponsibilityForCapabilities(
  capabilityKeys: string[],
): string {
  if (capabilityKeys.length === 0) {
    return "Execute the assigned work item within policy.";
  }
  return `Own delivery for capabilities: ${capabilityKeys.join(", ")}.`;
}
