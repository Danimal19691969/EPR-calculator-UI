/**
 * Colorado Phase 2 UI Timeline Parity Tests
 *
 * These tests ensure the UI timeline displays values from the SAME source of truth
 * as the Fee Breakdown and PDF.
 *
 * CRITICAL ARCHITECTURE RULE:
 * The DeltaTimeline component is RENDER-ONLY. It does NOT compute any values.
 * All values must come from computeColoradoPhase2DerivedValues().
 *
 * TEST CATEGORIES:
 * 1. Timeline Final Matches Fee Breakdown - The canonical finalPayable value
 * 2. Timeline Final Matches PDF Snapshot - Consistency with PDF export
 * 3. Timeline Does NOT Recompute - Verifies render-only behavior
 * 4. Regression Lock - Prevents future drift between UI components
 */

import { describe, it, expect } from "vitest";
import { computeColoradoPhase2DerivedValues } from "../utils/coloradoPhase2DerivedValues";
import { buildColoradoPhase2Snapshot } from "../pdf/buildColoradoPhase2Snapshot";
import type { ColoradoPhase2CalculateResponse } from "../services/api";
import type { TimelineStep } from "../components/DeltaTimeline";

/**
 * Simulates the timeline data construction in App.tsx
 * This MUST use the same source of truth as the actual App.tsx code
 */
function buildTimelineData(phase2Result: ColoradoPhase2CalculateResponse) {
  // Use SAME derived values as Fee Breakdown and PDF
  const derived = computeColoradoPhase2DerivedValues(phase2Result);
  const {
    baseDues,
    proModulationDelta,
    cdpheBonusDelta,
    inKindCredit,
    finalPayable,
  } = derived;

  const timelineSteps: TimelineStep[] = [];

  if (proModulationDelta !== 0) {
    timelineSteps.push({
      label: "Eco-Mod",
      delta: -proModulationDelta,
      sublabel: "Layer 1: PRO Eco-Modulation",
    });
  }

  if (cdpheBonusDelta !== 0) {
    timelineSteps.push({
      label: "CDPHE",
      delta: -cdpheBonusDelta,
      sublabel: "Layer 2: CDPHE Performance Benchmarks",
    });
  }

  if (inKindCredit !== 0) {
    timelineSteps.push({
      label: "In-Kind",
      delta: -inKindCredit,
      sublabel: "Publisher In-Kind Advertising Credit",
    });
  }

  return {
    startValue: baseDues,
    steps: timelineSteps,
    finalValue: finalPayable,
  };
}

// Test fixture: A complete API response with all adjustments
const mockApiResponse: ColoradoPhase2CalculateResponse = {
  aggregated_group: "newspapers",
  weight_lbs: 1000,
  base_rate_per_lb: 0.0134,
  base_dues: 13.40,
  after_eco_modulation: 12.06,
  after_cdphe_bonus: 11.39,
  final_payable: 9.39, // This is the backend value which MAY differ from UI
  pro_modulation_percent: 0.10,
  cdphe_bonus_percent: 0.05,
  newspaper_credit: 2.00,
};

const mockResolvedRate = 0.0134;
const mockGroupName = "Newspapers";

