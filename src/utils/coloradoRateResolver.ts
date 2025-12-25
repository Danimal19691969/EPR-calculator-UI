/**
 * Colorado Rate Resolver
 *
 * Single source of truth for resolving Colorado material group rates.
 * This module ensures consistent rate resolution across:
 * - UI display (ColoradoPhase2Breakdown)
 * - Calculation engine
 * - PDF export
 *
 * CRITICAL DESIGN PRINCIPLES:
 * 1. NEVER silently return 0 for missing rates
 * 2. ALWAYS throw explicit errors for invalid data
 * 3. All Colorado rate access MUST go through this resolver
 *
 * This module is Colorado-specific. Oregon logic is NOT affected.
 */

import type { ColoradoPhase2Group } from "../services/api";

/**
 * DEV ONLY: Diagnostic logging for Colorado rate data flow.
 * Logs a console.table showing raw API data vs resolved rates.
 * This helps identify where zero/blank rates originate.
 *
 * @param groups - The array of Colorado Phase 2 groups (from API)
 * @param apiBaseUrl - The API base URL being used
 */
export function logColoradoRateDiagnostics(
  groups: ColoradoPhase2Group[],
  apiBaseUrl: string
): void {
  if (import.meta.env.PROD) {
    return; // Never log in production
  }

  console.group("🔍 Colorado Phase 2 Rate Diagnostics");
  console.log("API Base URL:", apiBaseUrl || "(empty - using Vite proxy)");
  console.log("Groups count:", groups.length);

  const diagnosticRows = groups.map((g) => {
    const resolvedRate = resolveColoradoRateSafe(groups, g.group_key);
    const isValid = validateColoradoRate(g.base_rate_per_lb);

    return {
      group_key: g.group_key,
      group_name: g.group_name,
      status: g.status,
      raw_rate: g.base_rate_per_lb,
      is_valid: isValid,
      resolved_rate: resolvedRate,
      problem: !isValid ? "⚠️ INVALID RATE" : resolvedRate === null ? "⚠️ RESOLUTION FAILED" : "✓",
    };
  });

  console.table(diagnosticRows);

  // Highlight any problems
  const invalidGroups = diagnosticRows.filter((r) => r.problem !== "✓");
  if (invalidGroups.length > 0) {
    console.warn("⚠️ Groups with rate problems:", invalidGroups.map((g) => g.group_key));
  } else {
    console.log("✓ All groups have valid rates");
  }

  console.groupEnd();
}

/**
 * Custom error class for Colorado rate resolution failures.
 * This allows callers to distinguish rate errors from other errors.
 */
export class ColoradoRateError extends Error {
  readonly groupKey?: string;
  readonly availableGroups?: string[];

  constructor(
    message: string,
    groupKey?: string,
    availableGroups?: string[]
  ) {
    super(message);
    this.name = "ColoradoRateError";
    this.groupKey = groupKey;
    this.availableGroups = availableGroups;
  }
}

/**
 * Validate that a rate is a valid positive number.
 *
 * @param rate - The rate to validate
 * @returns true if the rate is valid (positive, finite, not NaN)
 */
export function validateColoradoRate(rate: number): boolean {
  return (
    typeof rate === "number" &&
    isFinite(rate) &&
    !isNaN(rate) &&
    rate > 0
  );
}

/**
 * Resolve the JBC-Approved Medium Scenario rate for a Colorado material group.
 *
 * This function looks up the rate from the pre-fetched groups data.
 * It throws explicit errors for any data problems, never silently returning 0.
 *
 * @param groups - The array of Colorado Phase 2 groups (from API)
 * @param groupKey - The group_key to look up
 * @returns The base_rate_per_lb for the material group
 * @throws ColoradoRateError if the group is not found or has invalid rate
 */
export function resolveColoradoRate(
  groups: ColoradoPhase2Group[],
  groupKey: string
): number {
  // Guard: Empty groups array
  if (!groups || groups.length === 0) {
    throw new ColoradoRateError(
      "Colorado rate resolution failed: No groups available. " +
        "Material groups have not been loaded from the backend.",
      groupKey,
      []
    );
  }

  // Guard: Empty or invalid group key
  if (!groupKey || typeof groupKey !== "string" || groupKey.trim() === "") {
    throw new ColoradoRateError(
      "Colorado rate resolution failed: Invalid group key provided.",
      groupKey,
      groups.map((g) => g.group_key)
    );
  }

  // Find the group by exact key match
  const group = groups.find((g) => g.group_key === groupKey);

  if (!group) {
    throw new ColoradoRateError(
      `Colorado rate resolution failed: Material group "${groupKey}" not found. ` +
        `Available groups: ${groups.map((g) => g.group_key).join(", ")}`,
      groupKey,
      groups.map((g) => g.group_key)
    );
  }

  // Guard: Invalid rate value
  if (!validateColoradoRate(group.base_rate_per_lb)) {
    throw new ColoradoRateError(
      `Colorado rate resolution failed: Invalid rate for material group "${groupKey}". ` +
        `Rate value: ${group.base_rate_per_lb}. ` +
        `This indicates a backend data problem.`,
      groupKey,
      groups.map((g) => g.group_key)
    );
  }

  return group.base_rate_per_lb;
}

