/**
 * Colorado Phase 2 Derived Values Calculator
 *
 * SINGLE SOURCE OF TRUTH for all derived values in Colorado Phase 2 calculations.
 * Both the UI (ColoradoPhase2Breakdown) and the PDF export MUST use this utility
 * to ensure identical values are displayed.
 *
 * CALCULATION ORDER (Must Match Program Plan):
 * 1. BaseDues = Weight × JBC-Approved Medium Scenario Rate
 * 2. Layer 1: Apply PRO Eco-Modulation (Mandatory, UNCAPPED)
 *    - ProDelta = BaseDues × pro_modulation_percent
 *    - AfterPro = BaseDues − ProDelta
 * 3. Layer 2: Apply CDPHE Performance Benchmarks (Optional, CAPPED)
 *    - CDPHEDelta = BaseDues × cdphe_bonus_percent
 *    - AfterCDPHE = AfterPro − CDPHEDelta
 * 4. Apply In-Kind Advertising Credit (final deduction, if eligible)
 * 5. FinalPayable = max(0, AfterCDPHE − InKindCredit)
 *
 * IMPORTANT: DO NOT use the API's `final_payable` field directly.
 * Always use computeColoradoPhase2DerivedValues() to ensure parity.
 */

import type { ColoradoPhase2CalculateResponse } from "../services/api";

/**
 * Derived values computed from the API response.
 * These values are used for display in both UI and PDF.
 */
export interface ColoradoPhase2DerivedValues {
  /** Base dues (weight × rate) */
  baseDues: number;
  /** Layer 1: PRO Eco-Modulation dollar delta (always a positive number representing the reduction) */
  proModulationDelta: number;
  /** Value after PRO Eco-Modulation is applied */
  afterProModulation: number;
  /** Layer 2: CDPHE Bonus dollar delta (always a positive number representing the reduction) */
  cdpheBonusDelta: number;
  /** Value after CDPHE Bonus is applied */
  afterCdpheBonus: number;
  /** In-Kind Advertising Credit amount */
  inKindCredit: number;
  /** Final payable amount after all adjustments (floored at $0) */
  finalPayable: number;
  /** PRO Eco-Modulation percentage from API (0-1 range) */
  proModulationPercent: number;
  /** CDPHE Bonus percentage from API (0-1 range) */
  cdpheBonusPercent: number;
  /** Weight in pounds */
  weightLbs: number;
  /** Material group name */
  aggregatedGroup: string;
}

/**
 * Compute all derived values from a Colorado Phase 2 API response.
 *
 * CRITICAL: This function is the SINGLE SOURCE OF TRUTH for derived values.
 * Both the UI component and PDF export MUST use this function to ensure
 * identical values are displayed in both places.
 *
 * @param result - The API response from a Colorado Phase 2 calculation
 * @returns All derived values needed for display
 */
export function computeColoradoPhase2DerivedValues(
  result: ColoradoPhase2CalculateResponse
): ColoradoPhase2DerivedValues {
  const baseDues = result.base_dues || 0;
  const proModulationPercent = result.pro_modulation_percent || 0;
  const cdpheBonusPercent = result.cdphe_bonus_percent || 0;
  const inKindCredit = result.newspaper_credit || 0;

  // Layer 1: PRO Eco-Modulation delta (reduction)
  const proModulationDelta = baseDues * proModulationPercent;
  const afterProModulation = baseDues - proModulationDelta;

  // Layer 2: CDPHE Bonus delta (reduction)
  const cdpheBonusDelta = baseDues * cdpheBonusPercent;
  const afterCdpheBonus = afterProModulation - cdpheBonusDelta;

  // Final: In-Kind Credit (final deduction, floor at $0)
  const beforeFloor = afterCdpheBonus - inKindCredit;
  const finalPayable = Math.max(0, beforeFloor);

  return {
    baseDues,
    proModulationDelta,
    afterProModulation,
    cdpheBonusDelta,
    afterCdpheBonus,
    inKindCredit,
    finalPayable,
    proModulationPercent,
    cdpheBonusPercent,
    weightLbs: result.weight_lbs,
    aggregatedGroup: result.aggregated_group,
  };
}
