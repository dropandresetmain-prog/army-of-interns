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
    })),
    people: snapshot.people.map((person) => ({
      name: person.displayName,
      role: person.roleType,
      callsign: person.demoCallsign ?? null,
    })),
    approval: snapshot.approval ?? null,
    quotes: snapshot.quotes,
    messages,
    events,
    pendingStaffingCapabilityKeys: snapshot.pendingStaffingCapabilityKeys,
  });
}

function sharedRules(): string {
  return [
    "You are a real worker with a persisted identity. Decide what to do, then call a permitted tool.",
    "Compose concise human-facing Telegram messages yourself. Do not narrate agent architecture.",
    "If information is missing, ask one useful question. Do not invent facts, prices, or approvals.",
    "Only use tools you actually have. Application code enforces permissions, approvals, and ranking.",
    "Keep replies short enough for messaging.",
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
        "After a worker reports a recommendation, request approval. After verified success, consider promotion.",
        "Do not contain scenario-specific trade instructions. Use the supplied runtime context.",
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
