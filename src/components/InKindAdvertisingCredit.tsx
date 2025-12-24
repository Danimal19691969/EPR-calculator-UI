/**
 * InKindAdvertisingCredit Component
 *
 * Displays a checkbox for in-kind advertising credit eligibility,
 * with a conditional dollar input for reporting the credit value.
 *
 * ELIGIBILITY: Only available for specific material groups:
 * - newspapers
 * - magazines_/_catalogs
 * - newsprint_(inserts/circulars)
 *
 * COMPLIANCE NOTE: Credit is subject to fair market value determination and
 * verification per Colorado Amended Program Plan (June 2025), pp. 191-193.
 */

import { useState } from "react";

/**
 * Material group keys that are eligible for In-Kind Advertising Credit.
 * These groups represent print publications that may provide in-kind advertising.
 */
export const IN_KIND_ELIGIBLE_GROUPS = [
  "newspapers",
  "magazines_/_catalogs",
  "newsprint_(inserts/circulars)",
] as const;

/**
 * Checks if a material group is eligible for In-Kind Advertising Credit.
 */
export function isInKindEligible(groupKey: string): boolean {
  return IN_KIND_ELIGIBLE_GROUPS.includes(groupKey as typeof IN_KIND_ELIGIBLE_GROUPS[number]);
}

interface InKindAdvertisingCreditProps {
  eligible: boolean;
  onEligibleChange: (eligible: boolean) => void;
  value: number;
  onValueChange: (value: number) => void;
}

export default function InKindAdvertisingCredit({
  eligible,
  onEligibleChange,
  value,
  onValueChange,
}: InKindAdvertisingCreditProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="form-group">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={eligible}
          onChange={(e) => {
            onEligibleChange(e.target.checked);
            // Reset value when unchecked
            if (!e.target.checked) {
              onValueChange(0);
            }
          }}
        />
        <span className="checkbox-label-text">Eligible for In-Kind Advertising Credit</span>
      </label>

      {eligible && (
        <div className="conditional-input">
          <label htmlFor="inkind-value-input" className="conditional-input-label">
            Reported In-Kind Advertising Value ($)
          </label>
          <div className="number-field">
            <input
              id="inkind-value-input"
              type="number"
              inputMode="decimal"
              className="number-input"
              value={value}
              onChange={(e) => onValueChange(Math.max(0, Number(e.target.value)))}
              min={0}
              step={0.01}
            />
            <div className="number-stepper" aria-hidden="false">
              <button
                type="button"
                className="step-btn step-up"
                aria-label="Increase credit"
                onClick={() => onValueChange(value + 1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="step-btn step-down"
                aria-label="Decrease credit"
                onClick={() => onValueChange(Math.max(0, value - 1))}
              >
                ▼
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="form-hint">
        Credit applies only to documented in-kind advertising and is subject to audit.
      </div>

      {/* Collapsible policy explanation */}
      <button
        type="button"
        className="policy-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? "Hide details" : "What qualifies?"}
      </button>

      {expanded && (
        <div className="policy-explanation">
          <p>
            In-kind advertising credits allow qualifying publishers to provide
            advertising in lieu of paying dues, subject to fair market value
            determination and verification.
          </p>
          <p>
            Credits are subject to documentation, verification, and audit.
          </p>
          <p className="policy-source">
            <strong>Source:</strong><br />
            Colorado Amended Program Plan (June 2025)<br />
            Publisher In-Kind in Lieu of Paying Dues (Print and Online Advertising)<br />
            See pp. 191&ndash;193
          </p>
        </div>
      )}
    </div>
  );
}
