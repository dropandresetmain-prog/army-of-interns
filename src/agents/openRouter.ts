import { OpenAIProvider, setTracingDisabled } from "@openai/agents";

import { assertLiveAiEnabled } from "./liveAi";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";

export function readOpenRouterApiKey(env: Record<string, string | undefined> = process.env): string {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Run: npx convex env set OPENROUTER_API_KEY",
    );
  }
  return apiKey;
}

export function readOpenRouterModel(env: Record<string, string | undefined> = process.env): string {
  return env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

export function createOpenRouterProvider(env: Record<string, string | undefined> = process.env): {
  provider: OpenAIProvider;
  model: string;
} {
  assertLiveAiEnabled(env);
  setTracingDisabled(true);
  const provider = new OpenAIProvider({
    apiKey: readOpenRouterApiKey(env),
    baseURL: OPENROUTER_BASE_URL,
    useResponses: false,
  });
  return { provider, model: readOpenRouterModel(env) };
}
