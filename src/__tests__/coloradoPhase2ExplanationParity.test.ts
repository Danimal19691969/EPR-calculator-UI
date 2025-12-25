/**
 * Colorado Phase 2 Fee Explanation Parity Test
 *
 * CRITICAL: This test ensures that the PDF and UI display IDENTICAL
 * fee explanation text for Colorado Phase 2 calculations.
 *
 * The shared generateColoradoPhase2Explanation() function is the
 * SINGLE SOURCE OF TRUTH for both:
 * - ColoradoPhase2FeeExplanation (UI component)
 * - buildExplanationParagraphs() in App.tsx (PDF export)
 *
 * If this test fails, it means the parity contract has been broken.
 */

import { describe, it, expect } from "vitest";
import { generateColoradoPhase2Explanation } from "../utils/coloradoPhase2Explanation";
import type { ColoradoPhase2CalculateResponse } from "../services/api";

describe("Colorado Phase 2 Fee Explanation Parity", () => {
  /**
   * Test fixture: A typical Colorado Phase 2 calculation result
   */
  const mockResult: ColoradoPhase2CalculateResponse = {
    aggregated_group: "newspapers",
    weight_lbs: 1000,
    base_rate_per_lb: 0.0134, // Note: This should NOT be used by explanation
    base_dues: 13.4,
    after_eco_modulation: 12.06,
    after_cdphe_bonus: 11.39,
    final_payable: 11.39,
    pro_modulation_percent: 0.1,
    cdphe_bonus_percent: 0.05,
    newspaper_credit: 0,
  };

  describe("generateColoradoPhase2Explanation returns consistent output", () => {
    it("generates exactly 3 paragraphs when adjustments are present", () => {
      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Newspapers",
        result: mockResult,
        resolvedRate: 0.0134,
      });

      expect(paragraphs).toHaveLength(3);
    });

    it("generates exactly 2 paragraphs when no adjustments are present", () => {
      const noAdjustmentsResult: ColoradoPhase2CalculateResponse = {
        ...mockResult,
        pro_modulation_percent: 0,
        cdphe_bonus_percent: 0,
        newspaper_credit: 0,
      };

      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Newspapers",
        result: noAdjustmentsResult,
        resolvedRate: 0.0134,
      });

      expect(paragraphs).toHaveLength(2);
    });

    it("first paragraph contains program name and material group", () => {
      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Newspapers",
        result: mockResult,
        resolvedRate: 0.0134,
      });

      expect(paragraphs[0]).toContain("Newspapers");
      expect(paragraphs[0]).toContain("Colorado Producer Responsibility Program");
      expect(paragraphs[0]).toContain("Phase 2");
    });

    it("second paragraph contains base dues, weight, and rate", () => {
      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Newspapers",
        result: mockResult,
        resolvedRate: 0.0134,
      });

      expect(paragraphs[1]).toContain("$13.40"); // base_dues
      expect(paragraphs[1]).toContain("1000 lbs"); // weight_lbs
      expect(paragraphs[1]).toContain("$0.0134"); // resolvedRate
    });

    it("uses resolvedRate NOT result.base_rate_per_lb", () => {
      // Test with mismatched rates - only resolvedRate should appear
      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Newspapers",
        result: {
          ...mockResult,
          base_rate_per_lb: 0.9999, // Different from resolvedRate
        },
        resolvedRate: 0.0134, // This is the correct rate
      });

      // Should contain the resolved rate
      expect(paragraphs[1]).toContain("$0.0134");
      // Should NOT contain the API response rate
      expect(paragraphs[1]).not.toContain("$0.9999");
    });

    it("handles null resolvedRate gracefully", () => {
      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Unknown Group",
        result: mockResult,
        resolvedRate: null,
      });

      // Should show em-dash for missing rate
      expect(paragraphs[1]).toContain("—");
    });

    it("third paragraph explains layer adjustments when present", () => {
      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Newspapers",
        result: mockResult,
        resolvedRate: 0.0134,
      });

      expect(paragraphs[2]).toContain("PRO Eco-Modulation");
      expect(paragraphs[2]).toContain("CDPHE Performance Benchmarks");
      expect(paragraphs[2]).toContain("In-Kind Advertising Credits");
    });
  });

  describe("PARITY CONTRACT: Multiple calls return identical output", () => {
    /**
     * This test verifies determinism: given the same input,
     * the function MUST return the exact same output every time.
     *
     * This is critical for UI/PDF parity - if the function produces
     * different output on different calls, the UI and PDF will diverge.
     */
    it("produces identical output on repeated calls with same input", () => {
      const input = {
        groupName: "Newspapers",
        result: mockResult,
        resolvedRate: 0.0134,
      };

      const call1 = generateColoradoPhase2Explanation(input);
      const call2 = generateColoradoPhase2Explanation(input);
      const call3 = generateColoradoPhase2Explanation(input);

      // All calls must produce identical arrays
      expect(call1).toEqual(call2);
      expect(call2).toEqual(call3);

      // Verify character-for-character equality
      call1.forEach((paragraph, index) => {
        expect(paragraph).toBe(call2[index]);
        expect(paragraph).toBe(call3[index]);
      });
    });

    it("returns plain strings without JSX or HTML", () => {
      const paragraphs = generateColoradoPhase2Explanation({
        groupName: "Newspapers",
        result: mockResult,
        resolvedRate: 0.0134,
      });

      paragraphs.forEach((paragraph) => {
        // Must be a string
        expect(typeof paragraph).toBe("string");

        // Must not contain HTML tags
        expect(paragraph).not.toMatch(/<[^>]+>/);

        // Must not contain JSX-specific patterns
        expect(paragraph).not.toContain("className");
        expect(paragraph).not.toContain("React");
      });
    });
  });
});
