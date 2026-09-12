/** Application-level inbound message after Twilio-specific fields are stripped. */
export interface ParsedInboundWhatsAppMessage {
  provider: "twilio";
  providerMessageId: string;
  channel: "whatsapp";
  direction: "inbound";
  /** Normalized E.164 — persist for correlation; never show in public UI. */
  participantAddress: string;
  body: string;
  profileName?: string;
}

export interface SendWhatsAppInput {
  /** E.164 or `whatsapp:+…` — adapter normalizes before calling Twilio. */
  to: string;
  body: string;
}

export interface TwilioOutboundConfig {
  accountSid: string;
  authToken: string;
  /** Twilio WhatsApp-enabled sender, e.g. `whatsapp:+14155238886`. */
  from: string;
}

export interface TwilioOutboundResult {
  provider: "twilio";
  providerMessageId: string;
  to: string;
  body: string;
  status: string;
}
