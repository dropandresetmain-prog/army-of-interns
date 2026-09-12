import assert from "node:assert/strict";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

if (!deploymentUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required. Run Convex locally first.");
}
if (!siteUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required for webhook verification.");
}

const client = new ConvexHttpClient(deploymentUrl);
const adminSecret = process.env.DEMO_ADMIN_SECRET;
if (!adminSecret) {
  throw new Error("DEMO_ADMIN_SECRET is required. Set it in .env.local and Convex env.");
}
const bootstrapDemo = makeFunctionReference("seed:bootstrapDemo");
const listMessages = makeFunctionReference("messaging:listRecent");
const listEvents = makeFunctionReference("events:list");
const listWorkers = makeFunctionReference("workers:list");
const simulateInbound = makeFunctionReference("messaging:simulateInbound");
const insertRealtimeProbe = makeFunctionReference("messaging:insertRealtimeProbe");
const createRealtimeProbe = makeFunctionReference("workers:createRealtimeProbe");

await client.mutation(bootstrapDemo, { adminSecret });

const sid = `SM_S2_VERIFY_${Date.now()}`;
const participant = `+1555${String(Date.now()).slice(-7)}`;

const first = await client.mutation(simulateInbound, {
  providerMessageId: sid,
  participantAddress: participant,
  body: "hello",
  profileName: "S2 Verify",
});
assert.equal(first.outcome, "accepted");
assert.ok(first.personId);
assert.ok(first.eventId);

const duplicate = await client.mutation(simulateInbound, {
  providerMessageId: sid,
  participantAddress: participant,
  body: "hello again should be ignored",
  profileName: "S2 Verify",
});
assert.equal(duplicate.outcome, "duplicate");
assert.equal(duplicate.messageId, first.messageId);
assert.equal(duplicate.eventId, undefined);

const messages = await client.query(listMessages, {});
const matched = messages.filter((message) => message.providerMessageId === sid);
assert.equal(matched.length, 1);
assert.equal(matched[0].body, "hello");
assert.equal(matched[0].personDisplayName, "S2 Verify");
assert.equal(
  Object.prototype.hasOwnProperty.call(matched[0], "participantAddress"),
  false,
  "Public message projection must not expose phone numbers.",
);

const eventsBefore = await client.query(listEvents, {});
const inboundEvents = eventsBefore.filter(
  (event) =>
    event.eventType === "human_response_received" &&
    event.metadata?.providerMessageId === sid,
);
assert.equal(inboundEvents.length, 1, "Duplicate delivery must not emit a second event.");

const webhookBody = new URLSearchParams({
  MessageSid: `SM_HTTP_${Date.now()}`,
  From: `whatsapp:${participant}`,
  Body: "hello",
  ProfileName: "S2 HTTP",
});
const webhookResponse = await fetch(`${siteUrl}/twilio/whatsapp`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: webhookBody.toString(),
});
assert.equal(webhookResponse.status, 200);
assert.equal(await webhookResponse.text(), "accepted");

const webhookDup = await fetch(`${siteUrl}/twilio/whatsapp`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: webhookBody.toString(),
});
assert.equal(webhookDup.status, 200);
assert.equal(await webhookDup.text(), "duplicate");

const eventId = await client.mutation(insertRealtimeProbe, {
  summary: `S2 verify probe ${Date.now()}`,
});
const workerId = await client.mutation(createRealtimeProbe, {});
const events = await client.query(listEvents, {});
const workers = await client.query(listWorkers, {});
assert.ok(events.some((event) => event._id === eventId));
assert.ok(workers.some((worker) => worker._id === workerId));

let outboundProof = "skipped_missing_credentials";
if (
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_WHATSAPP_FROM &&
  (process.env.TWILIO_TEST_TO || process.env.S2_ALLOW_OUTBOUND_WITHOUT_TEST_TO)
) {
  const sendTestWhatsApp = makeFunctionReference("messagingOutbound:sendTestWhatsApp");
  const sent = await client.action(sendTestWhatsApp, {});
  assert.ok(sent.providerMessageId);
  outboundProof = "sent";
}

console.log(
  JSON.stringify(
    {
      inboundAccepted: true,
      inboundIdempotent: true,
      webhookAccepted: true,
      webhookIdempotent: true,
      phoneHiddenFromPublicQuery: true,
      realtimeProbeEvent: true,
      realtimeProbeWorker: true,
      outboundProof,
    },
    null,
    2,
  ),
);
