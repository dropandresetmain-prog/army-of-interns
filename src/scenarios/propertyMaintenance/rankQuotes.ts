import { DEMO_BUDGET } from "./identities";
import type { ExtractedContractorQuote } from "./extractQuote";

export interface RankableQuote extends ExtractedContractorQuote {
  personId: string;
  callsign?: string;
}

export interface RankedQuote {
  personId: string;
  callsign?: string;
  price: number | null;
  availability: string | null;
  rawMessage: string;
  meetsDeadline: boolean;
  withinBudget: boolean;
  viable: boolean;
  rank: number | null;
  rejectedReason?: string;
}

const MISSES_DEADLINE =
  /\b(tomorrow|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|unavailable|can'?t today|cannot today)\b/i;

const MEETS_DEADLINE =
  /\b(today|tonight|this afternoon|this evening|this morning|asap|immediately|now|[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm))\b/i;

export function quoteMeetsDeadline(availability: string | null): boolean {
  if (!availability) {
    return false;
  }
  if (MISSES_DEADLINE.test(availability) && !/\btoday\b/i.test(availability)) {
    return false;
  }
  return MEETS_DEADLINE.test(availability);
}

export function evaluateContractorOptions(
  quotes: RankableQuote[],
  budget = DEMO_BUDGET,
): { ranked: RankedQuote[]; winnerPersonId: string | null } {
  const evaluated: RankedQuote[] = quotes.map((quote) => {
    const meetsDeadline = quoteMeetsDeadline(quote.availability);
    const withinBudget =
      quote.price !== null && quote.price <= budget.amount;
    let rejectedReason: string | undefined;
    if (quote.price === null) {
      rejectedReason = "Could not extract a price.";
    } else if (!meetsDeadline) {
      rejectedReason = "Cannot meet the required deadline.";
    }
    return {
      personId: quote.personId,
      callsign: quote.callsign,
      price: quote.price,
      availability: quote.availability,
      rawMessage: quote.rawMessage,
      meetsDeadline,
      withinBudget,
      viable: Boolean(meetsDeadline && quote.price !== null),
      rank: null,
      rejectedReason,
    };
  });

  const viable = evaluated
    .filter((item) => item.viable)
    .sort((a, b) => {
      if (a.withinBudget !== b.withinBudget) {
        return Number(b.withinBudget) - Number(a.withinBudget);
      }
      return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
    });

  viable.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    ranked: evaluated,
    winnerPersonId: viable[0]?.personId ?? null,
  };
}

export function canConfirmContractor(approvalStatus: string): boolean {
  return approvalStatus === "approved";
}

export function isTenantVerification(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /\b(yes|fixed|resolved|all good|working|no leak|it's fine|its fine|confirmed)\b/.test(
      normalized,
    ) && !/\b(not|still leaking|nope|isn't)\b/.test(normalized)
  );
}

/** Runtime fallback only. The successful path uses the operations agent. */
export function isNegativeTenantVerification(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\b(still leaking|not fixed|same problem|started again|still broken|no,? same|isn't fixed|isnt fixed)\b/.test(
    normalized,
  );
}

export function interpretTenantVerificationFallback(text: string): boolean | null {
  if (isNegativeTenantVerification(text)) {
    return false;
  }
  if (isTenantVerification(text)) {
    return true;
  }
  return null;
}

export function isPromotionRecommended(
  successfulTasks: number,
  threshold = 3,
): boolean {
  return successfulTasks >= threshold;
}
