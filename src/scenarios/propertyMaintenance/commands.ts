export type OwnerCommand = "APPROVE" | "REJECT" | "PROMOTE";

export function parseOwnerCommand(text: string): OwnerCommand | null {
  const normalized = text.trim().toUpperCase();
  if (normalized === "APPROVE" || normalized === "/APPROVE") {
    return "APPROVE";
  }
  if (normalized === "REJECT" || normalized === "/REJECT") {
    return "REJECT";
  }
  if (normalized === "PROMOTE" || normalized === "/PROMOTE") {
    return "PROMOTE";
  }
  return null;
}

export function isContractorDone(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return normalized === "DONE" || normalized === "/DONE";
}

export function looksLikeWorkRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /\b(leak|leaking|toilet|pipe|broken|repair|maintenance|clog|flood|faucet)\b/.test(
      normalized,
    ) || normalized.length > 12
  );
}
