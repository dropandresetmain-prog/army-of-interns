import { tool, type Tool } from "@openai/agents";
import { z } from "zod";

import type { AgentBridge } from "./bridge";
import { activityForTool } from "./events";
import { isControlledCapabilityKey } from "../core/workforce/capabilityCatalog";
import { WORKER_TOOL_BY_PERMISSION } from "./types";

function actor(bridge: AgentBridge) {
  const snapshot = bridge.snapshot();
  return {
    name: snapshot.actor?.name ?? "Agent",
    id: snapshot.actor?.id,
  };
}

async function traced<T>(
  bridge: AgentBridge,
  toolName: string,
  extra: { targetRole?: string; result?: string },
  work: () => Promise<T>,
): Promise<T> {
  const { name, id } = actor(bridge);
  try {
    const result = await work();
    await bridge.emit(
      activityForTool({
        agentName: name,
        agentId: id,
        toolName,
        status: "ok",
        targetRole: extra.targetRole,
        result: extra.result,
      }),
    );
    return result;
  } catch (error) {
    await bridge.emit(
      activityForTool({
        agentName: name,
        agentId: id,
        toolName,
        status: "error",
        result: error instanceof Error ? error.message : "tool failed",
      }),
    );
    throw error;
  }
}

export function createInspectWorkTool(bridge: AgentBridge): Tool {
  return tool({
    name: "inspect_work",
    description: "Read the current work item, constraints, and recent activity.",
    parameters: z.object({}),
    execute: async () =>
      traced(bridge, "inspect_work", {}, async () => {
        const snapshot = await bridge.refresh();
        return {
          phase: snapshot.phase,
          workItem: snapshot.workItem ?? null,
          quotes: snapshot.quotes,
          approval: snapshot.approval ?? null,
          recentEvents: snapshot.recentEvents,
        };
      }),
  });
}

export function createInspectWorkforceTool(bridge: AgentBridge): Tool {
  return tool({
    name: "inspect_workforce",
    description: "Inspect persisted workers, assignments, and people roles.",
    parameters: z.object({}),
    execute: async () =>
      traced(bridge, "inspect_workforce", {}, async () => {
        const snapshot = await bridge.refresh();
        return {
          workers: snapshot.workers,
          assignments: snapshot.assignments,
          people: snapshot.people.map((person) => ({
            id: person.id,
            displayName: person.displayName,
            roleType: person.roleType,
            demoCallsign: person.demoCallsign ?? null,
          })),
        };
      }),
  });
}

export function createInspectOutcomeTool(bridge: AgentBridge): Tool {
  return tool({
    name: "inspect_outcome",
    description: "Inspect verification and completion state for the current work.",
    parameters: z.object({}),
    execute: async () =>
      traced(bridge, "inspect_outcome", {}, async () => {
        const snapshot = await bridge.refresh();
        return {
          phase: snapshot.phase,
          workStatus: snapshot.workItem?.status ?? null,
          approval: snapshot.approval ?? null,
          workers: snapshot.workers.map((worker) => ({
            name: worker.name,
            successfulTasks: worker.successfulTasks,
            promotionEligible: worker.promotionEligible,
          })),
        };
      }),
  });
}

export function createUpdateWorkContextTool(bridge: AgentBridge): Tool {
  return tool({
    name: "update_work_context",
    description:
      "Update permitted work context. Use phase awaiting_tenant_verification after the selected contractor clearly reports completion.",
    parameters: z.object({
      phase: z.string().optional(),
      notes: z.string().optional(),
    }),
    execute: async ({ phase, notes }) =>
      traced(bridge, "update_work_context", { result: phase }, async () => {
        return await bridge.updateWorkContext({ phase, notes });
      }),
  });
}

