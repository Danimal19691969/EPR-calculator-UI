/**
 * ColoradoPhase2Breakdown Component
 *
 * Displays the fee breakdown for Colorado 2026 Program (HB22-1355) calculations.
 * Uses JBC-Approved Medium Scenario rates.
 *
 * CALCULATION APPROACH:
 * Uses computeColoradoPhase2DerivedValues() as the SINGLE SOURCE OF TRUTH for all
 * derived values. This ensures PDF/UI parity - both UI and PDF export use the same
 * utility function, eliminating any possible divergence.
 *
 * TWO-LAYER FEE ADJUSTMENT MODEL (Critical — Do Not Collapse):
 * PRO eco-modulation and CDPHE bonuses must be treated as two separate layers.
 * See coloradoPhase2DerivedValues.ts for calculation order documentation.
 *
 * Source: Colorado Amended Program Plan (June 2025) & CDPHE Proposed Rulemaking (Oct 2025)
 * Reference: Sections 15.2 (Five-Year Program Budget) & 18.9.2 (CDPHE Proposed Rulemaking)
 */

import { useState } from "react";
import type { ColoradoPhase2CalculateResponse } from "../services/api";
import { computeColoradoPhase2DerivedValues } from "../utils/coloradoPhase2DerivedValues";

interface ColoradoPhase2BreakdownProps {
  result: ColoradoPhase2CalculateResponse | null;
  groupName?: string;
  /**
   * SINGLE SOURCE OF TRUTH: Resolved rate from the groups API.
   * This is the ONLY rate used for display - calculation response rate is ignored.
   * This ensures UI/PDF parity and prevents backend rate mismatches.
   *
   * REQUIRED: Must be provided. If null, the rate is considered invalid.
   */
  resolvedRate: number | null;
}

