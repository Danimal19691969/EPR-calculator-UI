/**
 * Colorado Phase 2 PDF Snapshot Parity Tests
 *
 * These tests ensure the PDF snapshot EXACTLY matches the UI.
 * Any divergence between UI and PDF is a test failure.
 *
 * TEST CATEGORIES:
 * 1. Snapshot Integrity - Every label and value matches UI
 * 2. Math Drift - PDF uses pre-computed values, no recalculation
 * 3. Timeline Parity - Timeline deltas match UI exactly
 * 4. Title Parity - All titles and labels are verbatim from UI
 */

import { describe, it, expect } from "vitest";
import { buildColoradoPhase2Snapshot } from "../pdf/buildColoradoPhase2Snapshot";
import { computeColoradoPhase2DerivedValues } from "../utils/coloradoPhase2DerivedValues";
import { isValidPdfSnapshot } from "../pdf/PdfSnapshot";
import type { ColoradoPhase2CalculateResponse } from "../services/api";

/**
 * Format currency - EXACT same function as UI uses
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
 * Format percent - EXACT same function as UI uses
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
 * Format rate - EXACT same function as UI uses
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

// Test fixture: A complete API response with all adjustments
const mockApiResponse: ColoradoPhase2CalculateResponse = {
  aggregated_group: "newspapers",
  weight_lbs: 1000,
  base_rate_per_lb: 0.0134, // This should be IGNORED - we use resolvedRate
  base_dues: 13.40,
  after_eco_modulation: 12.06, // After 10% reduction
  after_cdphe_bonus: 11.39, // After 5% additional reduction
  final_payable: 9.39, // After $2 in-kind credit
  pro_modulation_percent: 0.10, // 10%
  cdphe_bonus_percent: 0.05, // 5%
  newspaper_credit: 2.00,
};

const mockResolvedRate = 0.0134;
const mockGroupName = "Newspapers";

describe("Colorado Phase 2 PDF Snapshot Parity", () => {
  describe("1. Snapshot Integrity Tests", () => {
    it("produces a valid PdfSnapshot structure", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      expect(isValidPdfSnapshot(snapshot)).toBe(true);
    });

    it("snapshot summary title matches UI exactly", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // CRITICAL: Must match ColoradoPhase2Breakdown.tsx exactly
      expect(snapshot.summary.title).toBe("Estimated 2026 Program Fee");
    });

    it("snapshot scenario label matches UI exactly", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // CRITICAL: Must match ColoradoPhase2Breakdown.tsx exactly
      expect(snapshot.summary.scenarioLabel).toBe("JBC-Approved Medium Scenario");
    });

    it("breakdown row labels match UI exactly", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Extract labels only
      const labels = snapshot.breakdownRows.map((r) => r.label);

      // CRITICAL: These MUST match ColoradoPhase2Breakdown.tsx exactly
      expect(labels).toContain("JBC-Approved Medium Scenario Rate");
      expect(labels).toContain("Weight");
      expect(labels).toContain("Base Dues");
      expect(labels).toContain("Layer 1: PRO Eco-Modulation (Uncapped)");
      expect(labels).toContain("PRO Eco-Modulation (10%)");
      expect(labels).toContain("After PRO Eco-Modulation");
      expect(labels).toContain("Layer 2: CDPHE Performance Benchmarks (max 10% of Base Dues)");
      expect(labels).toContain("CDPHE Bonus (5%)");
      expect(labels).toContain("After CDPHE Benchmarks");
      expect(labels).toContain("In-Kind Advertising Credit Applied");
      expect(labels).toContain("Final Payable");
    });

    it("breakdown rows preserve UI order", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      const labels = snapshot.breakdownRows.map((r) => r.label);

      // Rate must come before Weight
      expect(labels.indexOf("JBC-Approved Medium Scenario Rate")).toBeLessThan(
        labels.indexOf("Weight")
      );

      // Weight must come before Base Dues
      expect(labels.indexOf("Weight")).toBeLessThan(
        labels.indexOf("Base Dues")
      );

      // Layer 1 header must come before PRO Eco-Modulation
      expect(labels.indexOf("Layer 1: PRO Eco-Modulation (Uncapped)")).toBeLessThan(
        labels.indexOf("PRO Eco-Modulation (10%)")
      );

      // Final Payable must be last
      expect(labels.indexOf("Final Payable")).toBe(labels.length - 1);
    });
  });

  describe("2. Math Drift Tests", () => {
    it("snapshot finalPayable matches derived values exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // The snapshot amount MUST be the formatted version of derived.finalPayable
      expect(snapshot.summary.amount).toBe(formatCurrency(derived.finalPayable));
    });

    it("snapshot baseDues matches derived values exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Find the Base Dues row
      const baseDuesRow = snapshot.breakdownRows.find((r) => r.label === "Base Dues");
      expect(baseDuesRow).toBeDefined();
      expect(baseDuesRow!.value).toBe(formatCurrency(derived.baseDues));
    });

    it("snapshot proModulationDelta matches derived values exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Find the PRO Eco-Modulation row
      const proModRow = snapshot.breakdownRows.find((r) =>
        r.label.startsWith("PRO Eco-Modulation (")
      );
      expect(proModRow).toBeDefined();
      // Value should be negative (credit) with minus sign
      expect(proModRow!.value).toBe(`−${formatCurrency(derived.proModulationDelta)}`);
    });

    it("snapshot cdpheBonusDelta matches derived values exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Find the CDPHE Bonus row
      const cdpheRow = snapshot.breakdownRows.find((r) =>
        r.label.startsWith("CDPHE Bonus (")
      );
      expect(cdpheRow).toBeDefined();
      // Value should be negative (credit) with minus sign
      expect(cdpheRow!.value).toBe(`−${formatCurrency(derived.cdpheBonusDelta)}`);
    });

    it("snapshot inKindCredit matches derived values exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Find the In-Kind Credit row
      const inKindRow = snapshot.breakdownRows.find((r) =>
        r.label === "In-Kind Advertising Credit Applied"
      );
      expect(inKindRow).toBeDefined();
      // Value should be negative (credit) with minus sign
      expect(inKindRow!.value).toBe(`-${formatCurrency(derived.inKindCredit)}`);
    });

    it("snapshot uses resolvedRate NOT API base_rate_per_lb", () => {
      // Create a response where API rate differs from resolved rate
      const responseWithDifferentRate: ColoradoPhase2CalculateResponse = {
        ...mockApiResponse,
        base_rate_per_lb: 0.9999, // Wrong rate from API
      };

      const snapshot = buildColoradoPhase2Snapshot({
        result: responseWithDifferentRate,
        resolvedRate: 0.0134, // Correct resolved rate
        groupName: mockGroupName,
      });

      // Find the rate row
      const rateRow = snapshot.breakdownRows.find((r) =>
        r.label === "JBC-Approved Medium Scenario Rate"
      );
      expect(rateRow).toBeDefined();
      // Should use resolvedRate, not API rate
      expect(rateRow!.value).toBe(`${formatRate(0.0134)}/lb`);
      expect(rateRow!.value).not.toContain("0.9999");
    });
  });

  describe("3. Timeline Parity Tests", () => {
    it("timeline start value matches baseDues exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      expect(snapshot.timeline.startValueDisplay).toBe(formatCurrency(derived.baseDues));
    });

    it("timeline final value matches finalPayable exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      expect(snapshot.timeline.finalValueDisplay).toBe(formatCurrency(derived.finalPayable));
    });

    it("timeline step deltas match derived values exactly", () => {
      const derived = computeColoradoPhase2DerivedValues(mockApiResponse);
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Should have 3 steps: Eco-Mod, CDPHE, In-Kind
      expect(snapshot.timeline.steps.length).toBe(3);

      // Eco-Mod step
      const ecoModStep = snapshot.timeline.steps.find((s) => s.label === "Eco-Mod");
      expect(ecoModStep).toBeDefined();
      expect(ecoModStep!.deltaDisplay).toBe(`-${formatCurrency(derived.proModulationDelta)}`);
      expect(ecoModStep!.deltaMagnitude).toBe(derived.proModulationDelta);

      // CDPHE step
      const cdpheStep = snapshot.timeline.steps.find((s) => s.label === "CDPHE");
      expect(cdpheStep).toBeDefined();
      expect(cdpheStep!.deltaDisplay).toBe(`-${formatCurrency(derived.cdpheBonusDelta)}`);
      expect(cdpheStep!.deltaMagnitude).toBe(derived.cdpheBonusDelta);

      // In-Kind step
      const inKindStep = snapshot.timeline.steps.find((s) => s.label === "In-Kind");
      expect(inKindStep).toBeDefined();
      expect(inKindStep!.deltaDisplay).toBe(`-${formatCurrency(derived.inKindCredit)}`);
      expect(inKindStep!.deltaMagnitude).toBe(derived.inKindCredit);
    });

    it("timeline omits zero-value steps", () => {
      // Response with no adjustments
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

      const snapshot = buildColoradoPhase2Snapshot({
        result: noAdjustmentsResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Should have no timeline steps
      expect(snapshot.timeline.steps.length).toBe(0);
    });
  });

  describe("4. Title Parity Tests", () => {
    it("uses EXACT UI title 'Estimated 2026 Program Fee'", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // This is the EXACT title from ColoradoPhase2Breakdown.tsx line 137
      expect(snapshot.summary.title).toBe("Estimated 2026 Program Fee");
    });

    it("uses EXACT UI label 'JBC-Approved Medium Scenario Rate'", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      const rateRow = snapshot.breakdownRows.find((r) =>
        r.label === "JBC-Approved Medium Scenario Rate"
      );
      expect(rateRow).toBeDefined();
    });

    it("uses EXACT UI label 'Layer 1: PRO Eco-Modulation (Uncapped)'", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      const layer1Header = snapshot.breakdownRows.find((r) =>
        r.label === "Layer 1: PRO Eco-Modulation (Uncapped)"
      );
      expect(layer1Header).toBeDefined();
      expect(layer1Header!.type).toBe("header");
    });

    it("uses EXACT UI label 'Layer 2: CDPHE Performance Benchmarks (max 10% of Base Dues)'", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      const layer2Header = snapshot.breakdownRows.find((r) =>
        r.label === "Layer 2: CDPHE Performance Benchmarks (max 10% of Base Dues)"
      );
      expect(layer2Header).toBeDefined();
      expect(layer2Header!.type).toBe("header");
    });

    it("uses EXACT UI label 'Final Payable'", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      const finalRow = snapshot.breakdownRows.find((r) => r.label === "Final Payable");
      expect(finalRow).toBeDefined();
      expect(finalRow!.type).toBe("total");
    });

    it("formats percentage labels with correct format (e.g., '10%' not '10.0%')", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      const proModRow = snapshot.breakdownRows.find((r) =>
        r.label.startsWith("PRO Eco-Modulation (")
      );
      expect(proModRow).toBeDefined();
      // Should be "10%" not "10.0%" for whole percentages
      expect(proModRow!.label).toBe("PRO Eco-Modulation (10%)");
    });
  });

  describe("5. Edge Cases", () => {
    it("handles null resolvedRate correctly", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: null,
        groupName: mockGroupName,
      });

      const rateRow = snapshot.breakdownRows.find((r) =>
        r.label === "JBC-Approved Medium Scenario Rate"
      );
      expect(rateRow).toBeDefined();
      // Should show em-dash for invalid rate
      expect(rateRow!.value).toBe("—/lb");
    });

    it("handles zero weight correctly", () => {
      const zeroWeightResponse: ColoradoPhase2CalculateResponse = {
        ...mockApiResponse,
        weight_lbs: 0,
        base_dues: 0,
        after_eco_modulation: 0,
        after_cdphe_bonus: 0,
        final_payable: 0,
      };

      const snapshot = buildColoradoPhase2Snapshot({
        result: zeroWeightResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      expect(snapshot.summary.amount).toBe("$0.00");
    });

    it("includes all explanation paragraphs", () => {
      const snapshot = buildColoradoPhase2Snapshot({
        result: mockApiResponse,
        resolvedRate: mockResolvedRate,
        groupName: mockGroupName,
      });

      // Should have explanation paragraphs
      expect(snapshot.explanationParagraphs.length).toBeGreaterThan(0);
      // Each should be a non-empty string
      snapshot.explanationParagraphs.forEach((para) => {
        expect(typeof para).toBe("string");
        expect(para.length).toBeGreaterThan(0);
      });
    });
  });
});
