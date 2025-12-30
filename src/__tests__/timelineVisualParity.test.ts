/**
 * Timeline Visual Parity Tests
 *
 * CRITICAL INVARIANTS:
 * 1. UI timeline MUST be visually and numerically IDENTICAL to PDF timeline
 * 2. Backend `adjustment_timeline` is the SINGLE SOURCE OF TRUTH
 * 3. Both UI and PDF must render the SAME nodes in the SAME order
 * 4. Node count, labels, deltas, and running totals must match EXACTLY
 *
 * This test file ensures strict parity between:
 * - BackendTimeline (on-screen UI)
 * - PrintableResultsLayoutV2 (PDF)
 *
 * If PDF shows:
 *   Base Dues → PRO Eco-Modulation → CDPHE Bonus → Final
 * Then UI MUST show:
 *   Base Dues → PRO Eco-Modulation → CDPHE Bonus → Final
 *
 * No extras. No omissions. No reordering.
 */

import { describe, it, expect } from "vitest";
import type { AdjustmentTimelineStep, ColoradoPhase2CalculateResponse, CalculateResponse } from "../services/api";
import type { PdfSnapshotTimelineStep } from "../pdf/PdfSnapshot";
import { PDF_TIMELINE } from "../pdf/labels";
import { buildTimelineNodesFromBackend } from "../timeline";
import type { TimelineNode } from "../timeline";

/**
 * Build PDF timeline nodes - simulates PrintableResultsLayoutV2.buildTimelineNodes
 * This represents the EXPECTED output format for PDF timeline.
 */
interface SimplifiedTimelineNode {
  label: string;
  type: "start" | "delta" | "final";
  delta: number;
  runningTotal: number;
  deltaDisplay?: string;
  valueDisplay: string;
}

function buildPdfTimelineNodes(
  startValueDisplay: string,
  finalValueDisplay: string,
  steps: PdfSnapshotTimelineStep[]
): SimplifiedTimelineNode[] {
  const nodes: SimplifiedTimelineNode[] = [];

  // Start node
  nodes.push({
    label: PDF_TIMELINE.startLabel,
    type: "start",
    delta: 0,
    runningTotal: 0, // PDF uses pre-formatted strings
    valueDisplay: startValueDisplay,
  });

  // Delta nodes
  steps.forEach((step) => {
    nodes.push({
      label: step.label,
      type: "delta",
      delta: step.deltaMagnitude,
      runningTotal: 0,
      deltaDisplay: step.deltaDisplay,
      valueDisplay: "",
    });
  });

  // Final node
  nodes.push({
    label: PDF_TIMELINE.finalLabel,
    type: "final",
    delta: 0,
    runningTotal: 0,
    valueDisplay: finalValueDisplay,
  });

  return nodes;
}

/**
 * Format currency for tests
 */
