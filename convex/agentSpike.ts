"use node";

import { Agent, Runner, tool } from "@openai/agents";
import { v } from "convex/values";
import { z } from "zod";

import { createOpenRouterProvider } from "../src/agents/openRouter";
import { action } from "./_generated/server";

const pingTool = tool({
  name: "ping",
  description: "Acknowledge a ping. Call this whenever you are asked to ping.",
  parameters: z.object({
    note: z.string().describe("Short acknowledgement token"),
  }),
  execute: async ({ note }) => {
    return { ok: true, executed: true, note };
  },
});

function summarizeItems(items: Array<{ type: string; rawItem?: unknown }>) {
  return items.map((item) => {
    const raw =
      item.rawItem && typeof item.rawItem === "object"
        ? (item.rawItem as Record<string, unknown>)
        : {};
    const name = typeof raw.name === "string" ? raw.name : undefined;
    return {
      type: item.type,
      name: name ?? null,
    };
  });
}

export const proveToolCall = action({
  args: {},
  returns: v.object({
    pass: v.boolean(),
    model: v.string(),
    toolCalled: v.boolean(),
    toolExecuted: v.boolean(),
    agentCompleted: v.boolean(),
    inferenceOccurred: v.boolean(),
    finalOutput: v.optional(v.string()),
    itemTypes: v.array(v.string()),
    toolNames: v.array(v.string()),
  }),
  handler: async () => {
    const { provider, model } = createOpenRouterProvider(process.env);
    const agent = new Agent({
      name: "Spike",
      instructions:
        "You are a compatibility probe. You MUST call the ping tool with note exactly 'sdk-ok'. After the tool result, reply with a short confirmation.",
      model,
      tools: [pingTool],
    });
    const runner = new Runner({
      modelProvider: provider,
      tracingDisabled: true,
    });

    const result = await runner.run(agent, "Please ping the system now.", {
      maxTurns: 4,
    });

    const items = summarizeItems(result.newItems);
    const toolNames = items
      .map((item) => item.name)
      .filter((name): name is string => Boolean(name));
    const toolCalled = items.some((item) => item.type === "tool_call_item");
    const toolExecuted = items.some((item) => item.type === "tool_call_output_item");
    const inferenceOccurred = result.rawResponses.length > 0;
    const finalOutput =
      typeof result.finalOutput === "string" ? result.finalOutput : undefined;
    const agentCompleted = Boolean(finalOutput) && toolCalled && toolExecuted;

    return {
      pass: agentCompleted && inferenceOccurred && toolNames.includes("ping"),
      model,
      toolCalled,
      toolExecuted,
      agentCompleted,
      inferenceOccurred,
      finalOutput,
      itemTypes: items.map((item) => item.type),
      toolNames,
    };
  },
});
