/**
 * State-specific EPR program rules and fee calculation parameters.
 *
 * This configuration drives the "Explanation of Fee" section and
 * ensures regulatory accuracy across different state programs.
 *
 * IMPORTANT: Values here must match official state program documentation.
 * Add TODO comments for any values that need verification.
 */

export type LCAOptionType = "none" | "bonusA" | "bonusB";

export interface LCAOption {
  /** Display label for the option */
  label: string;
  /** Plain-language description of what this option means */
  description: string;
  /** Percentage reduction applied to eligible portion (e.g., 25 = 25%) */
  reductionPercent: number;
  /** Portion of fee eligible for reduction (e.g., 0.8 = 80%) */
  eligiblePortion: number;
  /** Maximum dollar cap on the bonus amount */
  capAmount: number | null;
  /** For Bonus B: multiplier range description (e.g., "1.5x to 3x") */
  multiplierRange?: string;
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
 * TODO: Verify exact percentages and caps against official DEQ documentation
 */
const OREGON_LCA_OPTIONS: Record<LCAOptionType, LCAOption> = {
  none: {
    label: "No LCA Performed",
    description:
      "No Life Cycle Assessment has been conducted for this packaging. The full base fee applies without adjustment.",
    reductionPercent: 0,
    eligiblePortion: 0,
    capAmount: null,
  },
  bonusA: {
    label: "Bonus A – LCA Disclosure",
    description:
      "A Life Cycle Assessment (LCA) is a comprehensive evaluation of a product's environmental impact across its entire lifecycle, from raw material extraction through disposal. Bonus A applies when a producer has completed and publicly disclosed an LCA for their packaging.",
    reductionPercent: 25, // TODO: Verify against DEQ documentation
    eligiblePortion: 0.8, // TODO: Verify - 80% of fee eligible
    capAmount: null, // TODO: Verify if cap exists
  },
  bonusB: {
    label: "Bonus B – LCA With Impact Reduction",
    description:
      "Bonus B applies when a producer has not only completed an LCA but has also demonstrated measurable reductions in environmental impact based on the assessment findings. This enhanced bonus recognizes active steps toward sustainability.",
    reductionPercent: 50, // TODO: Verify against DEQ documentation
    eligiblePortion: 0.8, // TODO: Verify - 80% of fee eligible
    capAmount: null, // TODO: Verify if cap exists
    multiplierRange: "1.5x to 3x", // TODO: Verify multiplier structure
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
