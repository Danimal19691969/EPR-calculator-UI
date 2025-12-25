/**
 * Colorado Phase 2 PDF Snapshot Builder
 *
 * SINGLE SOURCE OF TRUTH: This function captures EXACTLY what the UI displays.
 *
 * This builder extracts data using the SAME formatting functions and logic
 * as ColoradoPhase2Breakdown.tsx. The output is a PdfSnapshot containing
 * pre-formatted strings that the PDF renderer displays verbatim.
 *
 * CRITICAL: Every label and value MUST match the UI exactly.
 * If the UI shows "Layer 1: PRO Eco-Modulation (Uncapped)", that EXACT string
 * must appear in the snapshot.
 *
 * This function has NO business logic - it only formats data for display.
 * All calculations are performed by computeColoradoPhase2DerivedValues().
 */

import type { ColoradoPhase2CalculateResponse } from "../services/api";
import { computeColoradoPhase2DerivedValues } from "../utils/coloradoPhase2DerivedValues";
import { generateColoradoPhase2Explanation } from "../utils/coloradoPhase2Explanation";
import { getStateLegal } from "../config/stateLegal";
import type { PdfSnapshot, PdfSnapshotBreakdownRow, PdfSnapshotTimelineStep } from "./PdfSnapshot";
import { PDF_DISCLAIMER_TEXT, PDF_TITLE } from "./labels";

/**
 * Format currency - MUST match ColoradoPhase2Breakdown.formatCurrency exactly.
 */
