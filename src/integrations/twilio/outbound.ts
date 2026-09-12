import { normalizeWhatsAppAddress, toTwilioWhatsAppAddress } from "./phone";
import type {
  SendWhatsAppInput,
  TwilioOutboundConfig,
  TwilioOutboundResult,
} from "./types";

/** Portable base64 for Convex actions, browsers, and Node tests — no Node APIs. */
function encodeBasicAuth(username: string, password: string): string {
  const raw = `${username}:${password}`;
  if (typeof btoa === "function") {
    return btoa(raw);
  }
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < raw.length; i += 3) {
    const a = raw.charCodeAt(i);
    const b = i + 1 < raw.length ? raw.charCodeAt(i + 1) : Number.NaN;
    const c = i + 2 < raw.length ? raw.charCodeAt(i + 2) : Number.NaN;
    const bitmap = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
    output += chars.charAt((bitmap >> 18) & 63);
    output += chars.charAt((bitmap >> 12) & 63);
    output += Number.isNaN(b) ? "=" : chars.charAt((bitmap >> 6) & 63);
    output += Number.isNaN(c) ? "=" : chars.charAt(bitmap & 63);
  }
  return output;
}

export function validateSendWhatsAppInput(input: unknown): SendWhatsAppInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("Outbound WhatsApp input must be an object.");
  }

  const record = input as Record<string, unknown>;
  if (typeof record.to !== "string" || record.to.trim() === "") {
    throw new Error("Outbound WhatsApp requires a non-empty `to` address.");
  }
  if (typeof record.body !== "string" || record.body.trim() === "") {
    throw new Error("Outbound WhatsApp requires a non-empty `body`.");
  }

  // Normalize early so invalid numbers fail before any network call.
  normalizeWhatsAppAddress(record.to);

  return {
    to: record.to.trim(),
    body: record.body,
  };
}

export function readTwilioOutboundConfig(
  env: Record<string, string | undefined>,
): TwilioOutboundConfig {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const from = env.TWILIO_WHATSAPP_FROM?.trim();

  if (!accountSid) {
    throw new Error("TWILIO_ACCOUNT_SID is not configured.");
  }
  if (!authToken) {
    throw new Error("TWILIO_AUTH_TOKEN is not configured.");
  }
  if (!from) {
    throw new Error("TWILIO_WHATSAPP_FROM is not configured.");
  }

  return { accountSid, authToken, from: toTwilioWhatsAppAddress(from) };
}

export function buildTwilioWhatsAppForm(
  input: SendWhatsAppInput,
  from: string,
): URLSearchParams {
  const validated = validateSendWhatsAppInput(input);
  const form = new URLSearchParams();
  form.set("To", toTwilioWhatsAppAddress(validated.to));
  form.set("From", toTwilioWhatsAppAddress(from));
  form.set("Body", validated.body);
  return form;
}

export async function sendWhatsAppMessage(
  config: TwilioOutboundConfig,
  input: SendWhatsAppInput,
  fetchImpl: typeof fetch = fetch,
): Promise<TwilioOutboundResult> {
  const validated = validateSendWhatsAppInput(input);
  const form = buildTwilioWhatsAppForm(validated, config.from);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(config.accountSid, config.authToken)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `HTTP ${response.status}`;
    throw new Error(`Twilio WhatsApp send failed: ${detail}`);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { sid?: unknown }).sid !== "string"
  ) {
    throw new Error("Twilio WhatsApp send returned an unexpected payload.");
  }

  const result = payload as { sid: string; status?: string };
  return {
    provider: "twilio",
    providerMessageId: result.sid,
    to: normalizeWhatsAppAddress(validated.to),
    body: validated.body,
    status: typeof result.status === "string" ? result.status : "queued",
  };
}
