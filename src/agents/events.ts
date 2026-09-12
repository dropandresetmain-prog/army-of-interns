import type { StructuredEventType } from "../core/domain/vocabulary";
import type { AgentActivity } from "./types";

const TOOL_EVENTS: Record<
  string,
  { eventType: StructuredEventType; summary: (agentName: string) => string }
> = {
  inspect_work: {
    eventType: "tool_called",
    summary: (name) => `${name} inspected the current work item.`,
  },
  inspect_workforce: {
    eventType: "tool_called",
    summary: (name) => `${name} inspected the workforce.`,
  },
  inspect_outcome: {
    eventType: "tool_called",
    summary: (name) => `${name} inspected outcome state.`,
  },
  staff_work: {
    eventType: "staffing_requested",
    summary: (name) => `${name} invoked generic staffing.`,
  },
  delegate_worker: {
    eventType: "assignment_started",
    summary: (name) => `${name} delegated to a worker agent.`,
  },
  request_staffing: {
    eventType: "staffing_requested",
    summary: (name) => `${name} requested additional staffing.`,
  },
  send_message: {
    eventType: "human_contacted",
    summary: (name) => `${name} contacted a stakeholder.`,
  },
  solicit_options: {
    eventType: "human_contacted",
    summary: (name) => `${name} solicited contractor options.`,
  },
  record_option: {
    eventType: "human_response_received",
    summary: (name) => `${name} recorded a contractor option.`,
  },
  evaluate_options: {
    eventType: "tool_called",
    summary: (name) => `${name} evaluated contractor options.`,
  },
  report_recommendation: {
    eventType: "tool_called",
    summary: (name) => `${name} reported a recommendation to the manager.`,
  },
  request_approval: {
    eventType: "approval_requested",
    summary: (name) => `${name} requested human approval.`,
  },
  resolve_approval: {
    eventType: "approval_resolved",
    summary: (name) => `${name} resolved an approval decision.`,
  },
  verify_outcome: {
    eventType: "work_verified",
    summary: (name) => `${name} verified the work outcome.`,
  },
  recommend_promotion: {
    eventType: "promotion_recommended",
    summary: (name) => `${name} recommended a worker promotion.`,
  },
  update_work_context: {
    eventType: "tool_called",
    summary: (name) => `${name} updated permitted work context.`,
  },
  log_action: {
    eventType: "tool_called",
    summary: (name) => `${name} logged a structured action.`,
  },
};

export function activityForTool(input: {
  agentName: string;
  agentId?: string;
  toolName: string;
  status?: string;
  targetRole?: string;
  result?: string;
}): AgentActivity {
  const mapped = TOOL_EVENTS[input.toolName];
  return {
    eventType: mapped?.eventType ?? "tool_called",
    summary: mapped?.summary(input.agentName) ?? `${input.agentName} used ${input.toolName}.`,
    metadata: {
      agentName: input.agentName,
      agentId: input.agentId ?? null,
      toolName: input.toolName,
      status: input.status ?? "ok",
      targetRole: input.targetRole ?? null,
      result: input.result ?? null,
    },
  };
}

export function activityForFallback(reason: string): AgentActivity {
  return {
    eventType: "tool_called",
    summary: "Agent runtime fell back to deterministic helpers.",
    metadata: {
      agentName: "system",
      toolName: "fallback",
      status: "error",
      result: reason.slice(0, 240),
    },
  };
}
