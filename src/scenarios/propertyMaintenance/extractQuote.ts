export interface ExtractedContractorQuote {
  price: number | null;
  availability: string | null;
  rawMessage: string;
}

const PRICE_PATTERNS = [
  /(?:s\$|sgd|usd|\$)\s*(\d{2,5}(?:\.\d{1,2})?)/i,
  /\b(\d{2,5}(?:\.\d{1,2})?)\s*(?:sgd|dollars?|bucks)?\b/i,
];

const AVAILABILITY_PATTERN =
  /\b(today|tonight|tomorrow|this afternoon|this evening|this morning|asap|immediately|now|[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)|[0-9]{1,2}\s*(?:am|pm))\b/i;

/**
 * Deterministic fallback extractor. Prefer LLM output when available.
 */
export function extractContractorQuote(rawMessage: string): ExtractedContractorQuote {
  const text = rawMessage.replace(/\s+/g, " ").trim();
  let price: number | null = null;
  for (const pattern of PRICE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 10 && value <= 20000) {
        price = value;
        break;
      }
    }
  }

  const availabilityMatch = text.match(AVAILABILITY_PATTERN);
  const availability = availabilityMatch?.[1] ?? (text.length > 0 && price !== null ? text : null);

  return {
    price,
    availability,
    rawMessage: rawMessage.trim(),
  };
}

export function parseLlmQuoteJson(raw: string, fallbackMessage: string): ExtractedContractorQuote {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) {
      return extractContractorQuote(fallbackMessage);
    }
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null) {
      return extractContractorQuote(fallbackMessage);
    }
    const record = parsed as Record<string, unknown>;
    const price =
      typeof record.price === "number" && Number.isFinite(record.price) ? record.price : null;
    const availability =
      typeof record.availability === "string" && record.availability.trim()
        ? record.availability.trim()
        : null;
    if (price === null && availability === null) {
      return extractContractorQuote(fallbackMessage);
    }
    return {
      price,
      availability,
      rawMessage: fallbackMessage.trim(),
    };
  } catch {
    return extractContractorQuote(fallbackMessage);
  }
}
