/**
 * buildTimelineNodesFromBackend - Authoritative Timeline Node Builder
 *
 * SINGLE SOURCE OF TRUTH: This function is THE ONLY way to build timeline
 * nodes from backend data. It is used by BOTH:
 * - BackendTimeline.tsx (on-screen UI)
 * - PrintableResultsLayoutV2.tsx (PDF)
 *
 * CRITICAL INVARIANTS:
 * 1. NO math or computation - only field mapping
 * 2. running_total used VERBATIM from backend
 * 3. delta used VERBATIM from backend
 * 4. Start label = PDF_TIMELINE.startLabel ("Base Dues")
 * 5. Final label = PDF_TIMELINE.finalLabel ("Final")
 * 6. Delta labels = backend step.label
 *
 * Node Structure:
 * - First backend step → "start" node (Base Dues)
 * - Middle steps with delta → "delta" nodes (adjustments)
 * - Last backend step (is_final or last index) → "final" node (Final)
 */

import type { AdjustmentTimelineStep } from "../services/api";
import type { TimelineNode, TimelineModel } from "./TimelineNode";
import { PDF_TIMELINE } from "../pdf/labels";

/**
 * Format currency for display.
 * Uses Intl.NumberFormat for consistent formatting across UI and PDF.
 */
function formatCurrency(value: number): string {
  if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format delta with sign prefix.
 */
function formatDelta(value: number): string {
  if (typeof value !== "number" || isNaN(value) || !isFinite(value) || value === 0) {
    return "$0.00";
  }
  const prefix = value < 0 ? "-" : "+";
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

/**
 * Build timeline nodes from backend adjustment_timeline.
 *
 * This function:
 * - Maps backend steps to TimelineNode[] exactly as PDF expects
 * - Uses PDF_TIMELINE labels for start/final nodes
 * - Performs ZERO math on values
 * - Returns empty array if no steps provided
 *
 * @param backendSteps - Backend-provided adjustment_timeline array
 * @returns TimelineModel with nodes, maxAbsDelta, startValue, finalValue
 */
export function buildTimelineNodesFromBackend(
  backendSteps: AdjustmentTimelineStep[] | undefined
): TimelineModel | null {
  if (!backendSteps || backendSteps.length === 0) {
    return null;
  }

  const nodes: TimelineNode[] = [];
  const firstStep = backendSteps[0];
  const lastStep = backendSteps[backendSteps.length - 1];

  // START NODE: First backend step becomes "start" node
  // Uses PDF_TIMELINE.startLabel for exact PDF parity
  nodes.push({
    id: "start",
    label: PDF_TIMELINE.startLabel, // "Base Dues"
    sublabel: firstStep.description,
    role: "start",
    delta: 0,
    runningTotal: firstStep.running_total,
    valueDisplay: formatCurrency(firstStep.running_total),
    isFinal: false,
  });

  // DELTA NODES: Middle steps with non-zero delta
  // Skip first step (already added as start)
  // Skip final step (will be added as final)
  for (let i = 1; i < backendSteps.length; i++) {
    const step = backendSteps[i];
    const delta = step.amount ?? step.rate_delta ?? 0;
    const isFinal = step.is_final === true || i === backendSteps.length - 1;

    if (isFinal) {
      // This is the final step - add as "final" node instead of delta
      nodes.push({
        id: "final",
        label: PDF_TIMELINE.finalLabel, // "Final"
        sublabel: "Final payable amount",
        role: "final",
        delta: 0,
        runningTotal: step.running_total,
        valueDisplay: formatCurrency(step.running_total),
        isFinal: true,
      });
    } else if (delta !== 0) {
      // Middle adjustment step - add as "delta" node
      nodes.push({
        id: `step-${step.step}`,
        label: step.label,
        sublabel: step.description,
        role: "delta",
        delta,
        runningTotal: step.running_total,
        deltaDisplay: formatDelta(delta),
        valueDisplay: "",
        isFinal: false,
      });
    }
    // Skip steps with delta === 0 that aren't final (shouldn't happen normally)
  }

  // Calculate max absolute delta for bar height normalization
  const maxAbsDelta = Math.max(
    ...nodes
      .filter((n) => n.role === "delta")
      .map((n) => Math.abs(n.delta)),
    1 // Prevent division by zero
  );

  return {
    nodes,
    maxAbsDelta,
    startValue: firstStep.running_total,
    finalValue: lastStep.running_total,
  };
}

/**
 * Extract timeline nodes array from model.
 * Convenience function for components that only need the nodes.
 */
export function getTimelineNodes(
  backendSteps: AdjustmentTimelineStep[] | undefined
): TimelineNode[] {
  const model = buildTimelineNodesFromBackend(backendSteps);
  return model?.nodes ?? [];
}
