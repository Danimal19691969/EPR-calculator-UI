/**
 * OregonLcaExplanation Component
 *
 * Displays detailed explanatory content for the selected Oregon LCA Bonus option.
 * Rendered BELOW the LCA Bonus Selection to support decision-making.
 *
 * IMPORTANT: Bonus A and Bonus B are MUTUALLY EXCLUSIVE per Oregon Program Plan p.214:
 * "For each SKU or batch of SKUs, a producer will be eligible for either Bonus A or Bonus B, but not both bonuses."
 *
 * Source: Oregon Program Plan (2025-2027), Pages 212-216 & Table 24 (p. 218)
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { LCAOptionType } from "../config/programRules";

export type OregonBonusBTier = "tier1" | "tier2" | "tier3";

interface OregonLcaExplanationProps {
  /** Currently selected LCA option */
  selectedOption: LCAOptionType;
  /** Current Bonus B tier selection (only used when bonusB is selected) */
  bonusBTier: OregonBonusBTier | null;
  /** Callback when Bonus B tier changes */
  onBonusBTierChange: (tier: OregonBonusBTier) => void;
}

/**
 * Get the flat credit amount for a Bonus B tier.
 * Per Oregon Program Plan, these are placeholder amounts.
 */
export function getBonusBTierCredit(tier: OregonBonusBTier | null): number {
  if (!tier) return 0;
  const credits: Record<OregonBonusBTier, number> = {
    tier1: 25000, // 10-40% impact reduction
    tier2: 40000, // 40-70% impact reduction
    tier3: 50000, // >70% impact reduction
  };
  return credits[tier];
}

