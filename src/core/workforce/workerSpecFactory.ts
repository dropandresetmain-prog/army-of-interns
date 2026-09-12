import type { WorkerSpec } from "../domain/contracts";
import {
  getCapabilityDefinition,
  isControlledCapabilityKey,
} from "./capabilityCatalog";
import { mapCapabilitiesToToolPermissions } from "./permissionMapping";

export interface WorkerSpecFactoryInput {
  requiredCapabilityKeys: string[];
  managerWorkerId?: string;
  /** Optional display name override; defaults to the primary role title. */
  name?: string;
  reasonForCreation: string;
}

/**
 * Build a generic WorkerSpec from missing controlled capabilities.
 * Application data only — not an SDK/runtime object.
 */
export function createWorkerSpecFromCapabilities(
  input: WorkerSpecFactoryInput,
): WorkerSpec {
  const keys = [
    ...new Set(
      input.requiredCapabilityKeys.filter((key) => isControlledCapabilityKey(key)),
    ),
  ].sort();

  if (keys.length === 0) {
    throw new Error(
      "Cannot create a WorkerSpec without at least one controlled capability.",
    );
  }

  const primary = getCapabilityDefinition(keys[0]!)!;
  const title = primary.roleTemplate.title;
  const toolPermissionIds = mapCapabilitiesToToolPermissions(keys);

  return {
    name: input.name?.trim() || title,
    title,
    employmentType: "intern",
    rank: "intern",
    managerWorkerId: input.managerWorkerId,
    capabilityIds: keys,
    toolPermissionIds,
    personality: primary.roleTemplate.personality,
    communicationStyle: primary.roleTemplate.communicationStyle,
    standingInstructions: [...primary.roleTemplate.standingInstructions],
    reasonForCreation: input.reasonForCreation,
  };
}
