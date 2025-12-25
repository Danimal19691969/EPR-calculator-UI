/**
 * Tests for normalizeColoradoPhase2Groups
 *
 * These tests verify that the normalizer correctly handles various API response shapes:
 * - Raw array (standard)
 * - Wrapped response: { groups: [...] }
 * - CamelCase keys: groupKey, groupName, baseRatePerLb
 * - String rate values: "0.0134"
 * - Mixed formats
 */

import { describe, it, expect } from "vitest";
import { normalizeColoradoPhase2Groups } from "../services/api";
import { resolveColoradoRateSafe, hasValidColoradoRate } from "../utils/coloradoRateResolver";

describe("normalizeColoradoPhase2Groups", () => {
  describe("handles raw array response (standard format)", () => {
    it("normalizes snake_case keys correctly", () => {
      const raw = [
        { group_key: "newspapers", group_name: "Newspapers", status: "MRL", base_rate_per_lb: 0.0134 },
        { group_key: "plastic_rigid", group_name: "Plastic - Rigid", status: "MRL", base_rate_per_lb: 0.02 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(2);
      expect(normalized[0]).toEqual({
        group_key: "newspapers",
        group_name: "Newspapers",
        status: "MRL",
        base_rate_per_lb: 0.0134,
      });
    });

    it("resolver works with normalized data", () => {
      const raw = [
        { group_key: "newspapers", group_name: "Newspapers", status: "MRL", base_rate_per_lb: 0.0134 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);
      const rate = resolveColoradoRateSafe(normalized, "newspapers");

      expect(rate).toBe(0.0134);
    });
  });

  describe("handles wrapped response", () => {
    it("unwraps { groups: [...] } format", () => {
      const raw = {
        groups: [
          { group_key: "newspapers", group_name: "Newspapers", status: "MRL", base_rate_per_lb: 0.0134 },
        ],
      };

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].group_key).toBe("newspapers");
      expect(normalized[0].base_rate_per_lb).toBe(0.0134);
    });

    it("unwraps { data: [...] } format", () => {
      const raw = {
        data: [
          { group_key: "newspapers", group_name: "Newspapers", base_rate_per_lb: 0.0134 },
        ],
      };

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].group_key).toBe("newspapers");
    });

    it("unwraps { items: [...] } format", () => {
      const raw = {
        items: [
          { group_key: "newspapers", group_name: "Newspapers", base_rate_per_lb: 0.0134 },
        ],
      };

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
    });
  });

  describe("handles camelCase keys", () => {
    it("converts camelCase to snake_case", () => {
      const raw = [
        { groupKey: "newspapers", groupName: "Newspapers", baseRatePerLb: 0.0134 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({
        group_key: "newspapers",
        group_name: "Newspapers",
        status: "MRL", // default
        base_rate_per_lb: 0.0134,
      });
    });

    it("resolver works with camelCase normalized data", () => {
      const raw = [
        { groupKey: "newspapers", groupName: "Newspapers", baseRatePerLb: 0.0134 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);
      const rate = resolveColoradoRateSafe(normalized, "newspapers");

      expect(rate).toBe(0.0134);
    });
  });

  describe("handles string rate values", () => {
    it("converts string rate to number", () => {
      const raw = [
        { group_key: "newspapers", group_name: "Newspapers", base_rate_per_lb: "0.0134" },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].base_rate_per_lb).toBe(0.0134);
      expect(typeof normalized[0].base_rate_per_lb).toBe("number");
    });

    it("resolver works with string-to-number converted rate", () => {
      const raw = [
        { group_key: "newspapers", group_name: "Newspapers", base_rate_per_lb: "0.0134" },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);
      const rate = resolveColoradoRateSafe(normalized, "newspapers");

      expect(rate).toBe(0.0134);
    });
  });

  describe("handles alternate rate keys", () => {
    it("uses 'rate' key if base_rate_per_lb is missing", () => {
      const raw = [
        { group_key: "newspapers", group_name: "Newspapers", rate: 0.0134 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized[0].base_rate_per_lb).toBe(0.0134);
    });

    it("uses 'base_rate' key if others are missing", () => {
      const raw = [
        { group_key: "newspapers", group_name: "Newspapers", base_rate: 0.0134 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized[0].base_rate_per_lb).toBe(0.0134);
    });
  });

  describe("handles invalid/missing data", () => {
    it("returns empty array for null input", () => {
      expect(normalizeColoradoPhase2Groups(null)).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(normalizeColoradoPhase2Groups(undefined)).toEqual([]);
    });

    it("returns empty array for primitive input", () => {
      expect(normalizeColoradoPhase2Groups("invalid")).toEqual([]);
      expect(normalizeColoradoPhase2Groups(123)).toEqual([]);
    });

    it("skips items without group_key", () => {
      const raw = [
        { group_name: "Newspapers", base_rate_per_lb: 0.0134 }, // missing group_key
        { group_key: "plastic_rigid", group_name: "Plastic", base_rate_per_lb: 0.02 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].group_key).toBe("plastic_rigid");
    });

    it("skips items without group_name", () => {
      const raw = [
        { group_key: "newspapers", base_rate_per_lb: 0.0134 }, // missing group_name
        { group_key: "plastic_rigid", group_name: "Plastic", base_rate_per_lb: 0.02 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].group_key).toBe("plastic_rigid");
    });

    it("skips items with NaN rate", () => {
      const raw = [
        { group_key: "newspapers", group_name: "Newspapers", base_rate_per_lb: "not_a_number" },
        { group_key: "plastic_rigid", group_name: "Plastic", base_rate_per_lb: 0.02 },
      ];

      const normalized = normalizeColoradoPhase2Groups(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].group_key).toBe("plastic_rigid");
    });
  });

  describe("integration: full flow from API to resolver", () => {
    it("wrapped camelCase with string rate works end-to-end", () => {
      // This simulates a worst-case API response format
      const raw = {
        groups: [
          { groupKey: "newspapers", groupName: "Newspapers", baseRatePerLb: "0.0134" },
          { groupKey: "plastic_rigid", groupName: "Plastic - Rigid", baseRatePerLb: "0.02" },
        ],
      };

      const normalized = normalizeColoradoPhase2Groups(raw);

      // Normalization succeeds
      expect(normalized).toHaveLength(2);

      // Resolver finds newspapers
      const rate = resolveColoradoRateSafe(normalized, "newspapers");
      expect(rate).toBe(0.0134);

      // All keys are snake_case
      expect(normalized[0].group_key).toBe("newspapers");
      expect(normalized[0].group_name).toBe("Newspapers");
      expect(normalized[0].base_rate_per_lb).toBe(0.0134);
    });
  });

  /**
   * REGRESSION TEST: Exact production failure case
   *
   * This test locks the exact API response shape that caused the production bug:
   * - camelCase keys (groupKey, groupName)
   * - String rate value ("0.0134" not 0.0134)
   * - Mixed with snake_case rate key (base_rate_per_lb)
   *
   * If normalization is removed or broken, this test MUST fail.
   */
  describe("REGRESSION: handles real Colorado Phase 2 API response shape", () => {
    it("normalizes camelCase groupKey with string base_rate_per_lb", () => {
      // This is the EXACT shape that broke production
      const productionApiResponse = [
        {
          groupKey: "newspapers",
          groupName: "Newspapers",
          base_rate_per_lb: "0.0134",
        },
        {
          groupKey: "plastic_rigid",
          groupName: "Plastic - Rigid",
          base_rate_per_lb: "0.02",
        },
      ];

      const normalized = normalizeColoradoPhase2Groups(productionApiResponse);

      // 1. Normalization succeeds
      expect(normalized).toHaveLength(2);

      // 2. Keys are converted to snake_case
      expect(normalized[0].group_key).toBe("newspapers");
      expect(normalized[0].group_name).toBe("Newspapers");

      // 3. Rate is converted to number
      expect(normalized[0].base_rate_per_lb).toBe(0.0134);
      expect(typeof normalized[0].base_rate_per_lb).toBe("number");

      // 4. Resolver returns valid rate (not null)
      const rate = resolveColoradoRateSafe(normalized, "newspapers");
      expect(rate).toBe(0.0134);
      expect(rate).not.toBeNull();

      // 5. hasValidColoradoRate returns true
      expect(hasValidColoradoRate(normalized, "newspapers")).toBe(true);

      // 6. No fallback to calculation response needed
      // (This is verified by the resolver returning a valid rate)
    });
  });
});
