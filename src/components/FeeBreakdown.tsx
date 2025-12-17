import type { CalculateResponse, LCABonus } from "../services/api";

interface FeeBreakdownProps {
  result: CalculateResponse | null;
  showExplanation?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getLCABonusLabel(bonus: LCABonus): string {
  if (bonus.type === "none") return "None";
  if (bonus.type === "bonus_a") return "LCA Bonus A";
  if (bonus.type === "bonus_b") {
    return bonus.tier ? `LCA Bonus B (${bonus.tier})` : "LCA Bonus B";
  }
  return "Unknown";
}

export default function FeeBreakdown({
  result,
  showExplanation = true,
}: FeeBreakdownProps) {
  if (!result) {
    return (
      <div className="fee-breakdown">
        <div className="fee-display">
          <div className="fee-display-title">TOTAL EPR FEE</div>
          <div className="fee-display-main">$0.00</div>
          <div className="fee-display-info">Ready to estimate</div>
        </div>
      </div>
    );
  }

  const hasLCABonus = result.lca_bonus.type !== "none" && result.lca_bonus.amount !== 0;

  return (
    <div className="fee-breakdown">
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
          <div className="fee-explanation-content">
            <div className="fee-line-item">
              <span className="fee-line-label">Base Fee</span>
              <span className="fee-line-value">{formatCurrency(result.initial_fee)}</span>
            </div>

            {hasLCABonus && (
              <div className="fee-line-item fee-line-bonus">
                <span className="fee-line-label">{getLCABonusLabel(result.lca_bonus)}</span>
                <span className="fee-line-value">
                  -{formatCurrency(result.lca_bonus.amount)}
                </span>
              </div>
            )}

            <div className="fee-line-item fee-line-total">
              <span className="fee-line-label">Total Fee</span>
              <span className="fee-line-value">{formatCurrency(result.total_fee)}</span>
            </div>
          </div>

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
