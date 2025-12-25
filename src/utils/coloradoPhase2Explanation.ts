/**
 * Colorado Phase 2 Fee Explanation Generator
 *
 * SINGLE SOURCE OF TRUTH for Colorado Phase 2 fee explanation text.
 * This utility generates the explanation paragraphs used in BOTH:
 * - The UI (ColoradoPhase2FeeExplanation component)
 * - The PDF export (PrintableResultsLayout)
 *
 * DO NOT duplicate this logic elsewhere. If you need the explanation text,
 * import and use this function.
 */

import type { ColoradoPhase2CalculateResponse } from "../services/api";

/**
 * Input data required to generate the explanation paragraphs.
 */
export interface ColoradoPhase2ExplanationInput {
  groupName: string;
  result: ColoradoPhase2CalculateResponse;
  /** Resolved rate from groups API (single source of truth for rate) */
  resolvedRate: number | null;
}

/**
 * Format currency for explanation text.
 */
function formatCurrency(value: number): string {
  if (typeof value !== "number" || isNaN(value)) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format rate for explanation text.
 * Returns "—" for invalid/zero/null rates.
 */
function formatRate(value: number | null): string {
  if (value === null || typeof value !== "number" || isNaN(value) || !isFinite(value) || value <= 0) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

/**
 * Generate the fee explanation paragraphs for Colorado Phase 2.
 *
 * Returns an array of plain text strings (no JSX/HTML).
 * Each string is a complete paragraph.
 *
 * USAGE:
 * - UI: Render each paragraph in a <p> tag
 * - PDF: Pass directly to PrintableResultsLayout.explanationParagraphs
 */
export function generateColoradoPhase2Explanation(
  input: ColoradoPhase2ExplanationInput
): string[] {
  const { groupName, result, resolvedRate } = input;
  const paragraphs: string[] = [];

  // Paragraph 1: Program context
  paragraphs.push(
    `This estimate is calculated for ${groupName} under the Colorado Producer Responsibility Program for Statewide Recycling (Phase 2 / 2026 Program).`
  );

  // Paragraph 2: Base dues calculation
  // Uses resolvedRate (single source of truth) - NOT result.base_rate_per_lb
  paragraphs.push(
    `The base dues of ${formatCurrency(result.base_dues)} are calculated by multiplying the weight (${result.weight_lbs} lbs) by the per-pound rate (${formatRate(resolvedRate)}).`
  );

  // Paragraph 3: Adjustments explanation (only if adjustments exist)
  const hasAdjustments =
    result.pro_modulation_percent > 0 ||
    result.cdphe_bonus_percent > 0 ||
    result.newspaper_credit > 0;

  if (hasAdjustments) {
    paragraphs.push(
      `Adjustments are applied in layers: PRO Eco-Modulation credits (Layer 1), CDPHE Performance Benchmarks (Layer 2), and In-Kind Advertising Credits (if applicable). All credits reduce the final payable amount.`
    );
  }

  return paragraphs;
}
