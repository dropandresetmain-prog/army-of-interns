import { describe, expect, it } from "vitest";

import { inboundAgentPrompt } from "./prompts";

describe("inbound clarification limits", () => {
  it("tells operations to ask one diagnostic question then request staffing", () => {
    const prompt = inboundAgentPrompt({
      kind: "operations",
      phase: "awaiting_tenant_diagnosis",
      roleType: "tenant",
      body: "My toilet leaks onto the floor when I flush.",
    });

    expect(prompt).toMatch(/at most one diagnostic question/i);
    expect(prompt).toContain("request_staffing");
    expect(prompt).toContain("vendor_sourcing");
    expect(prompt).toMatch(/Do not ask a second diagnostic question/);
  });

  it("tells procurement to record informal price and availability without interviewing", () => {
    const prompt = inboundAgentPrompt({
      kind: "procurement",
      phase: "soliciting_quotes",
      roleType: "contractor",
      body: "Can come around 4, probably 120 bucks.",
    });

    expect(prompt).toMatch(/do not interview/i);
    expect(prompt).toMatch(/record immediately/);
    expect(prompt).toMatch(/Maximum two clarification turns/);
    expect(prompt).toMatch(/One contractor is enough/);
  });

  it("tells Alex to act on clear owner intent without redundant confirmation", () => {
    const approval = inboundAgentPrompt({
      kind: "manager",
      phase: "awaiting_owner_approval",
      roleType: "business_owner",
      body: "yeah C is fine, go ahead",
    });
    expect(approval).toContain('resolve_approval({ decision: "approved" })');
    expect(approval).toMatch(/Do not ask redundant confirmation/);

    const promotion = inboundAgentPrompt({
      kind: "manager",
      phase: "awaiting_promotion",
      roleType: "business_owner",
      body: "yeah keep her",
    });
    expect(promotion).toContain("promote_worker");
    expect(promotion).toMatch(/yeah keep her/);
    expect(promotion).toMatch(/Do not seek redundant confirmation/);
  });
});
