import { describe, expect, it } from "vitest";

import {
  normalizeWhatsAppAddress,
  participantDisplayHint,
  toTwilioWhatsAppAddress,
} from "./phone";
import { parseTwilioInboundWhatsApp, parseTwilioInboundWhatsAppFromBody } from "./parseInbound";
import {
  buildTwilioWhatsAppForm,
  readTwilioOutboundConfig,
  sendWhatsAppMessage,
  validateSendWhatsAppInput,
} from "./outbound";

describe("Twilio phone normalization", () => {
  it("strips the whatsapp: prefix and keeps E.164", () => {
    expect(normalizeWhatsAppAddress("whatsapp:+14155552671")).toBe("+14155552671");
    expect(toTwilioWhatsAppAddress("+14155552671")).toBe("whatsapp:+14155552671");
  });

  it("rejects empty and non-numeric addresses", () => {
    expect(() => normalizeWhatsAppAddress("")).toThrow(/required/i);
    expect(() => normalizeWhatsAppAddress("whatsapp:not-a-phone")).toThrow(/phone number/i);
  });

  it("never exposes the full number in display hints", () => {
    expect(participantDisplayHint("whatsapp:+14155552671")).toBe("Participant …2671");
    expect(participantDisplayHint("+14155552671")).not.toContain("415555");
  });
});

describe("Twilio inbound parsing", () => {
  it("maps Twilio form fields into an application message", () => {
    const parsed = parseTwilioInboundWhatsAppFromBody(
      [
        "MessageSid=SM123abc",
        "From=" + encodeURIComponent("whatsapp:+6591112222"),
        "Body=" + encodeURIComponent("hello"),
        "ProfileName=" + encodeURIComponent("Demo Tenant"),
      ].join("&"),
    );

    expect(parsed).toEqual({
      provider: "twilio",
      providerMessageId: "SM123abc",
      channel: "whatsapp",
      direction: "inbound",
      participantAddress: "+6591112222",
      body: "hello",
      profileName: "Demo Tenant",
    });
  });

  it("accepts SmsSid as a fallback identifier", () => {
    const parsed = parseTwilioInboundWhatsApp({
      SmsSid: "SM999",
      From: "whatsapp:+10001112222",
      Body: "",
    });
    expect(parsed.providerMessageId).toBe("SM999");
    expect(parsed.body).toBe("");
  });

  it("fails when MessageSid or From is missing", () => {
    expect(() =>
      parseTwilioInboundWhatsApp({ From: "whatsapp:+10001112222", Body: "hi" }),
    ).toThrow(/MessageSid/);
    expect(() =>
      parseTwilioInboundWhatsApp({ MessageSid: "SM1", Body: "hi" }),
    ).toThrow(/From/);
  });
});

describe("outbound WhatsApp adapter", () => {
  it("validates application-level send inputs", () => {
    expect(() => validateSendWhatsAppInput(null)).toThrow(/object/);
    expect(() => validateSendWhatsAppInput({ to: "", body: "x" })).toThrow(/`to`/);
    expect(() => validateSendWhatsAppInput({ to: "+10001112222", body: "  " })).toThrow(
      /`body`/,
    );
    expect(validateSendWhatsAppInput({ to: "whatsapp:+10001112222", body: "hi" })).toEqual({
      to: "whatsapp:+10001112222",
      body: "hi",
    });
  });

  it("requires Twilio env configuration", () => {
    expect(() => readTwilioOutboundConfig({})).toThrow(/TWILIO_ACCOUNT_SID/);
    expect(() =>
      readTwilioOutboundConfig({
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_AUTH_TOKEN: "token",
      }),
    ).toThrow(/TWILIO_WHATSAPP_FROM/);
    expect(
      readTwilioOutboundConfig({
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_WHATSAPP_FROM: "+14155238886",
      }).from,
    ).toBe("whatsapp:+14155238886");
  });

  it("builds a Twilio form without leaking app-level naming", () => {
    const form = buildTwilioWhatsAppForm(
      { to: "+10001112222", body: "Army of Interns test 🫡" },
      "whatsapp:+14155238886",
    );
    expect(form.get("To")).toBe("whatsapp:+10001112222");
    expect(form.get("From")).toBe("whatsapp:+14155238886");
    expect(form.get("Body")).toBe("Army of Interns test 🫡");
  });

  it("sends through Twilio and returns the provider message id", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(String(init?.headers && (init.headers as Record<string, string>).Authorization)).toMatch(
        /^Basic /,
      );
      expect(String(init?.body)).toContain("Body=Army+of+Interns+test");
      return new Response(JSON.stringify({ sid: "SMoutbound1", status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await sendWhatsAppMessage(
      {
        accountSid: "ACtest",
        authToken: "secret",
        from: "whatsapp:+14155238886",
      },
      { to: "+6590001111", body: "Army of Interns test 🫡" },
      fetchImpl,
    );

    expect(result).toEqual({
      provider: "twilio",
      providerMessageId: "SMoutbound1",
      to: "+6590001111",
      body: "Army of Interns test 🫡",
      status: "queued",
    });
  });
});

describe("duplicate inbound identity", () => {
  it("treats MessageSid as the stable idempotency key", () => {
    const first = parseTwilioInboundWhatsAppFromBody(
      "MessageSid=SM_SAME&From=whatsapp%3A%2B15551212&Body=hello",
    );
    const second = parseTwilioInboundWhatsAppFromBody(
      "MessageSid=SM_SAME&From=whatsapp%3A%2B15551212&Body=hello",
    );
    expect(first.providerMessageId).toBe(second.providerMessageId);
    expect(first.providerMessageId).toBe("SM_SAME");
  });
});