export function createSendMessageTool(bridge: AgentBridge): Tool {
  return tool({
    name: "send_message",
    description:
      "Send a concise Telegram message to a stakeholder. Compose the body yourself.",
    parameters: z.object({
      body: z.string(),
      roleType: z.string().optional(),
      demoCallsign: z.string().optional(),
      personId: z.string().optional(),
    }),
    execute: async ({ body, roleType, demoCallsign, personId }) =>
      traced(bridge, "send_message", { targetRole: roleType }, async () => {
        return await bridge.sendMessage({ body, roleType, demoCallsign, personId });
      }),
  });
}

export function createLogActionTool(bridge: AgentBridge): Tool {
  return tool({
    name: "log_action",
    description: "Emit a short structured operational action for the command centre.",
    parameters: z.object({
      summary: z.string(),
    }),
    execute: async ({ summary }) =>
      traced(bridge, "log_action", { result: summary }, async () => {
        return { logged: true, summary };
      }),
  });
}

export function createRequestStaffingTool(bridge: AgentBridge): Tool {
  return tool({
    name: "request_staffing",
    description:
      "Request the manager staff a missing controlled capability. Do not invent capability keys.",
    parameters: z.object({
      capabilityKeys: z.array(z.string()),
      reason: z.string(),
    }),
    execute: async ({ capabilityKeys, reason }) =>
      traced(bridge, "request_staffing", { result: capabilityKeys.join(",") }, async () => {
        const rejected = capabilityKeys.filter((key) => !isControlledCapabilityKey(key));
        if (rejected.length > 0) {
          return { ok: false, rejected };
        }
        return await bridge.requestStaffing({ capabilityKeys, reason });
      }),
  });
}

export function createVerifyOutcomeTool(bridge: AgentBridge): Tool {
  return tool({
    name: "verify_outcome",
    description:
      "Record whether the affected stakeholder confirmed the outcome. Contractor completion is not enough.",
    parameters: z.object({
      confirmed: z.boolean(),
      notes: z.string(),
    }),
    execute: async ({ confirmed, notes }) =>
      traced(bridge, "verify_outcome", { result: String(confirmed) }, async () => {
        return await bridge.verifyOutcome({ confirmed, notes });
      }),
  });
}

export function createSolicitOptionsTool(bridge: AgentBridge): Tool {
  return tool({
    name: "solicit_options",
    description: "Send a sourcing request to all available contractors. Compose the body yourself.",
    parameters: z.object({
      body: z.string(),
    }),
    execute: async ({ body }) =>
      traced(bridge, "solicit_options", { targetRole: "contractor" }, async () => {
        return await bridge.solicitOptions({ body });
      }),
  });
}

export function createRecordOptionTool(bridge: AgentBridge): Tool {
  return tool({
    name: "record_option",
    description: "Record a structured contractor option extracted from a natural reply.",
    parameters: z.object({
      personId: z.string().optional(),
      price: z.number().nullable().optional(),
      availability: z.string().nullable().optional(),
      rawMessage: z.string(),
    }),
    execute: async ({ personId, price, availability, rawMessage }) =>
      traced(bridge, "record_option", { targetRole: "contractor" }, async () => {
        return await bridge.recordOption({
          personId,
          price,
          availability,
          rawMessage,
        });
      }),
  });
}

export function createEvaluateOptionsTool(bridge: AgentBridge): Tool {
  return tool({
    name: "evaluate_options",
    description:
      "Run deterministic ranking: deadline first, then in-budget, then lower price. You cannot override the ranking.",
    parameters: z.object({}),
    execute: async () =>
      traced(bridge, "evaluate_options", {}, async () => {
        return await bridge.evaluateOptions();
      }),
  });
}

export function createReportRecommendationTool(bridge: AgentBridge): Tool {
  return tool({
    name: "report_recommendation",
    description: "Report the ranked recommendation back to the manager. You cannot approve spend.",
    parameters: z.object({
      summary: z.string(),
    }),
    execute: async ({ summary }) =>
      traced(bridge, "report_recommendation", { result: summary }, async () => {
        return await bridge.reportRecommendation({ summary });
      }),
  });
}

