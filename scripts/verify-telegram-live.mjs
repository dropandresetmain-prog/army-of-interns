import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!deploymentUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required.");
}

const client = new ConvexHttpClient(deploymentUrl);
const listMessages = makeFunctionReference("messaging:listRecent");
const listEvents = makeFunctionReference("events:list");

const messages = await client.query(listMessages, {});
const events = await client.query(listEvents, {});

const inbound = messages.filter(
  (message) => message.provider === "telegram" && message.direction === "inbound",
);
const outbound = messages.filter(
  (message) => message.provider === "telegram" && message.direction === "outbound",
);

const inboundEvent = events.some(
  (event) =>
    event.eventType === "human_response_received" && event.metadata?.provider === "telegram",
);
const outboundEvent = events.some(
  (event) => event.eventType === "human_contacted" && event.metadata?.provider === "telegram",
);

console.log(
  JSON.stringify(
    {
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      latestInbound: inbound[0]
        ? { body: inbound[0].body, correlated: inbound[0].correlated }
        : null,
      latestOutbound: outbound[0]
        ? { body: outbound[0].body, correlated: outbound[0].correlated }
        : null,
      inboundEvent,
      outboundEvent,
    },
    null,
    2,
  ),
);
