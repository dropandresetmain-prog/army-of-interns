import { telegramIdempotencyKey, telegramParticipantAddress } from "./identity";
import type { ParsedInboundTelegramMessage } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string): string | undefined {
  if (!record) {
    return undefined;
  }
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | undefined {
  if (!record) {
    return undefined;
  }
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Parse a Telegram Bot API update into an application message.
 * Telegram payload shapes stop at this boundary.
 */
export function parseTelegramUpdate(update: unknown): ParsedInboundTelegramMessage {
  const root = asRecord(update);
  if (!root) {
    throw new Error("Telegram update must be an object.");
  }

  const updateId = readNumber(root, "update_id");
  if (updateId === undefined) {
    throw new Error("Telegram update is missing update_id.");
  }

  const message =
    asRecord(root.message) ??
    asRecord(root.edited_message) ??
    asRecord(root.channel_post);

  if (!message) {
    throw new Error("Telegram update does not contain a message.");
  }

  const chat = asRecord(message.chat);
  const from = asRecord(message.from);
  const chatIdValue = chat?.id;
  if (typeof chatIdValue !== "number" && typeof chatIdValue !== "string") {
    throw new Error("Telegram message is missing chat.id.");
  }

  const chatId = String(chatIdValue);
  const chatType = readString(chat, "type") ?? "";
  const isPrivateChat = chatType === "private";

  const body =
    readString(message, "text") ??
    readString(message, "caption") ??
    "";

  const firstName = readString(from, "first_name");
  const lastName = readString(from, "last_name");
  const displayNameHint = [firstName, lastName].filter(Boolean).join(" ") || undefined;

  const userId = from?.id;
  const telegramUserId =
    typeof userId === "number" || typeof userId === "string" ? String(userId) : undefined;

  return {
    provider: "telegram",
    providerMessageId: telegramIdempotencyKey(updateId),
    channel: "telegram",
    direction: "inbound",
    participantAddress: telegramParticipantAddress(chatId),
    chatId,
    telegramUserId,
    body,
    displayNameHint,
    isPrivateChat,
    updateId,
  };
}

export function parseTelegramUpdateFromBody(rawBody: string): ParsedInboundTelegramMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error("Telegram webhook body is not valid JSON.");
  }
  return parseTelegramUpdate(parsed);
}
