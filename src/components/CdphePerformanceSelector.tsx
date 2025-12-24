/**
 * CdphePerformanceSelector Component
 *
 * Displays four independent checkboxes for CDPHE Performance Benchmarks.
 * Each benchmark represents a 1% fee reduction of Base Dues.
 *
 * TWO-LAYER FEE ADJUSTMENT MODEL (Critical — Do Not Collapse):
 * - Layer 1: PRO Eco-Modulation (Mandatory, Uncapped) — Applied first
 * - Layer 2: CDPHE Performance Bonus (Optional, Capped at 10%) — Applied second
 *
 * CALCULATION ORDER (Must Match Program Plan):
 * 1. BaseDues = Weight × JBC-Approved Medium Scenario Rate
 * 2. AdjustedFee = BaseDues ± PRO adjustments (Layer 1, uncapped)
 * 3. CDPHEBonusPercent = min(sum(selectedBonuses × 1%), 10%)
 * 4. CDPHEBonusAmount = BaseDues × CDPHEBonusPercent
 * 5. FinalFee = AdjustedFee − CDPHEBonusAmount (Layer 2, capped)
 * 6. FinalFee ≥ $0.00 (floor enforced)
 *
 * NOTE: The "Standardized Sorting Instructions" benchmark is disabled until 2029.
 * CDPHE explicitly delayed this bonus to allow statewide alignment with standardized
 * national labeling systems (e.g., How2Recycle).
 *
 * Source: Colorado Amended Program Plan (June 2025)
 * Reference: Sections 15.2 (Five-Year Program Budget) & 18.9.2 (CDPHE Proposed Rulemaking, Oct 2025)
 */

import { useState } from "react";
import { Info } from "lucide-react";

export interface CdpheCriteria {
  endMarketUtilization: boolean;
  certifiedCompostable: boolean;
  innovationCaseStudy: boolean;
  standardizedSorting: boolean;
}

interface CdphePerformanceSelectorProps {
  value: CdpheCriteria;
  onChange: (criteria: CdpheCriteria) => void;
}

/**
 * CDPHE Performance Benchmark definitions with exact labels and tooltips.
 * DO NOT modify wording - these match policy documents exactly.
 *
 * Source: Colorado Amended Program Plan (June 2025) & CDPHE Proposed Rulemaking (October 2025)
 */
const CDPHE_BENCHMARKS = [
  {
    key: "endMarketUtilization" as const,
    label: "Colorado End-Market Utilization",
    // Exact tooltip text - do not paraphrase
    tooltip: "Uses MRL material with 20%+ US-generated PCR content processed by a Colorado business.",
    disabled: false,
  },
  {
    key: "certifiedCompostable" as const,
    label: "Certified Compostable Material",
    // Exact tooltip text - do not paraphrase
    tooltip: "Meets ASTM standards and Colorado-specific labeling for compostability.",
    disabled: false,
  },
  {
    key: "innovationCaseStudy" as const,
    label: "Qualified Innovation Case Study",
    // Exact tooltip text - do not paraphrase
    tooltip: "Demonstrates measurable recyclability or waste reduction benefits via an approved study.",
    disabled: false,
  },
  {
    key: "standardizedSorting" as const,
    label: "Standardized Sorting Instructions",
    // Exact hover tooltip for disabled benchmark - do not paraphrase
    tooltip: "Performance bonus for standardized on-package sorting instructions becomes available in 2029 per CDPHE Proposed Rule (Section 18.9.2).",
    // POLICY: Disabled until 2029 per CDPHE Proposed Amendments to Section 18
    // Reason: CDPHE explicitly delayed this bonus to allow statewide alignment
    // with standardized national labeling systems (e.g., How2Recycle).
    disabled: true,
    // Exact inline note text - do not paraphrase
    disabledNote: "Available starting in 2029 per CDPHE Proposed Rule.",
  },
];

/**
 * Calculates the total CDPHE bonus percentage (decimal) from selected benchmarks.
 * Each benchmark provides 1% (0.01) reduction of Base Dues.
 *
 * POLICY CONSTRAINT: Total CDPHE layer reduction is capped at 10% (0.10) of Base Dues.
 * The 10% cap applies ONLY to the CDPHE layer, not to PRO incentives.
 *
 * Source: Colorado Amended Program Plan (June 2025), Section 15.2
 */
