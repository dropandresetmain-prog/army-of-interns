import type { WorkItem } from "../domain/contracts";

export interface NaturalWorkRequest {
  /** Free-text request from a human or upstream channel. */
  text: string;
  requestedByPersonId: string;
  context?: string;
  constraints?: string[];
  successCriteria?: string[];
  deadline?: number;
  budget?: WorkItem["budget"];
}

export interface WorkIntakeResult {
  workItem: Omit<WorkItem, "requiredCapabilityIds"> & {
    requiredCapabilityIds: string[];
  };
}

/**
 * Convert a natural-language request into a generic WorkItem draft.
 * Does not encode scenario-specific fields.
 */
export function intakeNaturalWorkRequest(
  request: NaturalWorkRequest,
): WorkIntakeResult {
  const text = request.text.trim();
  if (!text) {
    throw new Error("Work request text is required.");
  }
  if (!request.requestedByPersonId.trim()) {
    throw new Error("requestedByPersonId is required.");
  }

  const objective = text.replace(/\s+/g, " ");
  const constraints = (request.constraints ?? []).map((item) => item.trim()).filter(Boolean);
  const successCriteria =
    request.successCriteria?.map((item) => item.trim()).filter(Boolean) ??
    [`The requested outcome is completed and verified: ${objective}`];

  return {
    workItem: {
      objective,
      context:
        request.context?.trim() ||
        "Submitted as a natural-language work request.",
      constraints,
      status: "open",
      requestedByPersonId: request.requestedByPersonId,
      requiredCapabilityIds: [],
      successCriteria,
      deadline: request.deadline,
      budget: request.budget,
    },
  };
}
