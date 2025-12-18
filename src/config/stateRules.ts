/**
 * State-specific EPR program rules and capabilities.
 *
 * This configuration drives conditional rendering of fee components
 * without hardcoding state names in UI components.
 *
 * DESIGN PRINCIPLES:
 * - UI components check capabilities, not state names
 * - Each state explicitly declares which fee modifiers it supports
 * - New states or modifiers can be added without changing UI logic
 *
 * ADDING A NEW STATE:
 * 1. Add entry to STATE_RULES with appropriate capabilities
 * 2. No changes needed to FeeBreakdown or other UI components
 *
 * ADDING A NEW FEE MODIFIER:
 * 1. Add new capability flag (e.g. supportsRecyclingCredit)
 * 2. Update relevant state entries
 * 3. Add conditional row in FeeBreakdown using the capability
 */

export interface StateRules {
  /** State supports LCA (Life Cycle Assessment) bonus/adjustment display */
  supportsLCA: boolean;

  // Future fee modifiers can be added here:
  // supportsRecyclingCredit?: boolean;
  // supportsEcoModulation?: boolean;
  // supportsProducerResponsibilityFee?: boolean;
}

/**
 * State capability definitions.
 *
 * Colorado: No LCA program - fees are flat rate based on material
 * Oregon: Has LCA bonus program - show adjustment even when $0.00
 *         to indicate eligibility was evaluated
 */
const STATE_RULES: Record<string, StateRules> = {
  Colorado: {
    supportsLCA: false,
  },
  Oregon: {
    supportsLCA: true,
  },
};

/**
 * Default rules for states not explicitly configured.
 * Conservative default: don't show optional modifiers.
 */
const DEFAULT_RULES: StateRules = {
  supportsLCA: false,
};

/**
 * Get capability rules for a given state.
 * Returns default rules if state is not configured.
 */
export function getStateRules(state: string): StateRules {
  return STATE_RULES[state] ?? DEFAULT_RULES;
}
