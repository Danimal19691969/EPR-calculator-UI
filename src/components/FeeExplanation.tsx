import type { LCAOptionType, ProgramRules } from "../config/programRules";
import type { StateRules } from "../config/stateRules";
import { ExplanationHighlight } from "./ExplanationHighlight";

interface FeeExplanationProps {
  state: string;
  materialLabel: string;
  /** Optional sub-category label for states that support subcategories */
  subcategoryLabel?: string | null;
  weightLbs: number;
  baseRate: number;
  initialFee: number;
  netFee: number;
  lcaSelection: LCAOptionType;
  lcaAdjustmentAmount: number;
  programRules: ProgramRules;
  stateRules: StateRules;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

/**
 * Renders the LCA-specific explanation for Oregon.
 */
function renderOregonLCAExplanation(
  lcaSelection: LCAOptionType,
  lcaAdjustmentAmount: number,
  initialFee: number,
  netFee: number,
  programRules: ProgramRules
): React.ReactNode {
  const lcaOption = programRules.lcaOptions?.[lcaSelection];

  if (!lcaOption) {
    return null;
  }

  if (lcaSelection === "none") {
    return (
      <p className="fee-explanation-paragraph">
        You selected <ExplanationHighlight>"{lcaOption.label}"</ExplanationHighlight>.{" "}
        {lcaOption.description} No adjustment has been applied to your fee.
      </p>
    );
  }

  if (lcaSelection === "bonusA") {
    const reductionPercent = lcaOption.reductionPercent;
    const eligiblePercent = lcaOption.eligiblePortion * 100;

    return (
      <p className="fee-explanation-paragraph">
        You selected <ExplanationHighlight>"{lcaOption.label}"</ExplanationHighlight>.{" "}
        {lcaOption.description} Under this provision,{" "}
        <ExplanationHighlight>{reductionPercent}%</ExplanationHighlight> of the
        eligible fee portion (<ExplanationHighlight>{eligiblePercent}%</ExplanationHighlight>{" "}
        of the initial fee) is credited back. This results in an LCA bonus of{" "}
        <ExplanationHighlight>{formatCurrency(lcaAdjustmentAmount)}</ExplanationHighlight>,
        reducing your fee from <ExplanationHighlight>{formatCurrency(initialFee)}</ExplanationHighlight>{" "}
        to <ExplanationHighlight>{formatCurrency(netFee)}</ExplanationHighlight>.
      </p>
    );
  }

  if (lcaSelection === "bonusB") {
    const reductionPercent = lcaOption.reductionPercent;
    const eligiblePercent = lcaOption.eligiblePortion * 100;
    const multiplierRange = lcaOption.multiplierRange ?? "variable";

    return (
      <p className="fee-explanation-paragraph">
        You selected <ExplanationHighlight>"{lcaOption.label}"</ExplanationHighlight>.{" "}
        {lcaOption.description} This enhanced bonus applies a{" "}
        <ExplanationHighlight>{reductionPercent}%</ExplanationHighlight> reduction
        to the eligible fee portion (<ExplanationHighlight>{eligiblePercent}%</ExplanationHighlight>{" "}
        of the initial fee), with a potential multiplier of{" "}
        <ExplanationHighlight>{multiplierRange}</ExplanationHighlight> based on
        demonstrated impact reductions. Your LCA bonus of{" "}
        <ExplanationHighlight>{formatCurrency(lcaAdjustmentAmount)}</ExplanationHighlight>{" "}
        reduces the fee from <ExplanationHighlight>{formatCurrency(initialFee)}</ExplanationHighlight>{" "}
        to <ExplanationHighlight>{formatCurrency(netFee)}</ExplanationHighlight>.
      </p>
    );
  }

  return null;
}

/**
 * FeeExplanation Component
 *
 * Renders a state-aware, selection-aware explanation of how the EPR fee
 * was calculated. Uses capability-based logic to ensure:
 * - Oregon shows LCA-specific explanations based on user selection
 * - Colorado shows simple fee explanation without LCA language
 * - Other states get appropriate default explanations
 */
export default function FeeExplanation({
  state,
  materialLabel,
  subcategoryLabel,
  weightLbs,
  baseRate,
  initialFee,
  netFee,
  lcaSelection,
  lcaAdjustmentAmount,
  programRules,
  stateRules,
}: FeeExplanationProps) {
  const supportsLCA = stateRules.supportsLCA && programRules.supportsLCA;

  // Format material description with optional subcategory
  const materialDescription = subcategoryLabel ? (
    <>
      <ExplanationHighlight>{materialLabel}</ExplanationHighlight>
      {" ("}
      <ExplanationHighlight>{subcategoryLabel}</ExplanationHighlight>
      {")"}
    </>
  ) : (
    <ExplanationHighlight>{materialLabel}</ExplanationHighlight>
  );

  // Opening paragraph: always show base calculation
  const openingParagraph = supportsLCA ? (
    <p className="fee-explanation-paragraph">
      Your {materialDescription} packaging
      weighing <ExplanationHighlight>{weightLbs} pounds</ExplanationHighlight> in {state}{" "}
      starts with an average fee rate of{" "}
      <ExplanationHighlight>{formatRate(baseRate)}/pound</ExplanationHighlight>,
      resulting in an initial fee of{" "}
      <ExplanationHighlight>{formatCurrency(initialFee)}</ExplanationHighlight>.
    </p>
  ) : (
    <p className="fee-explanation-paragraph">
      Your {materialDescription} packaging
      weighing <ExplanationHighlight>{weightLbs} pounds</ExplanationHighlight> in {state} is
      subject to a fee rate of{" "}
      <ExplanationHighlight>{formatRate(baseRate)} per pound</ExplanationHighlight>. At{" "}
      <ExplanationHighlight>{weightLbs} pounds</ExplanationHighlight>, this results
      in a base fee of <ExplanationHighlight>{formatCurrency(initialFee)}</ExplanationHighlight>.
    </p>
  );

  // LCA explanation (only for states that support it)
  const lcaExplanation = supportsLCA
    ? renderOregonLCAExplanation(
        lcaSelection,
        lcaAdjustmentAmount,
        initialFee,
        netFee,
        programRules
      )
    : null;

  // Non-LCA explanation for states without LCA support
  const nonLCAExplanation = !supportsLCA ? (
    <p className="fee-explanation-paragraph">
      {programRules.defaultExplanation} No additional adjustments apply to this
      calculation.
    </p>
  ) : null;

  // Closing paragraph: restate final fee
  const closingParagraph = (
    <p className="fee-explanation-paragraph fee-explanation-final">
      The final {state} EPR fee for this packaging is estimated at{" "}
      <ExplanationHighlight>{formatCurrency(netFee)}</ExplanationHighlight>.
    </p>
  );

  return (
    <div className="fee-explanation-section">
      <div className="fee-explanation-title">EXPLANATION OF FEE</div>
      <div className="fee-explanation-body">
        {openingParagraph}
        {lcaExplanation}
        {nonLCAExplanation}
        {closingParagraph}
      </div>
    </div>
  );
}