export function createStaffWorkTool(bridge: AgentBridge): Tool {
  return tool({
    name: "staff_work",
    description:
      "Create a work item and staff the first matching intern via the generic workforce path.",
    parameters: z.object({
      objective: z.string(),
      capabilityKeys: z.array(z.string()).optional(),
    }),
    execute: async ({ objective, capabilityKeys }) =>
      traced(bridge, "staff_work", { result: objective }, async () => {
        return await bridge.staffWork({ objective, capabilityKeys });
      }),
  });
}

export function createDelegateWorkerTool(bridge: AgentBridge): Tool {
  return tool({
    name: "delegate_worker",
    description:
      "Run an assigned worker agent with a bounded brief. The worker remains a real Agent with their own tools.",
    parameters: z.object({
      workerId: z.string().optional(),
      workerName: z.string().optional(),
      brief: z.string(),
    }),
    execute: async ({ workerId, workerName, brief }) =>
      traced(bridge, "delegate_worker", { result: workerName ?? workerId }, async () => {
        return await bridge.runWorkerAgent({ workerId, workerName, brief });
      }),
  });
}

export function createRequestApprovalTool(bridge: AgentBridge): Tool {
  return tool({
    name: "request_approval",
    description: "Request human authority for a spend-committing or promotion action.",
    parameters: z.object({
      reason: z.string(),
    }),
    execute: async ({ reason }) =>
      traced(bridge, "request_approval", { result: reason }, async () => {
        return await bridge.requestApproval({ reason });
      }),
  });
}

export function createResolveApprovalTool(bridge: AgentBridge): Tool {
  return tool({
    name: "resolve_approval",
    description:
      "Resolve the pending approval for the current phase. During awaiting_promotion this is the promote_worker approval, not a historical spend approval. Contractor confirmation is impossible unless spend status becomes approved.",
    parameters: z.object({
      decision: z.enum(["approved", "rejected"]),
    }),
    execute: async ({ decision }) =>
      traced(bridge, "resolve_approval", { result: decision }, async () => {
        return await bridge.resolveApproval({ decision });
      }),
  });
}

export function createRecommendPromotionTool(bridge: AgentBridge): Tool {
  return tool({
    name: "recommend_promotion",
    description: "Recommend promotion or retention after verified successful work.",
    parameters: z.object({}),
    execute: async () =>
      traced(bridge, "recommend_promotion", {}, async () => {
        return await bridge.recommendPromotion();
      }),
  });
}

const WORKER_TOOL_BUILDERS: Record<string, (bridge: AgentBridge) => Tool> = {
  inspect_work: createInspectWorkTool,
  update_work_context: createUpdateWorkContextTool,
  send_message: createSendMessageTool,
  log_action: createLogActionTool,
  request_staffing: createRequestStaffingTool,
  verify_outcome: createVerifyOutcomeTool,
  solicit_options: createSolicitOptionsTool,
  record_option: createRecordOptionTool,
  evaluate_options: createEvaluateOptionsTool,
  report_recommendation: createReportRecommendationTool,
};

const MANAGER_TOOL_BUILDERS: Array<(bridge: AgentBridge) => Tool> = [
  createInspectWorkTool,
  createInspectWorkforceTool,
  createStaffWorkTool,
  createDelegateWorkerTool,
  createRequestApprovalTool,
  createResolveApprovalTool,
  createInspectOutcomeTool,
  createRecommendPromotionTool,
  createSendMessageTool,
  createLogActionTool,
];

export function toolsForPermissionIds(
  permissionIds: string[],
  bridge: AgentBridge,
): Tool[] {
  const names = new Set<string>();
  for (const permissionId of permissionIds) {
    const toolName = WORKER_TOOL_BY_PERMISSION[permissionId];
    if (toolName) {
      names.add(toolName);
    }
  }
  return [...names]
    .sort()
    .map((name) => WORKER_TOOL_BUILDERS[name]?.(bridge))
    .filter((item): item is Tool => Boolean(item));
}

export function managerTools(bridge: AgentBridge): Tool[] {
  return MANAGER_TOOL_BUILDERS.map((build) => build(bridge));
}
