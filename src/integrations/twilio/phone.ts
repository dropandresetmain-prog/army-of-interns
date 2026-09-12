/**
 * Normalize WhatsApp/Twilio participant addresses to E.164 for correlation.
 * Never display these values in public UI.
 */
export function normalizeWhatsAppAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Participant address is required.");
  }

  const withoutChannel = trimmed.replace(/^whatsapp:/i, "").trim();
  if (!withoutChannel) {
    throw new Error("Participant address is empty after removing the WhatsApp prefix.");
  }

  if (!/^\+?[0-9]+$/.test(withoutChannel)) {
    throw new Error("Participant address must be a phone number.");
  }

  return withoutChannel.startsWith("+") ? withoutChannel : `+${withoutChannel}`;
}

export function toTwilioWhatsAppAddress(e164OrWhatsApp: string): string {
  const e164 = normalizeWhatsAppAddress(e164OrWhatsApp);
  return `whatsapp:${e164}`;
}

/** Safe display label for internal tooling — never the full number. */
export function participantDisplayHint(e164: string): string {
  const digits = normalizeWhatsAppAddress(e164).replace(/\D/g, "");
  const tail = digits.slice(-4) || "????";
  return `Participant …${tail}`;
}
