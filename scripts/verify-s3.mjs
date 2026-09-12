import assert from "node:assert/strict";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!deploymentUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required. Run Convex locally first.");
}

const client = new ConvexHttpClient(deploymentUrl);
const bootstrapDemo = makeFunctionReference("seed:bootstrapDemo");
const intakeAndStaff = makeFunctionReference("workforce:intakeAndStaff");
const listWorkers = makeFunctionReference("workers:list");
const listWorkItems = makeFunctionReference("workItems:list");
const listAssignments = makeFunctionReference("assignments:list");
const listEvents = makeFunctionReference("events:list");
const listCapabilities = makeFunctionReference("capabilities:list");

await client.mutation(bootstrapDemo, {});

const maintenanceText = "The toilet in Room 3 is leaking.";
const marketingText = "Prepare our Instagram posts for next week.";

const first = await client.mutation(intakeAndStaff, { text: maintenanceText });
assert.equal(first.staffingKind, "create");
assert.equal(first.workerCreated, true);
assert.ok(first.requiredCapabilityKeys.includes("maintenance_triage"));
assert.ok(first.requiredCapabilityKeys.includes("stakeholder_messaging"));

const workersAfterCreate = await client.query(listWorkers, {});
const createdWorker = workersAfterCreate.find(
  (worker) => worker._id === first.workerId,
);
assert.ok(createdWorker, "Created worker must persist before assignment.");
assert.equal(createdWorker.title, "Operations Intern");

const assignmentsAfterCreate = await client.query(listAssignments, {});
assert.ok(
  assignmentsAfterCreate.some(
    (assignment) =>
      assignment._id === first.assignmentId &&
      assignment.workerId === first.workerId &&
      assignment.workItemId === first.workItemId,
  ),
  "Assignment must link work item and persisted worker.",
);

const eventsAfterCreate = await client.query(listEvents, {});
const firstEventTypes = eventsAfterCreate
  .filter((event) => event.workItemId === first.workItemId)
  .map((event) => event.eventType);
for (const required of [
  "work_received",
  "capabilities_identified",
  "staffing_requested",
  "worker_created",
  "assignment_started",
]) {
  assert.ok(
    firstEventTypes.includes(required),
    `Missing event ${required} on create path`,
  );
}

const second = await client.mutation(intakeAndStaff, { text: maintenanceText });
assert.equal(second.staffingKind, "reuse");
assert.equal(second.workerCreated, false);
assert.equal(
  second.workerId,
  first.workerId,
  "Second same-capability request must reuse the existing worker.",
);

const reuseEvents = (await client.query(listEvents, {}))
  .filter((event) => event.workItemId === second.workItemId)
  .map((event) => event.eventType);
assert.ok(reuseEvents.includes("worker_matched"));
assert.ok(!reuseEvents.includes("worker_created"));

const marketing = await client.mutation(intakeAndStaff, { text: marketingText });
assert.equal(marketing.staffingKind, "create");
assert.deepEqual(marketing.requiredCapabilityKeys, ["content_marketing"]);
assert.notEqual(
  marketing.workerId,
  first.workerId,
  "Marketing work should staff a different capability worker.",
);

const marketingWorker = (await client.query(listWorkers, {})).find(
  (worker) => worker._id === marketing.workerId,
);
assert.equal(marketingWorker?.title, "Marketing Intern");

const workItems = await client.query(listWorkItems, {});
assert.ok(workItems.some((item) => item._id === first.workItemId));
assert.ok(workItems.some((item) => item._id === marketing.workItemId));

const capabilities = await client.query(listCapabilities, {});
assert.ok(capabilities.some((capability) => capability.key === "maintenance_triage"));
assert.ok(capabilities.some((capability) => capability.key === "content_marketing"));

console.log(
  JSON.stringify(
    {
      maintenanceCreate: true,
      workerPersistedBeforeAssignment: true,
      maintenanceReuse: true,
      reusedWorkerId: second.workerId,
      marketingCreate: true,
      samePipeline: true,
      lifecycleEvents: true,
    },
    null,
    2,
  ),
);
