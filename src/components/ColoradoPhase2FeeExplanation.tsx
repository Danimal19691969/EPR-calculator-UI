/**
 * ColoradoPhase2FeeExplanation Component
 *
 * Renders the fee explanation for Colorado Phase 2 calculations.
 * Uses the shared explanation generator to ensure PDF/UI parity.
 *
 * IMPORTANT: The explanation text comes from generateColoradoPhase2Explanation()
 * which is the SINGLE SOURCE OF TRUTH for both UI and PDF.
 * DO NOT hardcode explanation text in this component.
 */

import type { ColoradoPhase2CalculateResponse } from "../services/api";
import { generateColoradoPhase2Explanation } from "../utils/coloradoPhase2Explanation";

interface ColoradoPhase2FeeExplanationProps {
  result: ColoradoPhase2CalculateResponse | null;
  groupName: string;
  /** Resolved rate from groups API (single source of truth) */
  resolvedRate: number | null;
}

export default function ColoradoPhase2FeeExplanation({
  result,
  groupName,
  resolvedRate,
}: ColoradoPhase2FeeExplanationProps) {
  if (!result) {
    return null;
  }

  // Get explanation paragraphs from single source of truth
  const paragraphs = generateColoradoPhase2Explanation({
    groupName,
    result,
    resolvedRate,
  });

  return (
    <div className="fee-explanation-section">
      <div className="fee-explanation-title">EXPLANATION OF FEE</div>
      <div className="fee-explanation-body">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="fee-explanation-paragraph">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
