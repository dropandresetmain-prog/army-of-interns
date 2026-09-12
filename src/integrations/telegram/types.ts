/** Application-level inbound message after Telegram-specific fields are stripped. */
export interface ParsedInboundTelegramMessage {
  provider: "telegram";
  providerMessageId: string;
  channel: "telegram";
  direction: "inbound";
  /** Opaque chat key for correlation — persist; do not expose in public UI. */
  participantAddress: string;
  chatId: string;
  telegramUserId?: string;
  body: string;
  displayNameHint?: string;
  isPrivateChat: boolean;
  updateId: number;
}

export interface SendTelegramInput {
  chatId: string;
  body: string;
}

export interface TelegramOutboundConfig {
  botToken: string;
}

export interface TelegramOutboundResult {
  provider: "telegram";
  providerMessageId: string;
  chatId: string;
  body: string;
  status: string;
}
