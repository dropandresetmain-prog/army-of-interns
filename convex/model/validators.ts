import { v } from "convex/values";

import {
  APPROVAL_STATUSES,
  ASSIGNMENT_STATUSES,
  EMPLOYMENT_TYPES,
  RISK_CLASSES,
  STRUCTURED_EVENT_TYPES,
  WORKER_RANKS,
  WORKER_STATUSES,
  WORK_ITEM_STATUSES,
} from "../../src/core/domain/vocabulary";

export const employmentTypeValidator = v.union(
  v.literal(EMPLOYMENT_TYPES[0]),
  v.literal(EMPLOYMENT_TYPES[1]),
);

export const workerRankValidator = v.union(
  v.literal(WORKER_RANKS[0]),
  v.literal(WORKER_RANKS[1]),
  v.literal(WORKER_RANKS[2]),
  v.literal(WORKER_RANKS[3]),
  v.literal(WORKER_RANKS[4]),
);

export const workerStatusValidator = v.union(
  v.literal(WORKER_STATUSES[0]),
  v.literal(WORKER_STATUSES[1]),
  v.literal(WORKER_STATUSES[2]),
  v.literal(WORKER_STATUSES[3]),
  v.literal(WORKER_STATUSES[4]),
);

export const workItemStatusValidator = v.union(
  v.literal(WORK_ITEM_STATUSES[0]),
  v.literal(WORK_ITEM_STATUSES[1]),
  v.literal(WORK_ITEM_STATUSES[2]),
  v.literal(WORK_ITEM_STATUSES[3]),
  v.literal(WORK_ITEM_STATUSES[4]),
  v.literal(WORK_ITEM_STATUSES[5]),
  v.literal(WORK_ITEM_STATUSES[6]),
);

export const assignmentStatusValidator = v.union(
  v.literal(ASSIGNMENT_STATUSES[0]),
  v.literal(ASSIGNMENT_STATUSES[1]),
  v.literal(ASSIGNMENT_STATUSES[2]),
  v.literal(ASSIGNMENT_STATUSES[3]),
  v.literal(ASSIGNMENT_STATUSES[4]),
);

export const approvalStatusValidator = v.union(
  v.literal(APPROVAL_STATUSES[0]),
  v.literal(APPROVAL_STATUSES[1]),
  v.literal(APPROVAL_STATUSES[2]),
);

export const riskClassValidator = v.union(
  v.literal(RISK_CLASSES[0]),
  v.literal(RISK_CLASSES[1]),
  v.literal(RISK_CLASSES[2]),
  v.literal(RISK_CLASSES[3]),
);

export const structuredEventTypeValidator = v.union(
  v.literal(STRUCTURED_EVENT_TYPES[0]),
  v.literal(STRUCTURED_EVENT_TYPES[1]),
  v.literal(STRUCTURED_EVENT_TYPES[2]),
  v.literal(STRUCTURED_EVENT_TYPES[3]),
  v.literal(STRUCTURED_EVENT_TYPES[4]),
  v.literal(STRUCTURED_EVENT_TYPES[5]),
  v.literal(STRUCTURED_EVENT_TYPES[6]),
  v.literal(STRUCTURED_EVENT_TYPES[7]),
  v.literal(STRUCTURED_EVENT_TYPES[8]),
  v.literal(STRUCTURED_EVENT_TYPES[9]),
  v.literal(STRUCTURED_EVENT_TYPES[10]),
  v.literal(STRUCTURED_EVENT_TYPES[11]),
  v.literal(STRUCTURED_EVENT_TYPES[12]),
  v.literal(STRUCTURED_EVENT_TYPES[13]),
  v.literal(STRUCTURED_EVENT_TYPES[14]),
);

export const metadataValidator = v.record(v.string(), v.any());

export const modelConfigValidator = v.object({
  provider: v.optional(v.string()),
  model: v.optional(v.string()),
  routingPreference: v.optional(v.string()),
});

