/**
 * EcoModulationSelector Component
 *
 * Displays a radio group for Design Adjustment (Eco-Modulation) tiers with
 * enriched guidance derived from Table 39 – Proposed Eco-Modulation Factors.
 *
 * COMPLIANCE NOTE: Tiers are illustrative planning categories based on the
 * Colorado Amended Program Plan (June 2025), Section 16: Eco-Modulation Approach.
 * Final eco-modulation determinations are made by the PRO.
 *
 * DESIGN PRINCIPLE: The goal is not to determine eligibility — it is to help
 * producers confidently self-select the most accurate tier based on their actual
 * packaging attributes, while clearly directing them to the authoritative source.
 *
 * Source: Colorado Amended Program Plan (June 2025)
 * Reference: Section 16.1 – Approach to Eco-Modulation, Table 39 (p. 196)
 */

import { useState } from "react";
import { Info } from "lucide-react";

export type EcoModulationTier = "none" | "minor" | "moderate" | "significant";

interface EcoModulationSelectorProps {
  value: EcoModulationTier;
  onChange: (tier: EcoModulationTier) => void;
}

/**
 * Maps tier selection to percentage (decimal) for API payload.
 * These are fee REDUCTIONS (applied as positive percentages that reduce base dues).
 */
export function ecoModulationTierToPercent(tier: EcoModulationTier): number {
  const mapping: Record<EcoModulationTier, number> = {
    none: 0,
    minor: 0.05,
    moderate: 0.10,
    significant: 0.15,
  };
  return mapping[tier];
}

/**
 * Eco-Modulation tier definitions with enriched guidance.
 * Labels and tooltips derived from Table 39 – Proposed Eco-Modulation Factors.
 *
 * DO NOT modify wording without consulting the source document.
 * Source: Colorado Amended Program Plan (June 2025), Section 16.1, Table 39 (p. 196)
 */
interface EcoModulationTierDef {
  id: EcoModulationTier;
  label: string;
  shortDesc: string;
  tooltip: string[];
}

const ECO_MODULATION_TIERS: EcoModulationTierDef[] = [
  {
    id: "none",
    label: "None (0%)",
    shortDesc: "No design adjustment claimed",
    tooltip: [
      "Select this if your packaging does not qualify for any eco-modulation incentive.",
    ],
  },
  {
    id: "minor",
    label: "Tier 1: Minor Reduction (5%)",
    shortDesc: "Low PCR, Standard Labels",
    tooltip: [
      "Low PCR Content: Packaging contains 10–25% post-consumer recycled (PCR) content",
      "Minor Weight Reduction: Small material weight reductions (<5%) compared to prior designs",
      "Standard Labeling: Use of standard, per-unit recycling labels",
    ],
  },
  {
    id: "moderate",
    label: "Tier 2: Moderate Reduction (10%)",
    shortDesc: "Mono-Material, Design for Recyclability",
    tooltip: [
      "Medium PCR Content: Packaging contains 26–50% PCR",
      "Design Improvement: Changes that improve sortability (e.g., switching from a shrink sleeve to a wash-away label)",
      "Mono-Material Conversion: Moving from multi-layer materials to a single, easily recyclable material",
    ],
  },
  {
    id: "significant",
    label: "Tier 3: Significant Reduction (15%)",
    shortDesc: "High PCR, Reuse / Refill",
    tooltip: [
      "High PCR Content: Packaging contains greater than 50% PCR",
      "Reuse / Refill Systems: Packaging participates in a verified commercial reuse or refill system (in market >6 months)",
      "Right-Sizing: Elimination of unnecessary headspace or empty space (significant source reduction)",
    ],
  },
];

export default function EcoModulationSelector({
  value,
  onChange,
}: EcoModulationSelectorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="form-group">
      <label className="tier-selector-label">
        Design Adjustment (Eco-Modulation)
      </label>

      <div className="eco-tier-selector">
        {ECO_MODULATION_TIERS.map((tier) => (
          <div key={tier.id} className="eco-tier-wrapper">
            <label
              className={`eco-tier-option ${value === tier.id ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="eco-modulation-tier"
                value={tier.id}
                checked={value === tier.id}
                onChange={() => onChange(tier.id)}
              />
              <span className="eco-tier-content">
                <span className="eco-tier-label">{tier.label}</span>
                <span className="eco-tier-short-desc">{tier.shortDesc}</span>
              </span>
            </label>

            {/* Expanded tooltip guidance for non-none tiers */}
            {tier.id !== "none" && value === tier.id && (
              <div className="eco-tier-guidance">
                <div className="eco-tier-guidance-header">
                  <Info size={12} />
                  <span>Typical qualifying attributes:</span>
                </div>
                <ul className="eco-tier-guidance-list">
                  {tier.tooltip.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Static disclaimer under selector */}
      <div className="form-hint eco-tier-disclaimer">
        Tiers are estimates based on the June 2025 Program Plan.
        Final qualifying thresholds will be defined in the October 2025 Fee Schedule.
      </div>

      {/* Collapsible Source & Authority disclosure */}
      <button
        type="button"
        className="policy-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? "Hide source" : "Source & Authority"}
      </button>

      {expanded && (
        <div className="policy-explanation">
          <p className="policy-section-title">
            <strong>Source &amp; Authority: Eco-Modulation Factors</strong>
          </p>
          <p className="policy-source">
            <strong>Document:</strong> Colorado Amended Program Plan (June 2025)<br />
            <strong>Section:</strong> 16.1 – Approach to Eco-Modulation<br />
            <strong>See:</strong> Table 39 (p. 196) — "Proposed Eco-Modulation Factors"
          </p>
          <blockquote className="policy-quote">
            &ldquo;The PRO shall modulate dues to provide incentives for design choices
            that reduce environmental impact… and maluses for design choices that
            increase the cost of managing covered materials.&rdquo;
          </blockquote>
          <p className="policy-note">
            <strong>Note:</strong> Exact percentage impacts and qualifying thresholds
            for 2026 will be finalized in the detailed fee schedule published by
            October 31, 2025.
          </p>
        </div>
      )}
    </div>
  );
}
