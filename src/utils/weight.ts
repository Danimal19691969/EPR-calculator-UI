/**
 * Weight unit utilities for EPR Fee Calculator
 *
 * CURRENT STATE: All calculations use pounds (LBS) as the authoritative unit.
 * The API expects weight_lbs and all state fee rules are defined in pounds.
 *
 * FUTURE INTENT: Metric support (KG) is intentionally deferred.
 * This module provides the foundation for adding KG input later without
 * changing calculation logic - KG values would be converted to LBS before
 * being sent to the API.
 */

export type WeightUnit = "lbs" | "kg";

export interface Weight {
  value: number;
  unit: WeightUnit;
}

// Conversion constants
const LBS_PER_KG = 2.20462;
const KG_PER_LB = 0.453592;

/**
 * Default weight unit for the application.
 * Currently: LBS (pounds) - the authoritative internal unit.
 *
 * Metric support intentionally deferred.
 * When adding KG support, this could become user-configurable.
 */
export const DEFAULT_UNIT: WeightUnit = "lbs";

/**
 * Creates a Weight object with the default unit (LBS).
 */
export function createWeight(value: number, unit: WeightUnit = DEFAULT_UNIT): Weight {
  return { value, unit };
}

/**
 * Converts weight between units.
 *
 * @param value - The numeric weight value
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted value (rounded to 2 decimal places)
 *
 * Metric support intentionally deferred.
 * This function is ready but not yet called from UI code.
 */
export function convertWeight(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) {
    return value;
  }

  if (fromUnit === "kg" && toUnit === "lbs") {
    return Math.round(value * LBS_PER_KG * 100) / 100;
  }

  if (fromUnit === "lbs" && toUnit === "kg") {
    return Math.round(value * KG_PER_LB * 100) / 100;
  }

  return value;
}

/**
 * Converts a Weight object to pounds (LBS).
 * This is the canonical conversion for API calls.
 *
 * @param weight - Weight object with value and unit
 * @returns Weight value in pounds
 */
export function toLbs(weight: Weight): number {
  return convertWeight(weight.value, weight.unit, "lbs");
}

/**
 * Returns the display label for a weight unit.
 *
 * Metric support intentionally deferred.
 * When adding KG support, the UI would use this for labels.
 */
export function getUnitLabel(unit: WeightUnit): string {
  return unit === "lbs" ? "lbs" : "kg";
}
