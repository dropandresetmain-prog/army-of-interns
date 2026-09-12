import {
  CONTROLLED_CAPABILITIES,
  TOOL_PERMISSIONS,
  isControlledCapabilityKey,
} from "./capabilityCatalog";

/**
 * Map controlled capability keys to allowed tool permission IDs.
 * The LLM cannot invent grants outside this mapping.
 */
export function mapCapabilitiesToToolPermissions(
  capabilityKeys: string[],
): string[] {
  const permissions = new Set<string>();

  for (const key of capabilityKeys) {
    if (!isControlledCapabilityKey(key)) {
      continue;
    }
    const definition = CONTROLLED_CAPABILITIES.find((item) => item.key === key);
    for (const permissionId of definition?.defaultToolPermissionIds ?? []) {
      if (isPermissionAllowedForCapability(permissionId, key)) {
        permissions.add(permissionId);
      }
    }
  }

  return [...permissions].sort();
}

export function isPermissionAllowedForCapability(
  permissionId: string,
  capabilityKey: string,
): boolean {
  const permission = TOOL_PERMISSIONS.find((item) => item.id === permissionId);
  if (!permission) {
    return false;
  }
  return permission.grantedByCapabilityKeys.includes(capabilityKey);
}

/**
 * Filter an arbitrary permission list down to grants allowed by the
 * worker's capability set. Strips self-granted / invented permissions.
 */
export function enforcePermissionEnvelope(input: {
  capabilityKeys: string[];
  requestedPermissionIds: string[];
}): {
  allowedPermissionIds: string[];
  rejectedPermissionIds: string[];
} {
  const allowedFromCapabilities = new Set(
    mapCapabilitiesToToolPermissions(input.capabilityKeys),
  );
  const allowedPermissionIds: string[] = [];
  const rejectedPermissionIds: string[] = [];

  for (const permissionId of new Set(input.requestedPermissionIds)) {
    if (allowedFromCapabilities.has(permissionId)) {
      allowedPermissionIds.push(permissionId);
    } else {
      rejectedPermissionIds.push(permissionId);
    }
  }

  return {
    allowedPermissionIds: allowedPermissionIds.sort(),
    rejectedPermissionIds: rejectedPermissionIds.sort(),
  };
}
