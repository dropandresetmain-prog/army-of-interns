export {
  CONTROLLED_CAPABILITIES,
  TOOL_PERMISSIONS,
  getCapabilityDefinition,
  isControlledCapabilityKey,
  listControlledCapabilityKeys,
} from "./capabilityCatalog";
export type {
  CapabilityDefinition,
  CapabilityRoleTemplate,
  ToolPermissionDefinition,
} from "./capabilityCatalog";

export {
  analyzeRequiredCapabilities,
} from "./capabilityAnalysis";
export type {
  CapabilityAnalysisInput,
  CapabilityAnalysisResult,
} from "./capabilityAnalysis";

export {
  intakeNaturalWorkRequest,
} from "./workIntake";
export type {
  NaturalWorkRequest,
  WorkIntakeResult,
} from "./workIntake";

export {
  matchWorkforce,
} from "./workforceMatcher";
export type {
  MatchableWorker,
  WorkforceMatchInput,
  WorkforceMatchResult,
} from "./workforceMatcher";

export {
  createWorkerSpecFromCapabilities,
} from "./workerSpecFactory";
export type { WorkerSpecFactoryInput } from "./workerSpecFactory";

export {
  enforcePermissionEnvelope,
  isPermissionAllowedForCapability,
  mapCapabilitiesToToolPermissions,
} from "./permissionMapping";

export {
  createAssignmentDraft,
  defaultResponsibilityForCapabilities,
} from "./assignmentFactory";
export type { AssignmentDraftInput } from "./assignmentFactory";

export {
  planWorkforceStaffing,
} from "./kernelPlan";
export type {
  KernelPlanEvent,
  KernelStaffingPlan,
  StaffingDecision,
} from "./kernelPlan";