function formatCurrency(value: number): string {
  // Guard against NaN/undefined - return $0.00 as safe fallback
  if (typeof value !== "number" || isNaN(value)) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatPercent(value: number): string {
  // Guard against NaN/undefined
  if (typeof value !== "number" || isNaN(value)) {
    return "0%";
  }
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format rate for display.
 * CRITICAL: Returns "—" for invalid/zero/null rates to surface data problems.
 * A rate of 0 or null indicates missing backend data or a lookup failure.
 */
function formatRate(value: number | null): string {
  // Guard against null/NaN/undefined/0 - these indicate data problems
  // Do NOT silently display "$0.0000" as that hides the real issue
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
 * Check if a rate is valid (positive, finite number).
 */
function isValidRate(value: number): boolean {
  return typeof value === "number" && isFinite(value) && !isNaN(value) && value > 0;
}

export default function ColoradoPhase2Breakdown({
  result,
  groupName,
  resolvedRate,
}: ColoradoPhase2BreakdownProps) {
  const [authorityExpanded, setAuthorityExpanded] = useState(false);

  if (!result) {
    return null;
  }

  // SINGLE SOURCE OF TRUTH: resolvedRate is the ONLY rate authority
  // Calculation response rate (result.base_rate_per_lb) is intentionally ignored
  // to prevent inconsistency between groups API and calculation API
  const displayRate = resolvedRate;
  const hasValidRate = displayRate !== null && isValidRate(displayRate);

  // SINGLE SOURCE OF TRUTH: Use shared utility for all derived values
  // This ensures PDF export uses identical values as displayed in UI
  const derived = computeColoradoPhase2DerivedValues(result);
  const {
    proModulationDelta,
    afterProModulation,
    cdpheBonusDelta,
    afterCdpheBonus,
    finalPayable,
    proModulationPercent,
    cdpheBonusPercent,
    inKindCredit,
  } = derived;

  const hasEcoModulation = proModulationPercent !== 0;
  const hasCdpheBonus = cdpheBonusPercent > 0;
  const hasInKindCredit = inKindCredit > 0;

  return (
    <div className="fee-breakdown fee-breakdown--has-result">
      {/* Main Fee Display */}
      <div className="fee-display">
        <div className="fee-display-title">Estimated 2026 Program Fee</div>
        <div className="fee-display-main">{formatCurrency(finalPayable)}</div>
        <div className="fee-display-info">
          {groupName || result.aggregated_group} · {result.weight_lbs} lbs
        </div>
        <div className="fee-display-scenario">
          JBC-Approved Medium Scenario
        </div>
      </div>

      {/* Warning banner when rate is missing/invalid */}
      {!hasValidRate && (
        <div className="fee-warning" role="alert">
          <strong>Rate Not Yet Published</strong>
          <p>
            This material group does not yet have a published Colorado rate
            under the 2026 Program Plan. Please consult the PRO for current
            rate information.
          </p>
        </div>
      )}

      {/* Detailed Breakdown */}
      <div className="fee-explanation">
        <div className="fee-explanation-title">Fee Breakdown</div>
        <table className="fee-table">
          <tbody>
            {/* Base Rate - Medium Scenario (uses displayRate for single source of truth) */}
            <tr className="fee-row">
              <td className="fee-row-label">JBC-Approved Medium Scenario Rate</td>
              <td className="fee-row-value">{formatRate(displayRate)}/lb</td>
            </tr>

            {/* Weight */}
            <tr className="fee-row">
              <td className="fee-row-label">Weight</td>
              <td className="fee-row-value">{result.weight_lbs} lbs</td>
            </tr>

            {/* Base Dues (subtotal) */}
            <tr className="fee-row fee-row-subtotal">
              <td className="fee-row-label">Base Dues</td>
              <td className="fee-row-value">{formatCurrency(result.base_dues)}</td>
            </tr>

            {/* Layer 1: PRO Eco-Modulation (Uncapped) */}
            <tr className="fee-row fee-row-layer-header">
              <td className="fee-row-label" colSpan={2}>
                Layer 1: PRO Eco-Modulation (Uncapped)
              </td>
            </tr>

            {/* Eco-Modulation Adjustment - Show dollar delta */}
            <tr className={`fee-row ${hasEcoModulation ? "fee-row-credit" : "fee-row-zero"}`}>
              <td className="fee-row-label">
                {hasEcoModulation
                  ? `PRO Eco-Modulation (${formatPercent(proModulationPercent)})`
                  : "PRO Eco-Modulation"}
              </td>
              <td className="fee-row-value">
                {hasEcoModulation ? `−${formatCurrency(proModulationDelta)}` : "$0.00"}
              </td>
            </tr>

            {/* After Eco-Modulation */}
            <tr className="fee-row">
              <td className="fee-row-label">After PRO Eco-Modulation</td>
              <td className="fee-row-value">{formatCurrency(afterProModulation)}</td>
            </tr>

            {/* Layer 2: CDPHE Performance Benchmarks (Capped at 10%) */}
            <tr className="fee-row fee-row-layer-header">
              <td className="fee-row-label" colSpan={2}>
                Layer 2: CDPHE Performance Benchmarks (max 10% of Base Dues)
              </td>
            </tr>

            {/* CDPHE Performance Benchmark Bonus - Show dollar delta */}
            <tr className={`fee-row ${hasCdpheBonus ? "fee-row-credit" : "fee-row-zero"}`}>
              <td className="fee-row-label">
                {hasCdpheBonus
                  ? `CDPHE Bonus (${formatPercent(cdpheBonusPercent)})`
                  : "CDPHE Bonus"}
              </td>
              <td className="fee-row-value">
                {hasCdpheBonus ? `−${formatCurrency(cdpheBonusDelta)}` : "$0.00"}
              </td>
            </tr>

            {/* After CDPHE Bonus */}
            <tr className="fee-row">
              <td className="fee-row-label">After CDPHE Benchmarks</td>
              <td className="fee-row-value">{formatCurrency(afterCdpheBonus)}</td>
            </tr>

            {/* In-Kind Advertising Credit - Descriptive row */}
            {hasInKindCredit && (
              <tr className="fee-row fee-row-credit">
                <td className="fee-row-label">In-Kind Advertising Credit Applied</td>
                <td className="fee-row-value">-{formatCurrency(inKindCredit)}</td>
              </tr>
            )}

            {/* Final Payable */}
            <tr className="fee-row fee-row-total">
              <td className="fee-row-label">Final Payable</td>
              <td className="fee-row-value">{formatCurrency(finalPayable)}</td>
            </tr>
          </tbody>
        </table>

        <div className="fee-program-info">
          Colorado 2026 Program (HB22-1355) · JBC-Approved Medium Scenario
        </div>

        {/* Medium Scenario Authority Disclosure */}
        <button
          type="button"
          className="policy-toggle"
          onClick={() => setAuthorityExpanded(!authorityExpanded)}
          aria-expanded={authorityExpanded}
        >
          {authorityExpanded ? "Hide authority" : "Authority & Basis"}
        </button>

        {authorityExpanded && (
          <div className="policy-explanation">
            <p>
              &ldquo;The Colorado Legislature&apos;s Joint Budget Committee (JBC) approved
              implementation of the Needs Assessment&apos;s medium scenario which provides
              outcomes and key metrics for objectives that meet the Act&apos;s goals.
              The middle is an average of the base and the high scenarios.&rdquo;
            </p>
            <p className="policy-source">
              <strong>Source:</strong><br />
              Colorado Amended Program Plan (June 2025)<br />
              See p. 33 (Table 6) and p. 190 (Table 34: Interim Base Dues)
            </p>
          </div>
        )}

        <div className="fee-scenario-hint">
          Rates shown reflect the Medium Scenario approved by the Colorado
          Legislature&apos;s Joint Budget Committee (JBC).
        </div>
      </div>
    </div>
  );
}
