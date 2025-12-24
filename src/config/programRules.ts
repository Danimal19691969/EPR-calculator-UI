/**
 * State-specific EPR program rules and fee calculation parameters.
 *
 * This configuration drives the "Explanation of Fee" section and
 * ensures regulatory accuracy across different state programs.
 *
 * IMPORTANT: Values here must match official state program documentation.
 * Add TODO comments for any values that need verification.
 */

export type LCAOptionType = "none" | "bonusA" | "bonusB" | "bonusC";

/**
 * Oregon 80% Operational Fee Rule
 *
 * Per Oregon Program Plan (2025-2027), Page 218 — Table 24 (Footnote):
 * "Bonus A is set at 10% discount of base fees (excluding the portion of reserves
 * in the base fees, which is estimated at approximately 20%). This results in a
 * net reduction of approximately 8% and not approximately 10% of base fees,
 * after the application of Bonus A."
 *
 * This means LCA bonuses apply ONLY to the operational portion (~80%) of base fees,
 * NOT the reserve portion (~20%).
 */
export const OREGON_OPERATIONAL_PORTION = 0.80;
export const OREGON_RESERVES_PORTION = 0.20;

export interface LCAOption {
  /** Display label for the option */
  label: string;
  /** Plain-language description of what this option means */
  description: string;
  /** Percentage reduction applied to base fee (e.g., 10 = 10%) - for Bonus A */
  reductionPercent: number;
  /** Maximum dollar cap on the bonus amount */
  capAmount: number | null;
  /** Whether this option is disabled (e.g., not yet available) */
  disabled?: boolean;
  /** Message to display when disabled */
  disabledReason?: string;
  /** Whether this option requires 2027 estimate mode */
  requires2027?: boolean;
  /**
   * Helper text explaining the option's behavior.
   * Used for tooltips and inline hints.
   */
  helperText?: string;
}

export interface ProgramRules {
  /** Whether this state has an active EPR program */
  programActive: boolean;
  /** Program name for display purposes */
  programName: string;
  /** Whether this state supports LCA bonus options */
  supportsLCA: boolean;
  /** LCA option definitions (only for states that support LCA) */
  lcaOptions?: Record<LCAOptionType, LCAOption>;
  /** Default explanation text for states without special programs */
  defaultExplanation?: string;
}

/**
 * Oregon LCA Options
 *
 * Oregon's Plastic Pollution and Recycling Modernization Act includes
 * Life Cycle Assessment (LCA) bonus provisions for producers who
 * demonstrate environmental responsibility.
 *
 * IMPORTANT: Bonus A and Bonus B are MUTUALLY EXCLUSIVE per Oregon Program Plan p.214:
 * "For each SKU or batch of SKUs, a producer will be eligible for either Bonus A or Bonus B, but not both bonuses."
 *
 * Source: Oregon Program Plan (2025-2027), Pages 212-216
 */
const OREGON_LCA_OPTIONS: Record<LCAOptionType, LCAOption> = {
  none: {
    label: "None",
    description:
      "No LCA bonus claimed. The full base fee applies without adjustment.",
    reductionPercent: 0,
    capAmount: null,
  },
  bonusA: {
    label: "Bonus A (Disclosure)",
    description:
      "10% reduction applied to operational fees only (excludes ~20% program reserves). Effective reduction is approximately 8% of total base fees. Cap: $20,000 per SKU. Limit: Max 10 SKUs per producer.",
    reductionPercent: 10,
    capAmount: 20000,
    helperText:
      "10% reduction applied to operational fees only (excludes ~20% program reserves). Effective reduction is approximately 8% of total base fees.",
  },
  bonusB: {
    label: "Bonus B (Impact Reduction)",
    description:
      "Higher reward for demonstrating 10-70%+ impact reduction. Applies to operational fees only (excludes ~20% program reserves). Cap: $50,000 per SKU.",
    reductionPercent: 0, // Uses tier-based flat credits instead
    capAmount: 50000,
    requires2027: true,
    disabledReason: "Available for 2027 Fees only",
    helperText:
      "Tier-based credit applied to operational fees only (excludes ~20% program reserves).",
  },
  bonusC: {
    label: "Bonus C: Reuse Transition (Pending Amendment)",
    description:
      "Bonus C details will be submitted in a future program plan amendment.",
    reductionPercent: 0,
    capAmount: null,
    disabled: true,
    disabledReason: "Pending Amendment",
  },
};

/**
 * Program rules by state.
 *
 * Each state entry defines the complete set of rules needed to
 * generate accurate fee explanations and UI behavior.
 */
const PROGRAM_RULES: Record<string, ProgramRules> = {
  Oregon: {
    programActive: true,
    programName: "Oregon Plastic Pollution and Recycling Modernization Act",
    supportsLCA: true,
    lcaOptions: OREGON_LCA_OPTIONS,
  },
  Colorado: {
    programActive: true,
    programName: "Colorado Producer Responsibility Program for Statewide Recycling",
    supportsLCA: false,
    defaultExplanation:
      "Colorado's EPR program applies a flat fee rate based on material type. No additional adjustments or bonuses are available under the current program structure.",
  },
};

/**
 * Default rules for states not explicitly configured.
 */
const DEFAULT_RULES: ProgramRules = {
  programActive: false,
  programName: "EPR Program",
  supportsLCA: false,
  defaultExplanation: "Fee calculated based on material type and weight.",
};

/**
 * Get program rules for a given state.
 */
export function getProgramRules(state: string): ProgramRules {
  return PROGRAM_RULES[state] ?? DEFAULT_RULES;
}

/**
 * Get LCA options for a state (returns empty array if not supported).
 */
export function getLCAOptions(state: string): LCAOption[] {
  const rules = getProgramRules(state);
  if (!rules.supportsLCA || !rules.lcaOptions) {
    return [];
  }
  return Object.values(rules.lcaOptions);
}

/**
 * Get a specific LCA option by type for a state.
 */
export function getLCAOption(
  state: string,
  optionType: LCAOptionType
): LCAOption | null {
  const rules = getProgramRules(state);
  if (!rules.supportsLCA || !rules.lcaOptions) {
    return null;
  }
  return rules.lcaOptions[optionType] ?? null;
}
