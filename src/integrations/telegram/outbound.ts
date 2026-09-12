import type {
  SendTelegramInput,
  TelegramOutboundConfig,
  TelegramOutboundResult,
} from "./types";

export function validateSendTelegramInput(input: unknown): SendTelegramInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("Outbound Telegram input must be an object.");
  }

  const record = input as Record<string, unknown>;
  if (
    (typeof record.chatId !== "string" && typeof record.chatId !== "number") ||
    String(record.chatId).trim() === ""
  ) {
    throw new Error("Outbound Telegram requires a non-empty `chatId`.");
  }
  if (typeof record.body !== "string" || record.body.trim() === "") {
    throw new Error("Outbound Telegram requires a non-empty `body`.");
  }

  return {
    chatId: String(record.chatId).trim(),
    body: record.body,
  };
}

export function readTelegramBotToken(env: Record<string, string | undefined>): string {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }
  return token;
}

export function readTelegramOutboundConfig(
  env: Record<string, string | undefined>,
): TelegramOutboundConfig {
  return { botToken: readTelegramBotToken(env) };
}

function telegramApiUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

export async function sendTelegramMessage(
  config: TelegramOutboundConfig,
  input: SendTelegramInput,
  fetchImpl: typeof fetch = fetch,
): Promise<TelegramOutboundResult> {
  const validated = validateSendTelegramInput(input);
  const response = await fetchImpl(telegramApiUrl(config.botToken, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: validated.chatId,
      text: validated.body,
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const ok = record?.ok === true;
  const result = record?.result && typeof record.result === "object"
    ? (record.result as Record<string, unknown>)
    : null;

  if (!response.ok || !ok || !result) {
    const description =
      record && typeof record.description === "string"
        ? record.description
        : `HTTP ${response.status}`;
    throw new Error(`Telegram sendMessage failed: ${description}`);
  }

  const messageId = result.message_id;
  if (typeof messageId !== "number") {
    throw new Error("Telegram sendMessage returned an unexpected payload.");
  }

  return {
    provider: "telegram",
    providerMessageId: `out:${messageId}`,
    chatId: validated.chatId,
    body: validated.body,
    status: "sent",
  };
}

export async function setTelegramWebhook(
  config: TelegramOutboundConfig,
  webhookUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; url: string; description?: string }> {
  if (!webhookUrl.startsWith("https://")) {
    throw new Error("Telegram webhook URL must be https.");
  }

  const response = await fetchImpl(telegramApiUrl(config.botToken, "setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const description = typeof record?.description === "string" ? record.description : undefined;

  if (!response.ok || record?.ok !== true) {
    throw new Error(`Telegram setWebhook failed: ${description ?? `HTTP ${response.status}`}`);
  }

  return { ok: true, url: webhookUrl, description };
}

export async function getTelegramBotIdentity(
  config: TelegramOutboundConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ username?: string; firstName?: string }> {
  const response = await fetchImpl(telegramApiUrl(config.botToken, "getMe"));
  const payload: unknown = await response.json().catch(() => null);
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const result = record?.result && typeof record.result === "object"
    ? (record.result as Record<string, unknown>)
    : null;

  if (!response.ok || record?.ok !== true || !result) {
    throw new Error("Telegram getMe failed.");
  }

  return {
    username: typeof result.username === "string" ? result.username : undefined,
    firstName: typeof result.first_name === "string" ? result.first_name : undefined,
  };
}
