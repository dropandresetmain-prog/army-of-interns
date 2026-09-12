/** Stable correlation key for a Telegram chat. Not for public display. */
export function telegramParticipantAddress(chatId: string | number): string {
  return `tg:${String(chatId)}`;
}

export function telegramIdempotencyKey(updateId: number): string {
  if (!Number.isFinite(updateId)) {
    throw new Error("Telegram update_id is required for idempotency.");
  }
  return String(updateId);
}

export function participantDisplayHint(displayName?: string, chatId?: string): string {
  if (displayName?.trim()) {
    return displayName.trim();
  }
  const digits = (chatId ?? "").replace(/\D/g, "");
  return `Participant …${digits.slice(-4) || "????"}`;
}
