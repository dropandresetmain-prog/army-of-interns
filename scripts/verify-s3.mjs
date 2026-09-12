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
const resetTransientDemoState = makeFunctionReference(
  "seed:resetTransientDemoState",
);
const intakeAndStaff = makeFunctionReference("workforce:intakeAndStaff");
const listWorkers = makeFunctionReference("workers:list");
const listWorkItems = makeFunctionReference("workItems:list");
const listAssignments = makeFunctionReference("assignments:list");
const listEvents = makeFunctionReference("events:list");
const listCapabilities = makeFunctionReference("capabilities:list");

await client.mutation(bootstrapDemo, { adminSecret });
// Reset must retain permanent staff while removing temporary interns/work.
await client.mutation(resetTransientDemoState, { adminSecret });

const maintenanceText = "The toilet in Room 3 is leaking.";
const marketingText = "Prepare our Instagram posts for next week.";

const first = await client.mutation(intakeAndStaff, { text: maintenanceText });
assert.equal(first.staffingKind, "reuse");
assert.equal(first.workerCreated, false);
assert.ok(first.requiredCapabilityKeys.includes("maintenance_triage"));
assert.ok(first.requiredCapabilityKeys.includes("stakeholder_messaging"));

const workersAfterAssignment = await client.query(listWorkers, {});
const assignedWorker = workersAfterAssignment.find(
  (worker) => worker._id === first.workerId,
);
assert.ok(assignedWorker, "Assigned permanent worker must persist before assignment.");
assert.equal(assignedWorker.name, "Shu Zhen");
assert.equal(assignedWorker.title, "Property Operations Executive");
assert.equal(assignedWorker.employmentType, "permanent");

const assignmentsAfterAssignment = await client.query(listAssignments, {});
assert.ok(
  assignmentsAfterAssignment.some(
    (assignment) =>
      assignment._id === first.assignmentId &&
      assignment.workerId === first.workerId &&
      assignment.workItemId === first.workItemId,
  ),
  "Assignment must link work item and persisted worker.",
);

const eventsAfterAssignment = await client.query(listEvents, {});
const firstEventTypes = eventsAfterAssignment
  .filter((event) => event.workItemId === first.workItemId)
  .map((event) => event.eventType);
for (const required of [
  "work_received",
  "capabilities_identified",
  "worker_matched",
  "assignment_started",
]) {
  assert.ok(
    firstEventTypes.includes(required),
    `Missing event ${required} on permanent-staff path`,
  );
}
assert.ok(!firstEventTypes.includes("worker_created"));

const second = await client.mutation(intakeAndStaff, { text: maintenanceText });
assert.equal(second.staffingKind, "reuse");
assert.equal(second.workerCreated, false);
assert.equal(
  second.workerId,
  first.workerId,
  "Second maintenance request must reuse Shu Zhen.",
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
      permanentOperationsStaffRetained: true,
      shuZhenAssignedBeforeAnyInternCreation: true,
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
