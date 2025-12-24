import type { CalculateResponse, LCABonus } from "../services/api";
import type { StateRules } from "../config/stateRules";
import { OREGON_OPERATIONAL_PORTION } from "../config/programRules";

interface FeeBreakdownProps {
  result: CalculateResponse | null;
  baseRate?: number | null;
  stateRules?: StateRules;
  showExplanation?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatRate(value: number): string {
  // Format with up to 4 decimal places, removing trailing zeros
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
  return formatted;
}

function getLCABonusLabel(bonus: LCABonus): string {
  if (bonus.type === "none") return "LCA Adjustment";
  if (bonus.type === "bonus_a") return "LCA Bonus A";
  if (bonus.type === "bonus_b") {
    return bonus.tier ? `LCA Bonus B (${bonus.tier})` : "LCA Bonus B";
  }
  return "LCA Adjustment";
}

export default function FeeBreakdown({
  result,
  baseRate,
  stateRules,
  showExplanation = true,
}: FeeBreakdownProps) {
  const hasResult = result !== null;
  const hasLCABonus = hasResult && result.lca_bonus.type !== "none" && result.lca_bonus.amount !== 0;

  // Capability-based display logic:
  // Show LCA row if state supports it OR if API returned a non-zero bonus
  // This ensures Oregon shows $0.00 (eligibility checked) while Colorado hides it entirely
  const showLCARow = stateRules?.supportsLCA || hasLCABonus;

  // Future modifiers would follow the same pattern:
  // const showRecyclingCredit = stateRules?.supportsRecyclingCredit || hasRecyclingCredit;
  // const showEcoModulation = stateRules?.supportsEcoModulation || hasEcoModulation;

  const breakdownClass = hasResult
    ? "fee-breakdown fee-breakdown--has-result"
    : "fee-breakdown";

  if (!result) {
    return (
      <div className={breakdownClass}>
        <div className="fee-display">
          <div className="fee-display-title">TOTAL EPR FEE</div>
          <div className="fee-display-main">$0.00</div>
          <div className="fee-display-info">Ready to estimate</div>
        </div>
      </div>
    );
  }

  // Oregon 80% operational portion calculation
  // Per Oregon Program Plan (2025-2027), Page 218 — Table 24 (Footnote):
  // LCA bonuses apply only to the operational portion (~80%) of base fees,
  // not the reserve portion (~20%).
  const isOregon = result.state.toLowerCase() === "oregon";
  const operationalPortion = isOregon ? result.initial_fee * OREGON_OPERATIONAL_PORTION : null;

  return (
    <div className={breakdownClass}>
      <div className="fee-display">
        <div className="fee-display-title">TOTAL EPR FEE</div>
        <div className="fee-display-main">{formatCurrency(result.total_fee)}</div>
        <div className="fee-display-info">
          {result.state} • {result.weight_lbs} lbs
        </div>
      </div>

      {showExplanation && (
        <div className="fee-explanation">
          <div className="fee-explanation-title">FEE BREAKDOWN</div>
          <table className="fee-table">
            <tbody>
              {baseRate != null && (
                <>
                  <tr className="fee-row">
                    <td className="fee-row-label">Base Rate</td>
                    <td className="fee-row-value">{formatRate(baseRate)}/lb</td>
                  </tr>
                  <tr className="fee-row">
                    <td className="fee-row-label">Weight</td>
                    <td className="fee-row-value">{result.weight_lbs} lbs</td>
                  </tr>
                </>
              )}

              <tr className="fee-row fee-row-subtotal">
                <td className="fee-row-label">Base Fee</td>
                <td className="fee-row-value">{formatCurrency(result.initial_fee)}</td>
              </tr>

              {/* Oregon 80% Operational Portion: Show when state supports LCA and bonus is claimed */}
              {isOregon && hasLCABonus && operationalPortion !== null && (
                <tr className="fee-row fee-row-operational">
                  <td className="fee-row-label">Operational Portion (80%)</td>
                  <td className="fee-row-value">{formatCurrency(operationalPortion)}</td>
                </tr>
              )}

              {/* LCA Adjustment: Only shown for states that support it (e.g. Oregon)
                  or if API returned a non-zero bonus. Colorado hides this entirely. */}
              {showLCARow && (
                <tr className={`fee-row ${hasLCABonus ? "fee-row-credit" : "fee-row-zero"}`}>
                  <td className="fee-row-label">
                    {getLCABonusLabel(result.lca_bonus)}
                    {isOregon && hasLCABonus && (
                      <span className="fee-row-label-hint"> (10% of operational)</span>
                    )}
                  </td>
                  <td className="fee-row-value">
                    {hasLCABonus ? `-${formatCurrency(result.lca_bonus.amount)}` : formatCurrency(0)}
                  </td>
                </tr>
              )}

              {/* Future fee modifiers would be added here following the same pattern:
                  {showRecyclingCredit && <tr>...</tr>}
                  {showEcoModulation && <tr>...</tr>}
              */}

              <tr className="fee-row fee-row-total">
                <td className="fee-row-label">Net Fee</td>
                <td className="fee-row-value">{formatCurrency(result.total_fee)}</td>
              </tr>
            </tbody>
          </table>

          {result.program_start && (
            <div className="fee-program-info">
              Program start: {result.program_start}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