function formatCurrency(value: number): string {
  if (typeof value !== "number" || isNaN(value)) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Format percent - MUST match ColoradoPhase2Breakdown.formatPercent exactly.
 */
function formatPercent(value: number): string {
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
 * Format rate - MUST match ColoradoPhase2Breakdown.formatRate exactly.
 */
function formatRate(value: number | null): string {
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
 * Input parameters for building a Colorado Phase 2 PDF snapshot.
 */
export interface ColoradoPhase2SnapshotInput {
  /** The calculation result from the API */
  result: ColoradoPhase2CalculateResponse;
  /** The resolved rate from groups API (single source of truth for rate) */
  resolvedRate: number | null;
  /** The material group name */
  groupName: string;
}

/**
 * Build a PDF snapshot for Colorado Phase 2 fee breakdown.
 *
 * This function captures EXACTLY what ColoradoPhase2Breakdown.tsx displays.
 * Every label, every formatted value, every row - identical to the UI.
 *
 * @param input - The input data needed to build the snapshot
 * @returns A complete PdfSnapshot ready for rendering
 */
export function buildColoradoPhase2Snapshot(input: ColoradoPhase2SnapshotInput): PdfSnapshot {
  const { result, resolvedRate, groupName } = input;

  // Use the SAME derived values utility as the UI component
  const derived = computeColoradoPhase2DerivedValues(result);
  const {
    baseDues,
    proModulationDelta,
    afterProModulation,
    cdpheBonusDelta,
    afterCdpheBonus,
    finalPayable,
    proModulationPercent,
    cdpheBonusPercent,
    inKindCredit,
    weightLbs,
  } = derived;

  const hasEcoModulation = proModulationPercent !== 0;
  const hasCdpheBonus = cdpheBonusPercent > 0;
  const hasInKindCredit = inKindCredit > 0;

  // Get state legal info
  const stateLegal = getStateLegal("Colorado");

  // Build breakdown rows - EXACT same structure and labels as UI
  const breakdownRows: PdfSnapshotBreakdownRow[] = [];

  // Row 1: Rate (matches UI exactly)
  breakdownRows.push({
    label: "JBC-Approved Medium Scenario Rate",
    value: `${formatRate(resolvedRate)}/lb`,
    type: "normal",
  });

  // Row 2: Weight
  breakdownRows.push({
    label: "Weight",
    value: `${weightLbs} lbs`,
    type: "normal",
  });

  // Row 3: Base Dues (subtotal)
  breakdownRows.push({
    label: "Base Dues",
    value: formatCurrency(baseDues),
    type: "subtotal",
  });

  // Row 4: Layer 1 Header
  breakdownRows.push({
    label: "Layer 1: PRO Eco-Modulation (Uncapped)",
    value: "",
    type: "header",
  });

  // Row 5: PRO Eco-Modulation (with conditional percentage)
  breakdownRows.push({
    label: hasEcoModulation
      ? `PRO Eco-Modulation (${formatPercent(proModulationPercent)})`
      : "PRO Eco-Modulation",
    value: hasEcoModulation ? `−${formatCurrency(proModulationDelta)}` : "$0.00",
    type: hasEcoModulation ? "credit" : "normal",
  });

  // Row 6: After PRO Eco-Modulation
  breakdownRows.push({
    label: "After PRO Eco-Modulation",
    value: formatCurrency(afterProModulation),
    type: "normal",
  });

  // Row 7: Layer 2 Header
  breakdownRows.push({
    label: "Layer 2: CDPHE Performance Benchmarks (max 10% of Base Dues)",
    value: "",
    type: "header",
  });

  // Row 8: CDPHE Bonus (with conditional percentage)
  breakdownRows.push({
    label: hasCdpheBonus
      ? `CDPHE Bonus (${formatPercent(cdpheBonusPercent)})`
      : "CDPHE Bonus",
    value: hasCdpheBonus ? `−${formatCurrency(cdpheBonusDelta)}` : "$0.00",
    type: hasCdpheBonus ? "credit" : "normal",
  });

  // Row 9: After CDPHE Benchmarks
  breakdownRows.push({
    label: "After CDPHE Benchmarks",
    value: formatCurrency(afterCdpheBonus),
    type: "normal",
  });

  // Row 10: In-Kind Credit (conditional)
  if (hasInKindCredit) {
    breakdownRows.push({
      label: "In-Kind Advertising Credit Applied",
      value: `-${formatCurrency(inKindCredit)}`,
      type: "credit",
    });
  }

  // Row 11: Final Payable (total)
  breakdownRows.push({
    label: "Final Payable",
    value: formatCurrency(finalPayable),
    type: "total",
  });

  // Build timeline steps - EXACT same as UI DeltaTimeline
  const timelineSteps: PdfSnapshotTimelineStep[] = [];

  if (proModulationPercent > 0) {
    timelineSteps.push({
      label: "Eco-Mod",
      sublabel: "PRO Eco-Modulation",
      deltaDisplay: `-${formatCurrency(proModulationDelta)}`,
      deltaMagnitude: proModulationDelta,
    });
  }

  if (cdpheBonusPercent > 0) {
    timelineSteps.push({
      label: "CDPHE",
      sublabel: "CDPHE Performance Benchmarks",
      deltaDisplay: `-${formatCurrency(cdpheBonusDelta)}`,
      deltaMagnitude: cdpheBonusDelta,
    });
  }

  if (hasInKindCredit) {
    timelineSteps.push({
      label: "In-Kind",
      sublabel: "In-Kind Advertising Credit",
      deltaDisplay: `-${formatCurrency(inKindCredit)}`,
      deltaMagnitude: inKindCredit,
    });
  }

  // Build explanation paragraphs using the SAME generator as the UI
  const explanationParagraphs = generateColoradoPhase2Explanation({
    groupName,
    result,
    resolvedRate,
  });

  // Build the complete snapshot
  const snapshot: PdfSnapshot = {
    header: {
      title: PDF_TITLE,
      disclaimer: PDF_DISCLAIMER_TEXT,
    },
    metadata: {
      state: "Colorado",
      programName: "Colorado Phase 2 (2026 Program)",
      materialCategory: groupName,
      weightDisplay: `${weightLbs} lbs`,
      dateGenerated: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    summary: {
      // EXACT UI title - "Estimated 2026 Program Fee"
      title: "Estimated 2026 Program Fee",
      // EXACT formatted amount
      amount: formatCurrency(finalPayable),
      // EXACT scenario label
      scenarioLabel: "JBC-Approved Medium Scenario",
      // Info line matches UI
      infoLine: `${groupName} · ${weightLbs} lbs`,
    },
    breakdownRows,
    timeline: {
      startValueDisplay: formatCurrency(baseDues),
      finalValueDisplay: formatCurrency(finalPayable),
      steps: timelineSteps,
    },
    explanationParagraphs,
    authority: {
      text: `This estimate is calculated under the ${stateLegal.lawName}.`,
      lawReference: stateLegal.statuteReference,
      complianceNotice: "Colorado Phase 2 rates and adjustments are subject to annual updates by CDPHE and the PRO.",
    },
  };

  return snapshot;
}
