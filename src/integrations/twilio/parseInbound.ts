import { normalizeWhatsAppAddress } from "./phone";
import type { ParsedInboundWhatsAppMessage } from "./types";

function readParam(
  params: URLSearchParams | Record<string, string>,
  key: string,
): string | undefined {
  if (params instanceof URLSearchParams) {
    const value = params.get(key);
    return value === null || value === "" ? undefined : value;
  }
  const value = params[key];
  return value === undefined || value === "" ? undefined : value;
}

/**
 * Parse a Twilio WhatsApp webhook body into an application message.
 * Accepts URLSearchParams or a plain string record — never treat the Twilio
 * payload shape as the domain model beyond this boundary.
 */
export function parseTwilioInboundWhatsApp(
  params: URLSearchParams | Record<string, string>,
): ParsedInboundWhatsAppMessage {
  const providerMessageId =
    readParam(params, "MessageSid") ?? readParam(params, "SmsSid");
  const from = readParam(params, "From");
  const body = readParam(params, "Body") ?? "";
  const profileName = readParam(params, "ProfileName");

  if (!providerMessageId) {
    throw new Error("Twilio inbound webhook is missing MessageSid.");
  }
  if (!from) {
    throw new Error("Twilio inbound webhook is missing From.");
  }

  return {
    provider: "twilio",
    providerMessageId,
    channel: "whatsapp",
    direction: "inbound",
    participantAddress: normalizeWhatsAppAddress(from),
    body,
    profileName,
  };
}

export function parseTwilioInboundWhatsAppFromBody(rawBody: string): ParsedInboundWhatsAppMessage {
  return parseTwilioInboundWhatsApp(new URLSearchParams(rawBody));
}