export default function OregonLcaExplanation({
  selectedOption,
  bonusBTier,
  onBonusBTierChange,
}: OregonLcaExplanationProps) {
  const [expandedA, setExpandedA] = useState(false);
  const [expandedB, setExpandedB] = useState(false);

  // Don't render anything if no LCA bonus is selected
  if (selectedOption === "none") {
    return null;
  }

  return (
    <div className="oregon-lca-explanation">
      {/* ============================================
          BONUS A: LCA Evaluation & Disclosure
          ============================================ */}
      {selectedOption === "bonusA" && (
        <div className="oregon-bonus-explanation-item">
          <div className="oregon-bonus-explanation-header">
            <span className="oregon-bonus-label">
              Bonus A: LCA Evaluation &amp; Disclosure
            </span>
            <span className="oregon-bonus-status oregon-bonus-status-available">
              Available for 2026 Fees
            </span>
          </div>

          <div className="oregon-bonus-summary">
            <p><strong>Summary:</strong> 10% reduction applied to operational fees only (excludes ~20% program reserves). Effective reduction is approximately 8% of total base fees.</p>
            <p><strong>Cap:</strong> $20,000 per SKU.</p>
            <p><strong>Limit:</strong> Max 10 SKUs per producer.</p>
          </div>

          <button
            type="button"
            className="policy-toggle"
            onClick={() => setExpandedA(!expandedA)}
            aria-expanded={expandedA}
          >
            {expandedA ? "Hide source" : "Source & Authority"}
          </button>

          {expandedA && (
            <div className="policy-explanation">
              <p className="policy-source">
                <strong>Source:</strong> Oregon Program Plan (2025-2027)<br />
                <strong>Section:</strong> Eco-Modulation (Graduated Fee Structure)<br />
                <strong>See:</strong> Page 212 &amp; Table 24 (p. 218)
              </p>
              <p className="policy-verbatim-label"><strong>Verbatim Text:</strong></p>
              <blockquote className="policy-quote">
                &ldquo;CAA will grant Bonus A to producers that perform an LCA and disclosure on up to 10 stockkeeping units... Set at 10% of base fees for all materials in the SKU, up to a cap of $20,000... Bonus A will be granted as a credit on the fee invoice in the following program year.&rdquo;
              </blockquote>

              <p className="policy-source policy-source-additional">
                <strong>Source:</strong> Oregon Program Plan (2025-2027)<br />
                <strong>See:</strong> Page 218 — Table 24 (Footnote)
              </p>
              <p className="policy-verbatim-label"><strong>Verbatim Footnote Text:</strong></p>
              <blockquote className="policy-quote">
                &ldquo;Bonus A is set at 10% discount of base fees (excluding the portion of reserves in the base fees, which is estimated at approximately 20%). This results in a net reduction of approximately 8% and not approximately 10% of base fees, after the application of Bonus A.&rdquo;
              </blockquote>
            </div>
          )}

          <div className="form-hint">
            FinalFee = (Weight × Rate × 0.80) × 0.10. Fee cannot go below $0.
          </div>
        </div>
      )}

      {/* ============================================
          BONUS B: Significant Impact Reduction
          ============================================ */}
      {selectedOption === "bonusB" && (
        <div className="oregon-bonus-explanation-item">
          <div className="oregon-bonus-explanation-header">
            <span className="oregon-bonus-label">
              Bonus B: Significant Impact Reduction
            </span>
            <span className="oregon-bonus-status oregon-bonus-status-future">
              <AlertTriangle size={12} />
              Available for 2027 Fees only
            </span>
          </div>

          <div className="oregon-bonus-summary">
            <p><strong>Summary:</strong> Higher reward for demonstrating 10-70%+ impact reduction. Applies to operational fees only (excludes ~20% program reserves).</p>
            <p><strong>Structure:</strong> Tier-based credit (exact amounts TBD, placeholder estimates shown).</p>
            <p><strong>Cap:</strong> $50,000 per SKU.</p>
          </div>

          {/* Tier selector */}
          <div className="oregon-bonus-tier-selector">
            <label className="oregon-bonus-tier-label">Select Tier:</label>
            <select
              value={bonusBTier || "tier1"}
              onChange={(e) => onBonusBTierChange(e.target.value as OregonBonusBTier)}
              className="oregon-bonus-tier-dropdown"
            >
              {/* NOTE: These are placeholder/temporary estimates per Oregon Program Plan */}
              <option value="tier1">Tier 1: 10-40% (${getBonusBTierCredit("tier1").toLocaleString()} credit)</option>
              <option value="tier2">Tier 2: 40-70% (${getBonusBTierCredit("tier2").toLocaleString()} credit)</option>
              <option value="tier3">Tier 3: &gt;70% (${getBonusBTierCredit("tier3").toLocaleString()} credit)</option>
            </select>
          </div>

          <div className="oregon-bonus-warning">
            <AlertTriangle size={12} />
            <span>Available for 2027 Fees only</span>
          </div>

          <button
            type="button"
            className="policy-toggle"
            onClick={() => setExpandedB(!expandedB)}
            aria-expanded={expandedB}
          >
            {expandedB ? "Hide source" : "Source & Authority"}
          </button>

          {expandedB && (
            <div className="policy-explanation">
              <p className="policy-source">
                <strong>Source:</strong> Oregon Program Plan (2025-2027)<br />
                <strong>See:</strong> Page 213 &amp; Table 24 (p. 218)
              </p>
              <p className="policy-verbatim-label"><strong>Verbatim Text:</strong></p>
              <blockquote className="policy-quote">
                &ldquo;Bonus B will be granted to producers that conduct an LCA that demonstrates significant impact reductions... CAA will set Bonus B higher than Bonus A across all three impact reduction tiers... up to a cap amount of $50,000... For each SKU, a producer will be eligible for either Bonus A or Bonus B, but not both.&rdquo;
              </blockquote>

              <p className="policy-source policy-source-additional">
                <strong>Note:</strong> Like Bonus A, Bonus B applies to the operational portion of fees only (excludes ~20% reserves per Table 24 Footnote).
              </p>
            </div>
          )}

          <div className="form-hint">
            FinalFee = (Weight × Rate) − Selected Tier Credit. Fee cannot go below $0.
          </div>
        </div>
      )}

      {/* ============================================
          BONUS C: Reuse Transition (Pending Amendment)
          Note: This should never be selectable, but we show
          the explanation if somehow selected
          ============================================ */}
      {selectedOption === "bonusC" && (
        <div className="oregon-bonus-explanation-item oregon-bonus-explanation-item-disabled">
          <div className="oregon-bonus-explanation-header">
            <span className="oregon-bonus-label">
              Bonus C: Reuse Transition (Pending Amendment)
            </span>
            <span className="oregon-bonus-status oregon-bonus-status-pending">
              <AlertTriangle size={12} />
              Pending Amendment
            </span>
          </div>

          <div className="oregon-bonus-summary">
            <p>Bonus C details will be submitted in a future program plan amendment.</p>
          </div>

          <div className="oregon-bonus-warning">
            <AlertTriangle size={12} />
            <span>Not yet available for selection.</span>
          </div>
        </div>
      )}
    </div>
  );
}
