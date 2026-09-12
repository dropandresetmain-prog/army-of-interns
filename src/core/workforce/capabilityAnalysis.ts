import {
  CONTROLLED_CAPABILITIES,
  getCapabilityDefinition,
  isControlledCapabilityKey,
} from "./capabilityCatalog";

export interface CapabilityAnalysisInput {
  objective: string;
  context?: string;
  /** Optional model-proposed keys; validated against the controlled catalog. */
  proposedCapabilityKeys?: string[];
}

export interface CapabilityAnalysisResult {
  /** Controlled capability keys selected for the work. */
  requiredCapabilityKeys: string[];
  /** Keys that matched via configured signals. */
  matchedBySignal: string[];
  /** Proposed keys accepted because they exist in the catalog. */
  acceptedProposals: string[];
  /** Proposed keys rejected because they are not controlled vocabulary. */
  rejectedProposals: string[];
  /** True when no controlled capability could be derived. */
  unrecognized: boolean;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function expandImpliedKeys(keys: Iterable<string>): string[] {
  const resolved = new Set<string>();
  const queue = [...keys];

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || resolved.has(key) || !isControlledCapabilityKey(key)) {
      continue;
    }
    resolved.add(key);
    const definition = getCapabilityDefinition(key);
    for (const implied of definition?.implies ?? []) {
      if (!resolved.has(implied)) {
        queue.push(implied);
      }
    }
  }

  return [...resolved].sort();
}

/**
 * Derive required capabilities from work text using the controlled catalog.
 * Unknown proposed keys are rejected explicitly rather than accepted silently.
 */
export function analyzeRequiredCapabilities(
  input: CapabilityAnalysisInput,
): CapabilityAnalysisResult {
  const haystack = normalizeText(
    [input.objective, input.context ?? ""].filter(Boolean).join(" "),
  );

  const matchedBySignal: string[] = [];
  for (const capability of CONTROLLED_CAPABILITIES) {
    const hit = capability.signals.some((signal) =>
      haystack.includes(normalizeText(signal)),
    );
    if (hit) {
      matchedBySignal.push(capability.key);
    }
  }

  const acceptedProposals: string[] = [];
  const rejectedProposals: string[] = [];
  for (const proposed of input.proposedCapabilityKeys ?? []) {
    const key = proposed.trim();
    if (!key) {
      continue;
    }
    if (isControlledCapabilityKey(key)) {
      acceptedProposals.push(key);
    } else {
      rejectedProposals.push(key);
    }
  }

  const requiredCapabilityKeys = expandImpliedKeys([
    ...matchedBySignal,
    ...acceptedProposals,
  ]);

  return {
    requiredCapabilityKeys,
    matchedBySignal: [...matchedBySignal].sort(),
    acceptedProposals: [...new Set(acceptedProposals)].sort(),
    rejectedProposals: [...new Set(rejectedProposals)].sort(),
    unrecognized: requiredCapabilityKeys.length === 0,
  };
}