const companyProfileFields = {
  name: v.string(),
  businessDescription: v.string(),
  ownerPersonId: v.id("people"),
  operatingPolicies: v.record(v.string(), v.string()),
  approvalPolicies: v.record(v.string(), v.string()),
  terminology: v.record(v.string(), v.string()),
  availableToolIds: v.array(v.id("toolDefinitions")),
};

const personFields = {
  displayName: v.string(),
  roleType: v.string(),
  whatsappNumber: v.optional(v.string()),
  demoCallsign: v.optional(v.string()),
  active: v.boolean(),
  scenarioMetadata: v.optional(metadataValidator),
};

const workerFields = {
  name: v.string(),
  title: v.string(),
  employmentType: employmentTypeValidator,
  rank: workerRankValidator,
  managerWorkerId: v.optional(v.id("workers")),
  status: workerStatusValidator,
  capabilityIds: v.array(v.id("capabilities")),
  toolPermissionIds: v.array(v.string()),
  personality: v.string(),
  communicationStyle: v.string(),
  standingInstructions: v.array(v.string()),
  modelConfig: v.optional(modelConfigValidator),
  tasksCompleted: v.number(),
  successfulTasks: v.number(),
  promotionEligible: v.boolean(),
};

const capabilityFields = {
  key: v.string(),
  name: v.string(),
  description: v.string(),
  defaultToolPermissionIds: v.optional(v.array(v.string())),
};

const workItemFields = {
  objective: v.string(),
  context: v.string(),
  constraints: v.array(v.string()),
  status: workItemStatusValidator,
  requestedByPersonId: v.id("people"),
  parentWorkItemId: v.optional(v.id("workItems")),
  requiredCapabilityIds: v.array(v.id("capabilities")),
  successCriteria: v.array(v.string()),
  deadline: v.optional(v.number()),
  budget: v.optional(
    v.object({
      amount: v.number(),
      currency: v.string(),
    }),
  ),
  policyMetadata: v.optional(metadataValidator),
};

const assignmentFields = {
  workItemId: v.id("workItems"),
  workerId: v.id("workers"),
  responsibility: v.string(),
  status: assignmentStatusValidator,
  resultSummary: v.optional(v.string()),
};

const approvalFields = {
  workItemId: v.id("workItems"),
  requestedFromPersonId: v.id("people"),
  proposedByWorkerId: v.id("workers"),
  actionType: v.string(),
  reason: v.string(),
  riskClass: riskClassValidator,
  amount: v.optional(
    v.object({
      value: v.number(),
      currency: v.string(),
    }),
  ),
  payload: metadataValidator,
  status: approvalStatusValidator,
  requestedAt: v.number(),
  resolvedAt: v.optional(v.number()),
};

const eventFields = {
  timestamp: v.number(),
  workerId: v.optional(v.id("workers")),
  workItemId: v.optional(v.id("workItems")),
  eventType: structuredEventTypeValidator,
  summary: v.string(),
  metadata: metadataValidator,
};

const toolDefinitionFields = {
  key: v.string(),
  description: v.string(),
  riskClass: riskClassValidator,
  requiredPermissions: v.array(v.string()),
};

export const tableFields = {
  companyProfiles: companyProfileFields,
  people: personFields,
  workers: workerFields,
  capabilities: capabilityFields,
  workItems: workItemFields,
  assignments: assignmentFields,
  approvals: approvalFields,
  events: eventFields,
  toolDefinitions: toolDefinitionFields,
};

const systemFields = {
  _id: v.id("companyProfiles"),
  _creationTime: v.number(),
};

export const companyProfileDocumentValidator = v.object({
  ...systemFields,
  ...companyProfileFields,
});

export const workerDocumentValidator = v.object({
  _id: v.id("workers"),
  _creationTime: v.number(),
  ...workerFields,
});

export const workItemDocumentValidator = v.object({
  _id: v.id("workItems"),
  _creationTime: v.number(),
  ...workItemFields,
});

export const eventDocumentValidator = v.object({
  _id: v.id("events"),
  _creationTime: v.number(),
  ...eventFields,
});
