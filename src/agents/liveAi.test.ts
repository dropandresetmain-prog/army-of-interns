import { describe, expect, it } from "vitest";

import {
  LIVE_AI_DISABLED_MESSAGE,
  assertLiveAiEnabled,
  isLiveAiEnabled,
} from "./liveAi";
import { createOpenRouterProvider } from "./openRouter";

describe("isLiveAiEnabled", () => {
  it("is false when unset", () => {
    expect(isLiveAiEnabled({})).toBe(false);
  });

  it("is false for empty, false, and other values", () => {
    expect(isLiveAiEnabled({ LIVE_AI_ENABLED: "" })).toBe(false);
    expect(isLiveAiEnabled({ LIVE_AI_ENABLED: "false" })).toBe(false);
    expect(isLiveAiEnabled({ LIVE_AI_ENABLED: "1" })).toBe(false);
    expect(isLiveAiEnabled({ LIVE_AI_ENABLED: "TRUE" })).toBe(false);
  });

  it("is true for exact true after trim", () => {
    expect(isLiveAiEnabled({ LIVE_AI_ENABLED: "true" })).toBe(true);
    expect(isLiveAiEnabled({ LIVE_AI_ENABLED: " true " })).toBe(true);
  });
});

describe("assertLiveAiEnabled", () => {
  it("throws a clear message when disabled", () => {
    expect(() => assertLiveAiEnabled({})).toThrow(LIVE_AI_DISABLED_MESSAGE);
  });

  it("does not throw when enabled", () => {
    expect(() => assertLiveAiEnabled({ LIVE_AI_ENABLED: "true" })).not.toThrow();
  });
});

describe("createOpenRouterProvider live AI gate", () => {
  it("refuses to build a provider when live AI is off even if a key is present", () => {
    expect(() =>
      createOpenRouterProvider({
        LIVE_AI_ENABLED: "false",
        OPENROUTER_API_KEY: "sk-test",
      }),
    ).toThrow(LIVE_AI_DISABLED_MESSAGE);
  });
});
