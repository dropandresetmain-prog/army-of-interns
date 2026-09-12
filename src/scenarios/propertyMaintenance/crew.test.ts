import { describe, expect, it } from "vitest";

import {
  contractorSlotsRequired,
  isContractorCrewReady,
  isReadyToRank,
  quotesNeededToRank,
} from "./crew";

describe("short contractor crew", () => {
  it("always displays three contractor seats", () => {
    expect(contractorSlotsRequired(0)).toBe(3);
    expect(contractorSlotsRequired(1)).toBe(3);
    expect(contractorSlotsRequired(2)).toBe(3);
    expect(contractorSlotsRequired(8)).toBe(3);
  });

  it("can run with one contractor, without shrinking the board to 1/1", () => {
    expect(isContractorCrewReady(0)).toBe(false);
    expect(isContractorCrewReady(1)).toBe(true);
    expect(quotesNeededToRank(1)).toBe(1);
    expect(isReadyToRank({ joinedContractors: 1, recordedQuotes: 1 })).toBe(true);
  });

  it("ranks when every joined contractor has quoted, even if that is two of three", () => {
    expect(quotesNeededToRank(2)).toBe(2);
    expect(isReadyToRank({ joinedContractors: 2, recordedQuotes: 1 })).toBe(false);
    expect(isReadyToRank({ joinedContractors: 2, recordedQuotes: 2 })).toBe(true);
  });
});
