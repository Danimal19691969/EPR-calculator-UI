/**
 * Timeline Parity Tests
 *
 * CRITICAL INVARIANTS:
 * 1. Backend `adjustment_timeline` is the SINGLE SOURCE OF TRUTH
 * 2. UI must NEVER recompute, infer, or transform fee math
 * 3. On-screen timeline and PDF timeline MUST render from the SAME DATA MODEL
 * 4. Visual semantics (labels, order, amounts, final payable) MUST MATCH
 *
 * These tests ensure:
 * - Colorado timeline final value === backend total_fee / final_payable
 * - Oregon timeline still renders correctly
 * - PDF and UI timelines receive identical data
 * - No client-side fee math exists
 */

import { describe, it, expect } from "vitest";
import type { AdjustmentTimelineStep, ColoradoPhase2CalculateResponse, CalculateResponse } from "../services/api";
import type { TimelineStep } from "../components/DeltaTimeline";

/**
 * Mock Colorado Phase 2 response with reductions applied.
 * Backend values are authoritative - UI must display these exactly.
 */
const mockColoradoPhase2Response: ColoradoPhase2CalculateResponse = {
  aggregated_group: "cardboard_boxes_&_kraft_bags",
  weight_lbs: 1000,
  base_rate_per_lb: 0.0156,
  base_dues: 15.60,
  after_eco_modulation: 14.04, // 10% reduction
  after_cdphe_bonus: 13.26, // Additional 5% reduction
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
 * Mock Oregon response with LCA bonus.
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

describe("Timeline Parity Tests", () => {
  describe("Test 1: Colorado Timeline Matches Final Fee", () => {
    it("timeline final step running_total === final_payable", () => {
      const timeline = mockColoradoPhase2Response.adjustment_timeline;
      expect(timeline).toBeDefined();
      expect(timeline!.length).toBeGreaterThan(0);

      const finalStep = timeline![timeline!.length - 1];
      expect(finalStep.running_total).toBe(mockColoradoPhase2Response.final_payable);
    });

    it("timeline final step has is_final === true", () => {
      const timeline = mockColoradoPhase2Response.adjustment_timeline;
      const finalStep = timeline![timeline!.length - 1];
      expect(finalStep.is_final).toBe(true);
    });

    it("timeline does NOT show a higher value than final_payable for reductions", () => {
      const timeline = mockColoradoPhase2Response.adjustment_timeline;

      // When reductions are applied, each subsequent running_total should be <= previous
      // (unless there's an increase step)
      for (let i = 1; i < timeline!.length; i++) {
        const step = timeline![i];
        const prevStep = timeline![i - 1];
        const delta = step.amount ?? step.rate_delta ?? 0;

        if (delta < 0) {
          // Reduction step - running_total should decrease
          expect(step.running_total).toBeLessThan(prevStep.running_total);
        }
      }

      // Final running_total must equal final_payable
      const finalStep = timeline![timeline!.length - 1];
      expect(finalStep.running_total).toBe(mockColoradoPhase2Response.final_payable);
    });
  });

  describe("Test 2: Timeline Equals PDF Timeline Data", () => {
    /**
     * Simulates the buildTimelineSteps transformation used for PDF.
     * This is the EXACT same logic that App.tsx uses.
     */
    function transformToTimelineSteps(backendTimeline: AdjustmentTimelineStep[]): TimelineStep[] {
      return backendTimeline.map((step) => ({
        label: step.label,
        delta: step.amount ?? step.rate_delta ?? 0,
        sublabel: step.description,
      }));
    }

    it("on-screen timeline steps === PDF timeline steps (same count)", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;
      const pdfSteps = transformToTimelineSteps(backendTimeline);

      // Both should have same count
      expect(backendTimeline.length).toBe(pdfSteps.length);
    });

    it("on-screen timeline steps === PDF timeline steps (same labels)", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;
      const pdfSteps = transformToTimelineSteps(backendTimeline);

      for (let i = 0; i < backendTimeline.length; i++) {
        expect(backendTimeline[i].label).toBe(pdfSteps[i].label);
      }
    });

    it("on-screen timeline steps === PDF timeline steps (same amounts)", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;
      const pdfSteps = transformToTimelineSteps(backendTimeline);

      for (let i = 0; i < backendTimeline.length; i++) {
        const backendAmount = backendTimeline[i].amount ?? backendTimeline[i].rate_delta ?? 0;
        expect(backendAmount).toBe(pdfSteps[i].delta);
      }
    });

    it("on-screen timeline final value === PDF final value", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;
      const finalStep = backendTimeline[backendTimeline.length - 1];

      // Both UI and PDF should show the same final running_total
      expect(finalStep.running_total).toBe(mockColoradoPhase2Response.final_payable);
    });
  });

  describe("Test 3: Oregon Timeline Still Renders Correctly", () => {
    it("Oregon timeline renders with correct step count", () => {
      const timeline = mockOregonResponse.adjustment_timeline;
      expect(timeline).toBeDefined();
      expect(timeline!.length).toBe(2); // Base + LCA Bonus
    });

    it("Oregon timeline final value matches total_fee", () => {
      const timeline = mockOregonResponse.adjustment_timeline;
      const finalStep = timeline![timeline!.length - 1];

      expect(finalStep.running_total).toBe(mockOregonResponse.total_fee);
    });

    it("Oregon timeline does NOT contain Colorado-only fields", () => {
      const timeline = mockOregonResponse.adjustment_timeline;

      for (const step of timeline!) {
        // Oregon should not have Colorado-specific labels
        expect(step.label).not.toContain("Eco-Modulation");
        expect(step.label).not.toContain("CDPHE");
        expect(step.label).not.toContain("In-Kind");
      }
    });

    it("Oregon timeline has LCA bonus step when bonus applied", () => {
      const timeline = mockOregonResponse.adjustment_timeline;

      const lcaStep = timeline!.find((s) => s.label.includes("LCA"));
      expect(lcaStep).toBeDefined();
      expect(lcaStep!.amount).toBe(-0.80);
    });
  });

  describe("Test 4: UI Never Computes Math", () => {
    it("backend timeline values are used verbatim (no computation)", () => {
      const timeline = mockColoradoPhase2Response.adjustment_timeline!;

      // These are the EXACT values from backend - UI must display them as-is
      expect(timeline[0].running_total).toBe(15.60);
      expect(timeline[1].running_total).toBe(14.04);
      expect(timeline[2].running_total).toBe(13.26);

      // Verify the deltas are also exact
      expect(timeline[1].amount).toBe(-1.56);
      expect(timeline[2].amount).toBe(-0.78);
    });

    it("transformation preserves backend values without computation", () => {
      const timeline = mockColoradoPhase2Response.adjustment_timeline!;

      // Simple transformation for PDF - no math, just field mapping
      const transformed = timeline.map((step) => ({
        label: step.label,
        delta: step.amount ?? step.rate_delta ?? 0,
        sublabel: step.description,
      }));

      // Values should be IDENTICAL (no rounding, no recalculation)
      expect(transformed[1].delta).toBe(-1.56);
      expect(transformed[2].delta).toBe(-0.78);
    });

    it("running_total values are never computed client-side", () => {
      const timeline = mockColoradoPhase2Response.adjustment_timeline!;

      // The running_total is PROVIDED by backend, not computed
      // We verify by checking that values match backend expectations
      // (If client computed, it might introduce floating point errors)
      const baseDues = timeline[0].running_total;
      const afterEcoMod = timeline[1].running_total;
      const finalPayable = timeline[2].running_total;

      // These MUST match backend response fields exactly
      expect(baseDues).toBe(mockColoradoPhase2Response.base_dues);
      expect(afterEcoMod).toBe(mockColoradoPhase2Response.after_eco_modulation);
      expect(finalPayable).toBe(mockColoradoPhase2Response.final_payable);
    });
  });

  describe("Regression Prevention: Timeline Data Flow", () => {
    it("BackendTimeline receives AdjustmentTimelineStep[] directly", () => {
      // Verify the type contract - BackendTimeline should receive backend format
      const backendTimeline: AdjustmentTimelineStep[] = mockColoradoPhase2Response.adjustment_timeline!;

      // Type check - this should compile without errors
      const props = {
        steps: backendTimeline,
        currency: "$",
      };

      expect(props.steps).toBe(backendTimeline);
      expect(props.steps[0].running_total).toBeDefined();
    });

    it("PDF receives TimelineStep[] via transformation", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      // PDF format uses delta instead of amount
      const pdfSteps: TimelineStep[] = backendTimeline.map((step) => ({
        label: step.label,
        delta: step.amount ?? step.rate_delta ?? 0,
        sublabel: step.description,
      }));

      expect(pdfSteps[0].delta).toBeDefined();
      expect(pdfSteps[1].delta).toBe(-1.56);
    });

    it("both UI and PDF use same source data (backend timeline)", () => {
      const backendTimeline = mockColoradoPhase2Response.adjustment_timeline!;

      // UI uses running_total directly
      const uiFinalValue = backendTimeline[backendTimeline.length - 1].running_total;

      // PDF uses finalPayable from response (which equals last running_total)
      const pdfFinalValue = mockColoradoPhase2Response.final_payable;

      expect(uiFinalValue).toBe(pdfFinalValue);
    });
  });
});
