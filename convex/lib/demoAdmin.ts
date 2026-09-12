import { ConvexError } from "convex/values";

/**
 * Shared gate for destructive demo mutations (bootstrap / reset).
 * Expects DEMO_ADMIN_SECRET on the Convex deployment; callers pass the same
 * value as `adminSecret`. Fail closed when the env var is unset.
 */
export function assertDemoAdminSecret(adminSecret: string): void {
  const expected = process.env.DEMO_ADMIN_SECRET;
  if (!expected) {
    throw new ConvexError(
      "DEMO_ADMIN_SECRET is not configured on this deployment",
    );
  }
  if (adminSecret !== expected) {
    throw new ConvexError("Unauthorized");
  }
}