/**
 * Safely resolve a Colorado rate, returning null instead of throwing.
 * Use this when you want to handle missing rates gracefully in the UI.
 *
 * @param groups - The array of Colorado Phase 2 groups (from API)
 * @param groupKey - The group_key to look up
 * @returns The rate, or null if resolution fails
 */
export function resolveColoradoRateSafe(
  groups: ColoradoPhase2Group[],
  groupKey: string
): number | null {
  try {
    return resolveColoradoRate(groups, groupKey);
  } catch {
    return null;
  }
}

/**
 * Get the display name for a Colorado material group.
 *
 * @param groups - The array of Colorado Phase 2 groups (from API)
 * @param groupKey - The group_key to look up
 * @returns The group_name, or the groupKey as fallback
 */
export function getColoradoGroupName(
  groups: ColoradoPhase2Group[],
  groupKey: string
): string {
  const group = groups.find((g) => g.group_key === groupKey);
  return group?.group_name || groupKey;
}

/**
 * Check if a Colorado material group has a valid rate.
 *
 * @param groups - The array of Colorado Phase 2 groups (from API)
 * @param groupKey - The group_key to check
 * @returns true if the group exists and has a valid rate
 */
export function hasValidColoradoRate(
  groups: ColoradoPhase2Group[],
  groupKey: string
): boolean {
  const rate = resolveColoradoRateSafe(groups, groupKey);
  return rate !== null;
}

/**
 * Calculate Colorado base dues from weight and resolved rate.
 * This is the core calculation: baseDues = weight × rate
 *
 * @param groups - The array of Colorado Phase 2 groups (from API)
 * @param groupKey - The group_key to look up
 * @param weightLbs - The weight in pounds
 * @returns The calculated base dues
 * @throws ColoradoRateError if the rate cannot be resolved
 */
export function calculateColoradoBaseDues(
  groups: ColoradoPhase2Group[],
  groupKey: string,
  weightLbs: number
): number {
  if (weightLbs <= 0) {
    throw new ColoradoRateError(
      "Colorado calculation failed: Weight must be greater than 0.",
      groupKey
    );
  }

  const rate = resolveColoradoRate(groups, groupKey);
  return rate * weightLbs;
}

/**
 * Interface for a fully resolved Colorado calculation result.
 * This is the single source of truth that UI, breakdown, and PDF export should use.
 */
export interface ColoradoResolvedResult {
  groupKey: string;
  groupName: string;
  weightLbs: number;
  ratePerLb: number;
  baseDues: number;
  proModulationPercent: number;
  proModulationDelta: number;
  afterProModulation: number;
  cdpheBonusPercent: number;
  cdpheBonusDelta: number;
  afterCdpheBonus: number;
  inKindCredit: number;
  finalPayable: number;
}

/**
 * Build a fully resolved Colorado calculation result.
 * This provides all values needed by UI, breakdown, and PDF export.
 *
 * @param groups - The array of Colorado Phase 2 groups (from API)
 * @param groupKey - The group_key to look up
 * @param weightLbs - The weight in pounds
 * @param proModulationPercent - PRO eco-modulation percentage (0-1)
 * @param cdpheBonusPercent - CDPHE bonus percentage (0-1)
 * @param inKindCredit - In-kind advertising credit amount
 * @returns A fully resolved result object
 */
export function buildColoradoResult(
  groups: ColoradoPhase2Group[],
  groupKey: string,
  weightLbs: number,
  proModulationPercent: number,
  cdpheBonusPercent: number,
  inKindCredit: number
): ColoradoResolvedResult {
  const ratePerLb = resolveColoradoRate(groups, groupKey);
  const groupName = getColoradoGroupName(groups, groupKey);
  const baseDues = ratePerLb * weightLbs;

  // Layer 1: PRO Eco-Modulation (applies to base dues)
  const proModulationDelta = baseDues * proModulationPercent;
  const afterProModulation = baseDues - proModulationDelta;

  // Layer 2: CDPHE Performance Benchmarks (applies to base dues, capped at 10%)
  const cdpheBonusDelta = baseDues * cdpheBonusPercent;
  const afterCdpheBonus = afterProModulation - cdpheBonusDelta;

  // Final: In-Kind Credit (floor at $0)
  const finalPayable = Math.max(0, afterCdpheBonus - inKindCredit);

  return {
    groupKey,
    groupName,
    weightLbs,
    ratePerLb,
    baseDues,
    proModulationPercent,
    proModulationDelta,
    afterProModulation,
    cdpheBonusPercent,
    cdpheBonusDelta,
    afterCdpheBonus,
    inKindCredit,
    finalPayable,
  };
}