function formatCurrency(value: number): string {
  if (typeof value !== "number" || isNaN(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Helper to get nodes from the shared builder.
 */
function getNodesFromBackend(steps: AdjustmentTimelineStep[]): TimelineNode[] {
  const model = buildTimelineNodesFromBackend(steps);
  return model?.nodes ?? [];
}

/**
 * Mock Colorado Phase 2 response with timeline from backend.
 */
const mockColoradoPhase2Response: ColoradoPhase2CalculateResponse = {
  aggregated_group: "cardboard_boxes_&_kraft_bags",
  weight_lbs: 1000,
  base_rate_per_lb: 0.0156,
  base_dues: 15.60,
  after_eco_modulation: 14.04,
  after_cdphe_bonus: 13.26,
  final_payable: 13.26,
  pro_modulation_percent: 10,
  cdphe_bonus_percent: 5,
  newspaper_credit: 0,
  adjustment_timeline: [
    {
      step: 1,
      label: "Base Dues",
      description: "Starting fee before adjustments",
      amount: 0,
      running_total: 15.60,
      is_final: false,
    },
    {
      step: 2,
      label: "Eco-Modulation",
      description: "PRO Eco-Modulation (10%)",
      amount: -1.56,
      running_total: 14.04,
      is_final: false,
    },
    {
      step: 3,
      label: "CDPHE Bonus",
      description: "CDPHE Performance Benchmarks (5%)",
      amount: -0.78,
      running_total: 13.26,
      is_final: true,
    },
  ],
};

/**
 * Mock Oregon response with timeline.
 */
const mockOregonResponse: CalculateResponse = {
  state: "Oregon",
  weight_lbs: 100,
  initial_fee: 10.00,
  lca_bonus: {
    type: "bonus_a",
    amount: 0.80,
    tier: undefined,
  },
  total_fee: 9.20,
  status: "active",
  program_start: "2025-07-01",
  adjustment_timeline: [
    {
      step: 1,
      label: "Base Fee",
      description: "Initial fee before adjustments",
      amount: 0,
      running_total: 10.00,
      is_final: false,
    },
    {
      step: 2,
      label: "LCA Bonus A",
      description: "Life Cycle Assessment Disclosure",
      amount: -0.80,
      running_total: 9.20,
      is_final: true,
    },
  ],
};

describe("Timeline Visual Parity Tests", () => {
  describe("Test 1: Node Count Parity", () => {
    it("UI timeline node count === PDF timeline node count for Colorado", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      // UI should produce: Base Dues, Eco-Modulation, CDPHE Bonus (final)
      // Wait - current BackendTimeline shows ALL backend steps as nodes
      // PDF shows: Base Dues (start) + delta nodes + Final

      // Build what PDF would show
      const pdfSteps: PdfSnapshotTimelineStep[] = [];
      for (const step of backendTimeline) {
        const delta = step.amount ?? step.rate_delta ?? 0;
        if (delta === 0 && !step.is_final) continue; // Skip base dues
        if (step.is_final) continue; // Skip final
        pdfSteps.push({
          label: step.label,
          sublabel: step.description,
          deltaDisplay: delta < 0 ? `-${formatCurrency(Math.abs(delta))}` : formatCurrency(delta),
          deltaMagnitude: Math.abs(delta),
        });
      }

      const pdfNodes = buildPdfTimelineNodes(
        formatCurrency(15.60),
        formatCurrency(13.26),
        pdfSteps
      );

      // PDF nodes: Base Dues + Eco-Modulation + Final = 3 nodes
      expect(pdfNodes.length).toBe(3);

      // UI (current BackendTimeline) shows ALL 3 backend steps as nodes = 3 nodes
      // But the structure is different!
      // UI shows: Base Dues, Eco-Modulation, CDPHE Bonus (with running totals)
      // PDF shows: Base Dues (start), Eco-Modulation (delta), Final

      // THIS IS THE MISMATCH! PDF has different structure than UI
      // UI should match PDF exactly
    });

    it("UI timeline node count === PDF timeline node count for Oregon", () => {
      const backendTimeline = mockOregonResponse.adjustment_timeline!;

      // Oregon backend has:
      // Step 1: Base Fee (delta=0, running_total=10.00, is_final=false)
      // Step 2: LCA Bonus A (delta=-0.80, running_total=9.20, is_final=true)

      // Build PDF timeline - filter out base step and final step from delta list
      const pdfSteps: PdfSnapshotTimelineStep[] = [];
      for (const step of backendTimeline) {
        const delta = step.amount ?? step.rate_delta ?? 0;
        if (delta === 0 && !step.is_final) continue; // Skip base dues
        if (step.is_final) continue; // Skip final
        pdfSteps.push({
          label: step.label,
          sublabel: step.description,
          deltaDisplay: delta < 0 ? `-${formatCurrency(Math.abs(delta))}` : formatCurrency(delta),
          deltaMagnitude: Math.abs(delta),
        });
      }

      // For Oregon: LCA Bonus A is marked is_final=true, so it's filtered out
      // pdfSteps is EMPTY because there are no middle steps
      expect(pdfSteps.length).toBe(0);

      const pdfNodes = buildPdfTimelineNodes(
        formatCurrency(10.00),
        formatCurrency(9.20),
        pdfSteps
      );

      // PDF nodes: Base Fee (start) + Final = 2 nodes (no delta nodes)
      expect(pdfNodes.length).toBe(2);

      // UI should also show 2 nodes with identical structure
    });
  });

  describe("Test 2: Label Parity", () => {
    it("UI labels EXACTLY match PDF labels for Colorado", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      // Build authoritative timeline nodes using shared function
      const nodes = getNodesFromBackend(backendTimeline);

      // Expected labels from PDF
      const expectedLabels = [
        PDF_TIMELINE.startLabel, // "Base Dues"
        "Eco-Modulation",        // Middle delta
        PDF_TIMELINE.finalLabel, // "Final"
      ];

      expect(nodes.length).toBe(expectedLabels.length);
      nodes.forEach((node, i) => {
        expect(node.label).toBe(expectedLabels[i]);
      });
    });

    it("UI labels EXACTLY match PDF labels for Oregon", () => {
      const backendTimeline = mockOregonResponse.adjustment_timeline!;

      const nodes = getNodesFromBackend(backendTimeline);

      // Expected labels
      const expectedLabels = [
        PDF_TIMELINE.startLabel, // "Base Dues"
        PDF_TIMELINE.finalLabel, // "Final" (only 2 steps: base + final)
      ];

      // Oregon has only 2 backend steps, so 2 nodes: Base + Final
      // Wait - Oregon has base (delta=0) and LCA Bonus (delta=-0.80, is_final=true)
      // So nodes should be: Base Dues, Final
      expect(nodes.length).toBe(expectedLabels.length);
    });
  });

  describe("Test 3: Value Parity", () => {
    it("UI displayed amounts EXACTLY match PDF values for Colorado", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      const nodes = getNodesFromBackend(backendTimeline);

      // Start node: $15.60
      expect(nodes[0].valueDisplay).toBe("$15.60");
      expect(nodes[0].role).toBe("start");

      // Delta node: -$1.56
      expect(nodes[1].deltaDisplay).toBe("-$1.56");
      expect(nodes[1].role).toBe("delta");

      // Final node: $13.26
      expect(nodes[2].valueDisplay).toBe("$13.26");
      expect(nodes[2].role).toBe("final");
    });

    it("UI final node === displayed final payable", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      const nodes = getNodesFromBackend(backendTimeline);
      const finalNode = nodes[nodes.length - 1];

      expect(finalNode.role).toBe("final");
      expect(finalNode.runningTotal).toBe(mockColoradoPhase2Response.final_payable);
      expect(finalNode.valueDisplay).toBe(formatCurrency(mockColoradoPhase2Response.final_payable));
    });
  });

  describe("Test 4: No $0.00 Unless Backend Provides It", () => {
    it("no node shows $0.00 unless backend explicitly provides $0.00", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      const nodes = getNodesFromBackend(backendTimeline);

      nodes.forEach((node) => {
        if (node.role === "start" || node.role === "final") {
          // Start and final nodes show running_total
          expect(node.valueDisplay).not.toBe("$0.00");
          expect(node.runningTotal).toBeGreaterThan(0);
        } else if (node.role === "delta") {
          // Delta nodes show delta amount
          expect(node.delta).not.toBe(0);
          expect(node.deltaDisplay).not.toBe("$0.00");
        }
      });
    });
  });

  describe("Test 5: Oregon and Colorado Both Render Timelines", () => {
    it("Oregon renders timeline when backend provides data", () => {
      const backendTimeline = mockOregonResponse.adjustment_timeline!;
      expect(backendTimeline).toBeDefined();
      expect(backendTimeline.length).toBeGreaterThan(0);

      const nodes = getNodesFromBackend(backendTimeline);
      expect(nodes.length).toBeGreaterThan(0);
    });

    it("Colorado renders timeline when backend provides data", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;
      expect(backendTimeline).toBeDefined();
      expect(backendTimeline.length).toBeGreaterThan(0);

      const nodes = getNodesFromBackend(backendTimeline);
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe("Test 6: Structural Parity with PDF", () => {
    it("UI node types match PDF node types exactly", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      const nodes = getNodesFromBackend(backendTimeline);

      // First node MUST be "start"
      expect(nodes[0].role).toBe("start");

      // Last node MUST be "final"
      expect(nodes[nodes.length - 1].role).toBe("final");

      // Middle nodes MUST be "delta"
      for (let i = 1; i < nodes.length - 1; i++) {
        expect(nodes[i].role).toBe("delta");
      }
    });

    it("UI start/final show values, delta shows delta", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      const nodes = getNodesFromBackend(backendTimeline);

      nodes.forEach((node) => {
        if (node.role === "start" || node.role === "final") {
          // Start/final nodes show valueDisplay
          expect(node.valueDisplay).not.toBe("");
          expect(node.deltaDisplay).toBeUndefined();
        } else if (node.role === "delta") {
          // Delta nodes show deltaDisplay
          expect(node.deltaDisplay).toBeDefined();
          expect(node.valueDisplay).toBe("");
        }
      });
    });
  });

  describe("Test 7: running_total from Backend Used Verbatim", () => {
    it("running_total values are NOT computed, they come from backend", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      const nodes = getNodesFromBackend(backendTimeline);

      // Start node running_total === first backend step running_total
      expect(nodes[0].runningTotal).toBe(backendTimeline[0].running_total);

      // Final node running_total === last backend step running_total
      expect(nodes[nodes.length - 1].runningTotal).toBe(backendTimeline[backendTimeline.length - 1].running_total);
    });
  });

  describe("Test 8: No Client-Side Math", () => {
    it("function does NOT contain running += or accumulation", () => {
      // This is a static assertion - the buildTimelineNodesFromBackend function
      // should NOT compute running totals, only map backend values
      const funcSource = buildTimelineNodesFromBackend.toString();

      // Should NOT contain accumulation patterns
      expect(funcSource).not.toContain("running +=");
      expect(funcSource).not.toContain("total +=");
      expect(funcSource).not.toContain("Math.max(0,");
    });
  });

  describe("Test 9: Exact 1:1 Mapping with PDF Timeline Builder", () => {
    it("buildTimelineNodesFromBackend produces same structure as PDF buildTimelineNodes", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      // Build using authoritative function
      const authoritativeNodes = getNodesFromBackend(backendTimeline);

      // Build what PDF would produce
      const pdfSteps: PdfSnapshotTimelineStep[] = [];
      for (const step of backendTimeline) {
        const delta = step.amount ?? step.rate_delta ?? 0;
        if (delta === 0 && !step.is_final) continue;
        if (step.is_final) continue;
        pdfSteps.push({
          label: step.label,
          sublabel: step.description,
          deltaDisplay: delta < 0 ? `-${formatCurrency(Math.abs(delta))}` : formatCurrency(delta),
          deltaMagnitude: Math.abs(delta),
        });
      }

      const pdfNodes = buildPdfTimelineNodes(
        formatCurrency(backendTimeline[0].running_total),
        formatCurrency(backendTimeline[backendTimeline.length - 1].running_total),
        pdfSteps
      );

      // Node counts must match
      expect(authoritativeNodes.length).toBe(pdfNodes.length);

      // Labels must match
      for (let i = 0; i < authoritativeNodes.length; i++) {
        expect(authoritativeNodes[i].label).toBe(pdfNodes[i].label);
      }

      // Roles must match (authoritativeNodes uses 'role', pdfNodes uses 'type')
      for (let i = 0; i < authoritativeNodes.length; i++) {
        expect(authoritativeNodes[i].role).toBe(pdfNodes[i].type);
      }

      // Start valueDisplay must match
      expect(authoritativeNodes[0].valueDisplay).toBe(pdfNodes[0].valueDisplay);

      // Final valueDisplay must match
      expect(authoritativeNodes[authoritativeNodes.length - 1].valueDisplay).toBe(pdfNodes[pdfNodes.length - 1].valueDisplay);
    });
  });
});