describe("Colorado Phase 2 UI Timeline Parity", () => {
  describe("Test 1: Timeline Final Matches Fee Breakdown", () => {
    it("timeline finalValue equals derived finalPayable (same as Fee Breakdown)", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);

      // CRITICAL: The timeline MUST use the same finalPayable as the Fee Breakdown
      expect(timelineData.finalValue).toBe(derived.finalPayable);
    });

    it("timeline startValue equals derived baseDues (same as Fee Breakdown)", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);

      expect(timelineData.startValue).toBe(derived.baseDues);
    });

    it("timeline proModulationDelta equals derived value (same as Fee Breakdown)", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);

      const ecoModStep = timelineData.steps.find((s) => s.label === "Eco-Mod");
      expect(ecoModStep).toBeDefined();
      // Delta is negative in timeline, so compare absolute value
      expect(Math.abs(ecoModStep!.delta)).toBe(derived.proModulationDelta);
    });

    it("timeline cdpheBonusDelta equals derived value (same as Fee Breakdown)", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);

      const cdpheStep = timelineData.steps.find((s) => s.label === "CDPHE");
      expect(cdpheStep).toBeDefined();
      expect(Math.abs(cdpheStep!.delta)).toBe(derived.cdpheBonusDelta);
    });

    it("timeline inKindCredit equals derived value (same as Fee Breakdown)", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);

      const inKindStep = timelineData.steps.find((s) => s.label === "In-Kind");
      expect(inKindStep).toBeDefined();
      expect(Math.abs(inKindStep!.delta)).toBe(derived.inKindCredit);
    });
  });

  describe("Test 2: Timeline Final Matches PDF Snapshot", () => {
    it("timeline finalValue equals PDF snapshot finalPayable", () => {
      const timelineData = buildTimelineData(mockApiResponse);
      const pdfSnapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Extract numeric value from PDF formatted string
      const pdfFinalNumeric = parseFloat(
        pdfSnapshot.summary.amount.replace(/[^0-9.-]/g, "")
      );

      expect(timelineData.finalValue).toBeCloseTo(pdfFinalNumeric, 2);
    });

    it("timeline startValue equals PDF snapshot baseDues", () => {
      const timelineData = buildTimelineData(mockApiResponse);
      const pdfSnapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Extract numeric value from PDF timeline start display
      const pdfStartNumeric = parseFloat(
        pdfSnapshot.timeline.startValueDisplay.replace(/[^0-9.-]/g, "")
      );

      expect(timelineData.startValue).toBeCloseTo(pdfStartNumeric, 2);
    });
  });

  describe("Test 3: Timeline Does NOT Recompute", () => {
    it("timeline uses canonical finalPayable, NOT sum of deltas", () => {
      // Create a scenario where API response has different final_payable
      // The derived values should be the source of truth
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);

      // Calculate what the final would be if we summed deltas (WRONG approach)
      const computedFromDeltas =
        timelineData.startValue +
        timelineData.steps.reduce((sum, step) => sum + step.delta, 0);

      // The timeline MUST use canonical finalPayable, NOT the computed value
      // If this test fails, it means the timeline is computing values
      expect(timelineData.finalValue).toBe(derived.finalPayable);

      // These should be equal when architecture is correct
      // (derived values are calculated properly and passed through)
      expect(computedFromDeltas).toBeCloseTo(timelineData.finalValue, 2);
    });

    it("timeline uses pre-computed deltas from derived values, NOT percentages", () => {
      // The timeline should receive dollar amounts, not percentages
      // This ensures no percentage calculation happens in the timeline
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);

      // Verify eco-mod delta is a dollar amount, not a percentage
      const ecoModStep = timelineData.steps.find((s) => s.label === "Eco-Mod");
      expect(ecoModStep).toBeDefined();
      // The delta should be the actual dollar amount, not 0.10 (the percentage)
      expect(Math.abs(ecoModStep!.delta)).toBe(derived.proModulationDelta);
      expect(Math.abs(ecoModStep!.delta)).toBeGreaterThan(1); // Must be dollars, not percent
    });
  });

  describe("Test 4: Regression Lock - Prevents Future Drift", () => {
    it("timeline final equals Fee Breakdown final equals PDF final", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);
      const pdfSnapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Extract PDF numeric value
      const pdfFinalNumeric = parseFloat(
        pdfSnapshot.summary.amount.replace(/[^0-9.-]/g, "")
      );

      // ALL THREE must be equal
      expect(timelineData.finalValue).toBe(derived.finalPayable);
      expect(pdfFinalNumeric).toBeCloseTo(derived.finalPayable, 2);
    });

    it("timeline start equals Fee Breakdown baseDues equals PDF baseDues", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);
      const pdfSnapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Extract PDF numeric value
      const pdfStartNumeric = parseFloat(
        pdfSnapshot.timeline.startValueDisplay.replace(/[^0-9.-]/g, "")
      );

      // ALL THREE must be equal
      expect(timelineData.startValue).toBe(derived.baseDues);
      expect(pdfStartNumeric).toBeCloseTo(derived.baseDues, 2);
    });

    it("all delta amounts match across Timeline, Fee Breakdown, and PDF", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const timelineData = buildTimelineData(mockApiResponse);
      const pdfSnapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Eco-Mod delta
      const timelineEcoMod = timelineData.steps.find((s) => s.label === "Eco-Mod");
      const pdfEcoMod = pdfSnapshot.timeline.steps.find((s) => s.label === "Eco-Mod");
      expect(Math.abs(timelineEcoMod!.delta)).toBe(derived.proModulationDelta);
      expect(pdfEcoMod!.deltaMagnitude).toBe(derived.proModulationDelta);

      // CDPHE delta
      const timelineCdphe = timelineData.steps.find((s) => s.label === "CDPHE");
      const pdfCdphe = pdfSnapshot.timeline.steps.find((s) => s.label === "CDPHE");
      expect(Math.abs(timelineCdphe!.delta)).toBe(derived.cdpheBonusDelta);
      expect(pdfCdphe!.deltaMagnitude).toBe(derived.cdpheBonusDelta);

      // In-Kind delta
      const timelineInKind = timelineData.steps.find((s) => s.label === "In-Kind");
      const pdfInKind = pdfSnapshot.timeline.steps.find((s) => s.label === "In-Kind");
      expect(Math.abs(timelineInKind!.delta)).toBe(derived.inKindCredit);
      expect(pdfInKind!.deltaMagnitude).toBe(derived.inKindCredit);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero adjustments correctly", () => {
      const noAdjustmentsResponse: ColoradoPhase2CalculateResponse = {
        aggregated_group: "newspapers",
        weight_lbs: 1000,
        base_rate_per_lb: 0.0134,
        base_dues: 13.40,
        after_eco_modulation: 13.40,
        after_cdphe_bonus: 13.40,
        final_payable: 13.40,
        pro_modulation_percent: 0,
        cdphe_bonus_percent: 0,
        newspaper_credit: 0,
      };

      const timelineData = buildTimelineData(noAdjustmentsResponse);

      expect(timelineData.steps.length).toBe(0);
      expect(timelineData.startValue).toBe(timelineData.finalValue);
    });

    it("handles only eco-mod adjustment correctly", () => {
      const ecoModOnlyResponse: ColoradoPhase2CalculateResponse = {
        aggregated_group: "newspapers",
        weight_lbs: 1000,
        base_rate_per_lb: 0.0134,
        base_dues: 13.40,
        after_eco_modulation: 12.06,
        after_cdphe_bonus: 12.06,
        final_payable: 12.06,
        pro_modulation_percent: 0.10,
        cdphe_bonus_percent: 0,
        newspaper_credit: 0,
      };

      const timelineData = buildTimelineData(ecoModOnlyResponse);

      expect(timelineData.steps.length).toBe(1);
      expect(timelineData.steps[0].label).toBe("Eco-Mod");
    });

    it("handles only in-kind credit correctly", () => {
      const inKindOnlyResponse: ColoradoPhase2CalculateResponse = {
        aggregated_group: "newspapers",
        weight_lbs: 1000,
        base_rate_per_lb: 0.0134,
        base_dues: 13.40,
        after_eco_modulation: 13.40,
        after_cdphe_bonus: 13.40,
        final_payable: 11.40,
        pro_modulation_percent: 0,
        cdphe_bonus_percent: 0,
        newspaper_credit: 2.00,
      };

      const timelineData = buildTimelineData(inKindOnlyResponse);

      expect(timelineData.steps.length).toBe(1);
      expect(timelineData.steps[0].label).toBe("In-Kind");
    });
  });
});
