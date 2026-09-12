import {
  MANAGER_TOOL_NAMES,
  WORKER_TOOL_BY_PERMISSION,
  type RuntimeWorker,
} from "./types";

export function isManagerWorker(worker: Pick<RuntimeWorker, "rank" | "title">): boolean {
  return worker.rank === "manager" || worker.title === "General Manager";
}

export function toolNamesForPermissions(permissionIds: string[]): string[] {
  const names = new Set<string>();
  for (const permissionId of permissionIds) {
    const toolName = WORKER_TOOL_BY_PERMISSION[permissionId];
    if (toolName) {
      names.add(toolName);
    }
  }
  return [...names].sort();
}

export function managerToolNames(): string[] {
  return [...MANAGER_TOOL_NAMES].sort();
}

export function expectedToolNamesForWorker(worker: RuntimeWorker): string[] {
  if (isManagerWorker(worker)) {
    return managerToolNames();
  }
  return toolNamesForPermissions(worker.toolPermissionIds);
}
