import { describe, expect, it } from "vitest";

import {
  allowedSendRoles,
  kindFromWorker,
  normalizeRoleType,
  resolveSendRole,
} from "./messageTargeting";

describe("message targeting lanes", () => {
  it("identifies Daniel's vendor sourcing worker as procurement", () => {
    expect(
      kindFromWorker({
        name: "Daniel",
        rank: "intern",
        capabilityKeys: ["vendor_sourcing"],
      }),
    ).toBe("procurement");
    expect(
      kindFromWorker({
        name: "Shu Zhen",
        rank: "employee",
        capabilityKeys: ["tenant_communications"],
      }),
    ).toBe("operations");
  });

  it("normalizes owner and contractor labels", () => {
    expect(normalizeRoleType("Business Owner")).toBe("business_owner");
    expect(normalizeRoleType("Tim")).toBe("business_owner");
    expect(normalizeRoleType("Contractor A")).toBe("contractor");
    expect(normalizeRoleType("tenant")).toBe("tenant");
  });

  it("keeps idle manager replies on the inbound sender", () => {
    expect(
      allowedSendRoles({
        kind: "manager",
        phase: "idle",
        inboundRoleType: "tenant",
      }),
    ).toEqual(["tenant"]);
    expect(
      resolveSendRole({
        kind: "manager",
        phase: "idle",
        inboundRoleType: "contractor",
      }),
    ).toEqual({ roleType: "contractor" });
  });

  it("rejects copying a tenant inbound to the owner", () => {
    const result = resolveSendRole({
      kind: "manager",
      phase: "idle",
      inboundRoleType: "tenant",
      requestedRoleType: "business_owner",
    });
    expect(result).toMatchObject({ error: expect.stringContaining("business_owner") });
  });

  it("lets operations message only the tenant during diagnosis", () => {
    expect(
      allowedSendRoles({
        kind: "operations",
        phase: "awaiting_tenant_diagnosis",
        inboundRoleType: "tenant",
      }),
    ).toEqual(["tenant"]);
    expect(
      resolveSendRole({
        kind: "operations",
        phase: "awaiting_tenant_diagnosis",
        inboundRoleType: "tenant",
        requestedRoleType: "owner",
      }),
    ).toMatchObject({ error: expect.any(String) });
  });

  it("lets Alex notify owner during approval and contractor plus tenant after approve", () => {
    expect(
      resolveSendRole({
        kind: "manager",
        phase: "awaiting_owner_approval",
        inboundRoleType: "business_owner",
        requestedRoleType: "owner",
      }),
    ).toEqual({ roleType: "business_owner" });
    expect(
      allowedSendRoles({
        kind: "manager",
        phase: "awaiting_contractor_done",
        inboundRoleType: "business_owner",
      }),
    ).toEqual(["contractor", "tenant"]);
  });

  it("keeps procurement send_message on the inbound contractor", () => {
    expect(
      resolveSendRole({
        kind: "procurement",
        phase: "soliciting_quotes",
        inboundRoleType: "contractor",
      }),
    ).toEqual({ roleType: "contractor" });
    expect(
      resolveSendRole({
        kind: "procurement",
        phase: "soliciting_quotes",
        inboundRoleType: "contractor",
        requestedRoleType: "tenant",
      }),
    ).toMatchObject({ error: expect.any(String) });
  });

  it("does not guess another stakeholder when the inbound role is out of lane", () => {
    expect(
      resolveSendRole({
        kind: "manager",
        phase: "soliciting_quotes",
        inboundRoleType: "tenant",
      }),
    ).toMatchObject({ error: expect.stringContaining("refusing to guess") });
  });
});