export function cdpheCriteriaToPercent(criteria: CdpheCriteria): number {
  // Count only enabled benchmarks that are selected
  // POLICY: standardizedSorting is disabled until 2029, so exclude it from calculation
  const count = [
    criteria.endMarketUtilization,
    criteria.certifiedCompostable,
    criteria.innovationCaseStudy,
    // criteria.standardizedSorting is excluded - disabled until 2029 per CDPHE Proposed Rule
  ].filter(Boolean).length;

  // Each benchmark = 1% reduction, capped at 10% for CDPHE layer only
  // POLICY: "Total reductions from the CDPHE-designated bonus schedule shall not exceed
  // 10% of a producer's base responsibility dues."
  return Math.min(count * 0.01, 0.10);
}

/**
 * Returns the count of selected (and enabled) benchmarks.
 * Disabled benchmarks never affect totals.
 */
export function getSelectedCriteriaCount(criteria: CdpheCriteria): number {
  return [
    criteria.endMarketUtilization,
    criteria.certifiedCompostable,
    criteria.innovationCaseStudy,
    // standardizedSorting excluded - disabled until 2029
  ].filter(Boolean).length;
}

/**
 * Returns the maximum possible CDPHE reduction percentage currently available.
 * Currently 3% (3 enabled benchmarks × 1%), will be 4% when sorting instructions enable in 2029.
 */
export function getMaxCdphePercent(): number {
  // 3 benchmarks enabled currently, 4th (standardizedSorting) available in 2029
  return 0.03;
}

export default function CdphePerformanceSelector({
  value,
  onChange,
}: CdphePerformanceSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedCount = getSelectedCriteriaCount(value);
  const selectedPercent = selectedCount; // 1% per benchmark

  function handleBenchmarkChange(key: keyof CdpheCriteria, checked: boolean) {
    // POLICY: Disabled benchmarks cannot affect calculations
    const benchmark = CDPHE_BENCHMARKS.find((b) => b.key === key);
    if (benchmark?.disabled) {
      return; // Ignore changes to disabled benchmarks
    }
    onChange({ ...value, [key]: checked });
  }

  return (
    <div className="form-group">
      <label className="tier-selector-label">
        CDPHE Performance Benchmarks
      </label>
      <div className="criteria-status">
        Selected: {selectedPercent}% reduction (max 10% of Base Dues)
      </div>
      <div className="criteria-selector">
        {CDPHE_BENCHMARKS.map((benchmark) => (
          <div key={benchmark.key} className="benchmark-wrapper">
            <label
              className={`criteria-option ${value[benchmark.key] && !benchmark.disabled ? "selected" : ""} ${benchmark.disabled ? "criteria-option-disabled" : ""}`}
              title={benchmark.tooltip}
            >
              <input
                type="checkbox"
                // POLICY: Disabled benchmarks are forced false and non-interactive
                checked={benchmark.disabled ? false : value[benchmark.key]}
                onChange={(e) => handleBenchmarkChange(benchmark.key, e.target.checked)}
                disabled={benchmark.disabled}
              />
              <span className="criteria-option-text">
                <span className="criteria-option-label">
                  {benchmark.label} (1%)
                </span>
                <span className="criteria-option-tooltip">
                  {benchmark.tooltip}
                </span>
              </span>
            </label>
            {benchmark.disabled && benchmark.disabledNote && (
              <div className="benchmark-disabled-note">
                <Info size={12} />
                <span>{benchmark.disabledNote}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="form-hint">
        Each qualifying benchmark provides a 1% reduction of Base Dues.
        Total CDPHE layer reduction is capped at 10% of Base Dues.
        Bonuses shown are state-designated, not guaranteed.
        Eligibility is determined during CDPHE compliance review and subject to audit.
      </div>

      {/* Collapsible source & authority disclosure */}
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
            <strong>Source &amp; Authority — CDPHE Performance Bonus</strong>
          </p>
          <p className="policy-source">
            <strong>Document:</strong> Colorado Amended Program Plan (June 2025)<br />
            <strong>Sections:</strong> 15.2 (Five-Year Program Budget) &amp; 18.9.2 (CDPHE Proposed Rulemaking, Oct 2025)<br />
            <strong>See:</strong> p. 177 (Eco-Modulation Fund)
          </p>
          <blockquote className="policy-quote">
            &ldquo;Verified performance achievements may qualify producers for incremental fee reductions.
            The bonus for standardized on-package sorting instructions shall be available to producers starting in 2029.
            Total reductions from the CDPHE-designated bonus schedule shall not exceed 10% of a producer&apos;s base responsibility dues.&rdquo;
          </blockquote>
        </div>
      )}
    </div>
  );
}
