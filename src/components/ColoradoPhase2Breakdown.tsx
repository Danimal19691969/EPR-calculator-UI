/**
 * ColoradoPhase2Breakdown Component
 *
 * Displays the fee breakdown for Colorado 2026 Program (HB22-1355) calculations.
 * Uses JBC-Approved Medium Scenario rates.
 *
 * CALCULATION APPROACH:
 * Dollar deltas are computed client-side from base_dues and percentage values returned
 * by the API. This ensures accurate intermediate values while maintaining NaN safety
 * through guarded formatting functions.
 *
 * TWO-LAYER FEE ADJUSTMENT MODEL (Critical — Do Not Collapse):
 * PRO eco-modulation and CDPHE bonuses must be treated as two separate layers.
 *
 * CALCULATION ORDER (Must Match Program Plan):
 * 1. BaseDues = Weight × JBC-Approved Medium Scenario Rate
 * 2. Layer 1: Apply PRO Eco-Modulation (Mandatory, UNCAPPED)
 *    - ProDelta = BaseDues × pro_modulation_percent
 *    - AfterPro = BaseDues − ProDelta
 *    - No 10% cap applies to this layer
 * 3. Layer 2: Apply CDPHE Performance Benchmarks (Optional, CAPPED)
 *    - CDPHEBonusPercent = min(sum(selectedBonuses × 1%), 10%)
 *    - CDPHEDelta = BaseDues × CDPHEBonusPercent
 *    - AfterCDPHE = AfterPro − CDPHEDelta
 *    - The 10% cap applies ONLY to the CDPHE layer
 * 4. Apply In-Kind Advertising Credit (final deduction, if eligible)
 * 5. FinalPayable = max(0, AfterCDPHE − InKindCredit)
 *
 * Source: Colorado Amended Program Plan (June 2025) & CDPHE Proposed Rulemaking (Oct 2025)
 * Reference: Sections 15.2 (Five-Year Program Budget) & 18.9.2 (CDPHE Proposed Rulemaking)
 */

import { useState } from "react";
import type { ColoradoPhase2CalculateResponse } from "../services/api";

interface ColoradoPhase2BreakdownProps {
  result: ColoradoPhase2CalculateResponse | null;
  groupName?: string;
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

function formatRate(value: number): string {
  // Guard against NaN/undefined
  if (typeof value !== "number" || isNaN(value)) {
    return "$0.0000";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function ColoradoPhase2Breakdown({
  result,
  groupName,
}: ColoradoPhase2BreakdownProps) {
  const [authorityExpanded, setAuthorityExpanded] = useState(false);

  if (!result) {
    return null;
  }

  const hasEcoModulation = result.pro_modulation_percent !== 0;
  const hasCdpheBonus = result.cdphe_bonus_percent > 0;
  const hasInKindCredit = result.newspaper_credit > 0;

  // Compute dollar deltas from API response values
  // Layer 1: PRO Eco-Modulation applies to Base Dues (reduction)
  const proModulationDelta = result.base_dues * result.pro_modulation_percent;
  const afterProModulation = result.base_dues - proModulationDelta;

  // Layer 2: CDPHE Bonus applies to Base Dues (reduction, capped at 10%)
  const cdpheBonusDelta = result.base_dues * result.cdphe_bonus_percent;
  const afterCdpheBonus = afterProModulation - cdpheBonusDelta;

  // Final: In-Kind Credit (final deduction, floor at $0)
  const beforeFloor = afterCdpheBonus - result.newspaper_credit;
  const finalPayable = Math.max(0, beforeFloor);

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

      {/* Detailed Breakdown */}
      <div className="fee-explanation">
        <div className="fee-explanation-title">Fee Breakdown</div>
        <table className="fee-table">
          <tbody>
            {/* Base Rate - Medium Scenario */}
            <tr className="fee-row">
              <td className="fee-row-label">JBC-Approved Medium Scenario Rate</td>
              <td className="fee-row-value">{formatRate(result.base_rate_per_lb)}/lb</td>
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
                  ? `PRO Eco-Modulation (${formatPercent(result.pro_modulation_percent)})`
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
                  ? `CDPHE Bonus (${formatPercent(result.cdphe_bonus_percent)})`
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
                <td className="fee-row-value">-{formatCurrency(result.newspaper_credit)}</td>
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
