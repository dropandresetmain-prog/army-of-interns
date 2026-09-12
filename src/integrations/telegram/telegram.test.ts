import { describe, expect, it } from "vitest";

import {
  telegramIdempotencyKey,
  telegramParticipantAddress,
} from "./identity";
import { parseTelegramUpdate, parseTelegramUpdateFromBody } from "./parseUpdate";
import {
  readTelegramOutboundConfig,
  sendTelegramMessage,
  setTelegramWebhook,
  validateSendTelegramInput,
} from "./outbound";

const SAMPLE_UPDATE = {
  update_id: 9001,
  message: {
    message_id: 17,
    from: { id: 555, first_name: "Ada", last_name: "Lovelace" },
    chat: { id: 555, type: "private" },
    text: "hello from telegram",
  },
};

describe("Telegram inbound parsing", () => {
  it("maps a Bot API update into an application message", () => {
    const parsed = parseTelegramUpdate(SAMPLE_UPDATE);
    expect(parsed).toEqual({
      provider: "telegram",
      providerMessageId: "9001",
      channel: "telegram",
      direction: "inbound",
      participantAddress: "tg:555",
      chatId: "555",
      telegramUserId: "555",
      body: "hello from telegram",
      displayNameHint: "Ada Lovelace",
      isPrivateChat: true,
      updateId: 9001,
    });
  });

  it("uses update_id as the idempotency key", () => {
    const first = parseTelegramUpdateFromBody(JSON.stringify(SAMPLE_UPDATE));
    const second = parseTelegramUpdateFromBody(JSON.stringify(SAMPLE_UPDATE));
    expect(first.providerMessageId).toBe(second.providerMessageId);
    expect(telegramIdempotencyKey(9001)).toBe("9001");
    expect(telegramParticipantAddress(555)).toBe("tg:555");
  });

  it("rejects group chats as non-private and missing update_id", () => {
    const group = parseTelegramUpdate({
      update_id: 2,
      message: {
        chat: { id: -100, type: "group" },
        text: "nope",
      },
    });
    expect(group.isPrivateChat).toBe(false);
    expect(() => parseTelegramUpdate({ message: { chat: { id: 1, type: "private" } } })).toThrow(
      /update_id/,
    );
  });
});

describe("Telegram outbound adapter", () => {
  it("validates application-level send inputs", () => {
    expect(() => validateSendTelegramInput(null)).toThrow(/object/);
    expect(() => validateSendTelegramInput({ chatId: "", body: "x" })).toThrow(/chatId/);
    expect(() => validateSendTelegramInput({ chatId: "1", body: "  " })).toThrow(/`body`/);
    expect(validateSendTelegramInput({ chatId: 42, body: "hi" })).toEqual({
      chatId: "42",
      body: "hi",
    });
  });

  it("requires TELEGRAM_BOT_TOKEN", () => {
    expect(() => readTelegramOutboundConfig({})).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it("sends through Telegram and returns a provider message id", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/sendMessage");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(JSON.stringify(body)).not.toContain("SECRETTOKEN");
      expect(body).toEqual({ chat_id: "555", text: "pong" });
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 88, chat: { id: 555 } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const result = await sendTelegramMessage(
      { botToken: "SECRETTOKEN" },
      { chatId: "555", body: "pong" },
      fetchImpl,
    );

    expect(result).toEqual({
      provider: "telegram",
      providerMessageId: "out:88",
      chatId: "555",
      body: "pong",
      status: "sent",
    });
  });

  it("configures the webhook URL without returning the token", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/setWebhook");
      const body = JSON.parse(String(init?.body));
      expect(JSON.stringify(body)).not.toContain("SECRETTOKEN");
      expect(body.url).toBe("https://example.convex.site/telegram/webhook");
      return new Response(JSON.stringify({ ok: true, result: true, description: "Webhook was set" }), {
        status: 200,
      });
    };

    const result = await setTelegramWebhook(
      { botToken: "SECRETTOKEN" },
      "https://example.convex.site/telegram/webhook",
      fetchImpl,
    );
    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://example.convex.site/telegram/webhook");
  });
});
