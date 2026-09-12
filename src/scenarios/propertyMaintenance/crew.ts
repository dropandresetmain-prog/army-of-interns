export const MAX_CONTRACTOR_SLOTS = 3;
export const MIN_CONTRACTORS_TO_RUN = 1;

/** Board always shows three contractor seats. */
export function contractorSlotsRequired(_joined?: number): number {
  return MAX_CONTRACTOR_SLOTS;
}

/** Rank when every joined contractor has quoted. One is enough; three is the cap. */
export function quotesNeededToRank(joinedContractors: number): number {
  if (joinedContractors <= 0) {
    return MIN_CONTRACTORS_TO_RUN;
  }
  return Math.min(MAX_CONTRACTOR_SLOTS, joinedContractors);
}

export function isContractorCrewReady(joined: number): boolean {
  return joined >= MIN_CONTRACTORS_TO_RUN;
}

export function isReadyToRank(input: {
  joinedContractors: number;
  recordedQuotes: number;
}): boolean {
  return (
    isContractorCrewReady(input.joinedContractors) &&
    input.recordedQuotes >= quotesNeededToRank(input.joinedContractors)
  );
}
