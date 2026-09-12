import {
  CONTRACTOR_CALLSIGNS,
  CONTRACTOR_LABELS,
  DEMO_OWNER,
  DEMO_TENANT,
  type DemoRole,
} from "./identities";

export function parseStartRole(text: string): DemoRole | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/i);
  if (!match) {
    return null;
  }
  const payload = (match[1] ?? "").trim().toLowerCase();
  if (payload === "owner" || payload === "tim") {
    return "owner";
  }
  if (payload === "tenant") {
    return "tenant";
  }
  if (payload === "contractor" || payload.startsWith("contractor")) {
    return "contractor";
  }
  return null;
}

export function nextContractorIdentity(existingContractorCount: number): {
  displayName: string;
  demoCallsign: (typeof CONTRACTOR_CALLSIGNS)[number];
} | null {
  if (existingContractorCount >= CONTRACTOR_CALLSIGNS.length) {
    return null;
  }
  return {
    displayName: CONTRACTOR_LABELS[existingContractorCount]!,
    demoCallsign: CONTRACTOR_CALLSIGNS[existingContractorCount]!,
  };
}

export function resolveContractorRegistration(input: {
  chatId: string;
  existingContractors: Array<{ telegramChatId?: string; displayName: string }>;
}):
  | { action: "reuse"; displayName: string }
  | { action: "assign"; identity: NonNullable<ReturnType<typeof nextContractorIdentity>> }
  | { action: "full" } {
  const already = input.existingContractors.find(
    (person) => person.telegramChatId === input.chatId,
  );
  if (already) {
    return { action: "reuse", displayName: already.displayName };
  }
  const identity = nextContractorIdentity(input.existingContractors.length);
  if (!identity) {
    return { action: "full" };
  }
  return { action: "assign", identity };
}

export function registrationProfile(role: DemoRole): {
  displayName: string;
  roleType: string;
  demoCallsign: string;
} {
  if (role === "owner") {
    return { ...DEMO_OWNER };
  }
  if (role === "tenant") {
    return { ...DEMO_TENANT };
  }
  return {
    displayName: "Contractor",
    roleType: "contractor",
    demoCallsign: "CONTRACTOR",
  };
}
