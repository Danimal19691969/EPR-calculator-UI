/**
 * State-specific legal references and disclaimers.
 *
 * This configuration provides legal metadata for the EPR Fee Estimator,
 * including law names, statute references, and footer text.
 *
 * DESIGN PRINCIPLES:
 * - UI components consume this via getStateLegal(), never check state names directly
 * - Disclaimer text is state-aware to cite correct legislation
 * - Footer references are state-specific to cite the correct legislation
 * - Unknown states gracefully return sensible defaults
 *
 * ADDING A NEW STATE:
 * 1. Add entry to STATE_LEGAL with shortName, lawName, statuteReference, footerText
 * 2. No changes needed to UI components
 */

export interface StateLegal {
  /** Short display name (e.g., "Colorado", "Oregon") */
  shortName: string;
  /** Full law name */
  lawName: string;
  /** Statute reference (e.g., "SB 582", "HB 22-1355") */
  statuteReference: string;
  /** Combined footer text for display */
  footerText: string;
}

/**
 * State-specific legal references.
 */
const STATE_LEGAL: Record<string, StateLegal> = {
  Colorado: {
    shortName: "Colorado",
    lawName: "Producer Responsibility Program for Statewide Recycling Act",
    statuteReference: "HB 22-1355",
    footerText:
      "Colorado HB 22-1355 – Producer Responsibility Program for Statewide Recycling Act. Estimates shown are for informational purposes only.",
  },
  Oregon: {
    shortName: "Oregon",
    lawName: "Plastic Pollution and Recycling Modernization Act",
    statuteReference: "SB 582",
    footerText:
      "Oregon SB 582 – Plastic Pollution and Recycling Modernization Act. Estimates shown are for informational purposes only.",
  },
};

/**
 * Default legal metadata for unknown states.
 */
const DEFAULT_LEGAL: StateLegal = {
  shortName: "Unknown",
  lawName: "Extended Producer Responsibility Program",
  statuteReference: "",
  footerText: "Estimates shown are for informational purposes only.",
};

/**
 * Get legal metadata for a given state.
 * Returns sensible defaults for unknown states.
 */
export function getStateLegal(state: string): StateLegal {
  const legal = STATE_LEGAL[state];
  if (legal) {
    return legal;
  }
  return {
    ...DEFAULT_LEGAL,
    shortName: state,
  };
}
