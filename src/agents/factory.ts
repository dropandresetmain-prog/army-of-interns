import { Agent, type Tool } from "@openai/agents";

import type { AgentBridge } from "./bridge";
import { readOpenRouterModel } from "./openRouter";
import { isManagerWorker } from "./permissions";
import { managerTools, toolsForPermissionIds } from "./tools";
import type { RuntimeSnapshot, RuntimeWorker } from "./types";

const MAX_HISTORY = 6;
const MAX_BODY = 200;

export function toolNamesOf(agent: Agent): string[] {
  return agent.tools
    .map((item) => ("name" in item && typeof item.name === "string" ? item.name : ""))
    .filter((name) => name.length > 0)
    .sort();
}

function compactSnapshot(snapshot: RuntimeSnapshot): string {
  const messages = snapshot.recentMessages.slice(-MAX_HISTORY).map((message) => ({
    direction: message.direction,
    role: message.roleType ?? message.personDisplayName,
    body: message.body.slice(0, MAX_BODY),
  }));
  const events = snapshot.recentEvents.slice(-8).map((event) => event.summary);
  return JSON.stringify({
    company: snapshot.companyName,
    companyDescription: snapshot.companyDescription,
    phase: snapshot.phase,
    workItem: snapshot.workItem,
    actor: snapshot.actor
      ? {
          name: snapshot.actor.name,
          title: snapshot.actor.title,
          permissions: snapshot.actor.toolPermissionIds,
        }
      : null,
    workers: snapshot.workers.map((worker) => ({
      name: worker.name,
      title: worker.title,
      status: worker.status,
      capabilities: worker.capabilityKeys,
      successfulTasks: worker.successfulTasks,
      promotionEligible: worker.promotionEligible,
    })),
    people: snapshot.people.map((person) => ({
      name: person.displayName,
      role: person.roleType,
      callsign: person.demoCallsign ?? null,
    })),
    approval: snapshot.approval ?? null,
    selectedContractorPersonId: snapshot.selectedContractorPersonId ?? null,
    tenantPersonId: snapshot.tenantPersonId ?? null,
    quotes: snapshot.quotes,
    messages,
    events,
    pendingStaffingCapabilityKeys: snapshot.pendingStaffingCapabilityKeys,
  });
}

function sharedRules(): string {
  return [
    "You are a real worker with a persisted identity. Decide what to do, then call a permitted tool.",
    "Default to action over conversation. Humans may speak naturally; do not sound robotic.",
    "Ask only information necessary for the next material decision. Ask one concise question at a time.",
    "Ask at most two clarification turns for the same missing information. Prefer one question whenever possible.",
    "Do not repeat questions already answered. Do not ask for information already available in runtime context.",
    "After enough information exists to proceed, use tools immediately. Do not keep asking merely to improve certainty.",
    "If something remains uncertain after two clarification turns, make the safest reasonable assumption, proceed, or escalate only if authority is genuinely required.",
    "Do not invent facts, prices, or approvals.",
    "Compose concise human-facing Telegram messages yourself. Keep them to 1-2 sentences. Do not narrate agent architecture.",
    "Only use tools you actually have. Application code enforces permissions, approvals, and ranking.",
    "Call at most three tools, then stop. Do not re-inspect or repeat the same message.",
  ].join("\n");
}

export function instructionsForWorker(
  worker: RuntimeWorker,
  snapshot: RuntimeSnapshot,
): string {
  const roleBlock = isManagerWorker(worker)
    ? [
        `${worker.name} is the General Manager. Permanent. Calm, concise, pragmatic, lightly cheeky.`,
        "Manage outcomes. Staff once, then delegate_worker once. Do not keep inspecting.",
        "Interpret human messages yourself. Exact APPROVE, REJECT, PROMOTE, or DONE are optional shortcuts, not required.",
        "After a worker reports a recommendation, request approval and send_message the Business Owner.",
        "After an approved spend, send_message the selected contractor and tenant. Never notify a contractor before approval.",
        "After verified success, if a worker is promotion-eligible, call recommend_promotion and send_message the owner a natural recommendation.",
        "Be the least chatty worker. If owner intent is reasonably clear, act immediately. Do not invent approvals.",
        'Do not ask redundant confirmation such as "Just to confirm, would you like me to proceed?"',
        "If owner intent is genuinely ambiguous, send_message one concise clarification. Then stop.",
        "Do not include internal IDs in human-facing messages. Use the supplied runtime context.",
      ].join("\n")
    : [
        `You are ${worker.name}, ${worker.title} (${worker.employmentType}).`,
        `Personality: ${worker.personality}`,
        `Communication: ${worker.communicationStyle}`,
        ...worker.standingInstructions.map((line) => `- ${line}`),
      ].join("\n");

  return `${roleBlock}\n\n${sharedRules()}\n\nRuntime context:\n${compactSnapshot(snapshot)}`;
}

export function createWorkerAgent(
  worker: RuntimeWorker,
  bridge: AgentBridge,
  snapshot: RuntimeSnapshot,
  extraTools: Tool[] = [],
): Agent {
  const model = readOpenRouterModel();
  const tools = isManagerWorker(worker)
    ? [...managerTools(bridge), ...extraTools]
    : [...toolsForPermissionIds(worker.toolPermissionIds, bridge), ...extraTools];

  return new Agent({
    name: worker.name,
    instructions: instructionsForWorker(worker, snapshot),
    model,
    tools,
  });
}

export function createManagerAgent(
  worker: RuntimeWorker,
  bridge: AgentBridge,
  snapshot: RuntimeSnapshot,
  subordinates: RuntimeWorker[] = [],
): Agent {
  const extraTools = subordinates
    .filter((subordinate) => !isManagerWorker(subordinate))
    .map((subordinate) => {
      const workerAgent = createWorkerAgent(subordinate, bridge, snapshot);
      return workerAgent.asTool({
        toolName: `delegate_${subordinate.name.toLowerCase().replace(/\s+/g, "_")}`,
        toolDescription: `Delegate a bounded task to ${subordinate.name} (${subordinate.title}). They remain a real Agent.`,
      });
    });
  return createWorkerAgent(worker, bridge, snapshot, extraTools);
}