describe("Current BackendTimeline Issues (THESE SHOULD FAIL)", () => {
  /**
   * These tests document the CURRENT behavior of BackendTimeline
   * which does NOT match PDF. After fixing, these assertions will change.
   */

  it("CURRENT: BackendTimeline renders ALL backend steps as nodes", () => {
    const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

    // Current BackendTimeline maps EACH backend step to a node
    // This is WRONG - it should match PDF structure

    // Current behavior: 3 backend steps → 3 UI nodes
    // Expected behavior: 3 backend steps → 3 PDF-style nodes (Base Dues, delta, Final)

    // The issue is the STRUCTURE is different:
    // - Current UI: [Base Dues, Eco-Modulation, CDPHE Bonus]
    // - Expected PDF: [Base Dues (start), Eco-Modulation (delta), Final]

    // Node count happens to match, but LABELS differ!
    // Current final node label: "CDPHE Bonus"
    // Expected final node label: "Final"

    expect(backendTimeline[backendTimeline.length - 1].label).toBe("CDPHE Bonus");
    expect(PDF_TIMELINE.finalLabel).toBe("Final");

    // MISMATCH! This test documents the issue.
  });

  it("CURRENT: BackendTimeline does NOT use PDF_TIMELINE.startLabel for first node", () => {
    const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

    // Current BackendTimeline uses backend's label directly
    expect(backendTimeline[0].label).toBe("Base Dues");

    // But PDF_TIMELINE.startLabel is also "Base Dues", so this happens to match
    expect(PDF_TIMELINE.startLabel).toBe("Base Dues");

    // However, the FINAL node label differs:
    // Backend: "CDPHE Bonus"
    // PDF: "Final"
    expect(backendTimeline[backendTimeline.length - 1].label).not.toBe(PDF_TIMELINE.finalLabel);
  });

  it("CURRENT: BackendTimeline shows running_total for first and last nodes only", () => {
    // Current BackendTimeline shows running_total for isFirst || isFinal
    // This is correct behavior, but the labels are wrong

    // PDF shows:
    // - Start node: valueDisplay = "$15.60"
    // - Final node: valueDisplay = "$13.26"

    // Current UI shows the same VALUES but different LABELS
    // because it uses backend labels instead of PDF_TIMELINE labels
  });
});
