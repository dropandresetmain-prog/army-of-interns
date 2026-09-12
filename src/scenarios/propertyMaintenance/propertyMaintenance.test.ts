import { describe, expect, it } from "vitest";

import { parseOwnerCommand, isContractorDone } from "./commands";
import { extractContractorQuote } from "./extractQuote";
import { PROMOTION_SUCCESS_THRESHOLD } from "./identities";
import {
  canConfirmContractor,
  evaluateContractorOptions,
  interpretTenantVerificationFallback,
  isNegativeTenantVerification,
  isPromotionRecommended,
  isTenantVerification,
} from "./rankQuotes";
import { nextContractorIdentity, parseStartRole, resolveContractorRegistration } from "./registration";

describe("demo role registration", () => {
  it("parses /start payloads", () => {
    expect(parseStartRole("/start owner")).toBe("owner");
    expect(parseStartRole("/start@ArmyBot tenant")).toBe("tenant");
    expect(parseStartRole("/start contractor")).toBe("contractor");
    expect(parseStartRole("hello")).toBeNull();
  });

  it("assigns contractors A, B, then C", () => {
    expect(nextContractorIdentity(0)?.displayName).toBe("Contractor A");
    expect(nextContractorIdentity(1)?.displayName).toBe("Contractor B");
    expect(nextContractorIdentity(2)?.displayName).toBe("Contractor C");
    expect(nextContractorIdentity(3)).toBeNull();
  });

  it("reuses the same Telegram chat instead of consuming another contractor slot", () => {
    const first = resolveContractorRegistration({
      chatId: "chat-x",
      existingContractors: [],
    });
    expect(first).toEqual({
      action: "assign",
      identity: { displayName: "Contractor A", demoCallsign: "CONTRACTOR_A" },
    });

    const replay = resolveContractorRegistration({
      chatId: "chat-x",
      existingContractors: [{ telegramChatId: "chat-x", displayName: "Contractor A" }],
    });
    expect(replay).toEqual({ action: "reuse", displayName: "Contractor A" });

    const secondChat = resolveContractorRegistration({
      chatId: "chat-y",
      existingContractors: [{ telegramChatId: "chat-x", displayName: "Contractor A" }],
    });
    expect(secondChat).toMatchObject({
      action: "assign",
      identity: { displayName: "Contractor B" },
    });
  });
});

describe("contractor response extraction and ranking", () => {
  it("extracts price and availability from natural replies", () => {
    const extracted = extractContractorQuote("I can do it for S$130 at 4pm today");
    expect(extracted.price).toBe(130);
    expect(extracted.availability?.toLowerCase()).toMatch(/4pm|today/);
    expect(extracted.rawMessage).toContain("S$130");
  });

  it("rejects missed deadlines, prefers in-budget, then lower price", () => {
    const { ranked, winnerPersonId } = evaluateContractorOptions([
      {
        personId: "c1",
        price: 120,
        availability: "tomorrow morning",
        rawMessage: "120 tomorrow",
      },
      {
        personId: "c2",
        price: 140,
        availability: "4pm today",
        rawMessage: "140 today 4pm",
      },
      {
        personId: "c3",
        price: 200,
        availability: "today 2pm",
        rawMessage: "200 today",
      },
    ]);

    expect(ranked.find((item) => item.personId === "c1")?.viable).toBe(false);
    expect(winnerPersonId).toBe("c2");
    expect(ranked.find((item) => item.personId === "c2")?.withinBudget).toBe(true);
    expect(ranked.find((item) => item.personId === "c3")?.withinBudget).toBe(false);
  });
});

describe("approval, verification, and promotion invariants", () => {
  it("blocks contractor confirmation unless approval is approved", () => {
    expect(canConfirmContractor("pending")).toBe(false);
    expect(canConfirmContractor("rejected")).toBe(false);
    expect(canConfirmContractor("approved")).toBe(true);
  });

  it("does not treat contractor DONE as tenant verification", () => {
    expect(isContractorDone("DONE")).toBe(true);
    expect(isTenantVerification("DONE")).toBe(false);
    expect(isTenantVerification("yes fixed")).toBe(true);
    expect(isNegativeTenantVerification("still leaking")).toBe(true);
    expect(interpretTenantVerificationFallback("still leaking")).toBe(false);
    expect(interpretTenantVerificationFallback("all good now")).toBe(true);
    expect(interpretTenantVerificationFallback("maybe later")).toBeNull();
  });

  it("recommends promotion at the third successful assignment", () => {
    expect(isPromotionRecommended(2, PROMOTION_SUCCESS_THRESHOLD)).toBe(false);
    expect(isPromotionRecommended(3, PROMOTION_SUCCESS_THRESHOLD)).toBe(true);
  });

  it("parses owner commands", () => {
    expect(parseOwnerCommand("APPROVE")).toBe("APPROVE");
    expect(parseOwnerCommand("reject")).toBe("REJECT");
    expect(parseOwnerCommand("PROMOTE")).toBe("PROMOTE");
  });
});
