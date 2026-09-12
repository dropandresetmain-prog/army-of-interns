import assert from "node:assert/strict";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!deploymentUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required. Run Convex locally first.");
}

const client = new ConvexHttpClient(deploymentUrl);
const adminSecret = process.env.DEMO_ADMIN_SECRET;
if (!adminSecret) {
  throw new Error("DEMO_ADMIN_SECRET is required. Set it in .env.local and Convex env.");
}
const bootstrapDemo = makeFunctionReference("seed:bootstrapDemo");
const getCompany = makeFunctionReference("companyProfiles:get");
const listWorkers = makeFunctionReference("workers:list");
const listWorkItems = makeFunctionReference("workItems:list");
const createEvent = makeFunctionReference("events:create");
const listEvents = makeFunctionReference("events:list");

await client.mutation(bootstrapDemo, { adminSecret });

const company = await client.query(getCompany, {});
const workers = await client.query(listWorkers, {});
const workItems = await client.query(listWorkItems, {});

assert.equal(company?.name, "Army of Interns Demo");
assert.ok(company?.ownerPersonId, "The demo company must reference its owner.");
assert.ok(Array.isArray(workItems), "Work items must be readable.");

const alex = workers.find((worker) => worker.name === "Alex");
assert.ok(alex, "Alex must be persisted.");
assert.equal(alex.employmentType, "permanent");
assert.equal(alex.rank, "manager");
assert.equal(alex.modelConfig, undefined, "Worker identity must not require a model provider.");

const eventSummary = `S1 persistence check ${Date.now()}`;
const eventId = await client.mutation(createEvent, {
  workerId: alex._id,
  eventType: "work_received",
  summary: eventSummary,
  metadata: { source: "s1_verification" },
});
const events = await client.query(listEvents, {});
const persistedEvent = events.find((event) => event._id === eventId);

assert.equal(persistedEvent?.summary, eventSummary);
assert.equal(persistedEvent?.eventType, "work_received");
assert.deepEqual(persistedEvent?.metadata, { source: "s1_verification" });

const secondBootstrap = await client.mutation(bootstrapDemo, { adminSecret });
assert.equal(secondBootstrap.createdCompany, false);
assert.equal(secondBootstrap.createdOwner, false);
assert.equal(secondBootstrap.createdManager, false);

console.log(
  JSON.stringify(
    {
      companyPersisted: true,
      alexPersisted: true,
      workItemsReadable: true,
      eventRoundTrip: true,
      seedIdempotent: true,
    },
    null,
    2,
  ),
);
