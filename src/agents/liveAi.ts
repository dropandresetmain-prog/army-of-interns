/**
 * Fail-closed gate for OpenRouter / live LLM spend.
 * Only the exact string "true" enables live AI; unset/false/other = off.
 */
export const LIVE_AI_ENABLED_ENV = "LIVE_AI_ENABLED";

export const LIVE_AI_DISABLED_MESSAGE =
  "Live AI is disabled (LIVE_AI_ENABLED is not true). Deterministic fallback will be used.";

export function isLiveAiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[LIVE_AI_ENABLED_ENV]?.trim() === "true";
}

export function assertLiveAiEnabled(env: Record<string, string | undefined> = process.env): void {
  if (!isLiveAiEnabled(env)) {
    throw new Error(LIVE_AI_DISABLED_MESSAGE);
  }
}
