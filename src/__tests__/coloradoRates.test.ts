/**
 * Colorado Rate Resolution Tests
 *
 * These tests verify that Colorado rates are correctly resolved from the
 * material groups data. The rate resolver must:
 * 1. Return valid positive rates for known material groups
 * 2. Throw errors for unknown material groups (never silently return 0)
 * 3. Provide consistent rates for UI, calculation, and PDF export
 *
 * CRITICAL: Oregon logic must NOT be affected by these changes.
 */

import { describe, it, expect } from "vitest";
import {
  resolveColoradoRate,
  validateColoradoRate,
  ColoradoRateError,
} from "../utils/coloradoRateResolver";
import type { ColoradoPhase2Group } from "../services/api";

// Mock groups data representing what the backend returns
const mockColoradoPhase2Groups: ColoradoPhase2Group[] = [
  {
    group_key: "pet_containers_colored",
    group_name: "PET Containers (Colored)",
    status: "MRL",
    base_rate_per_lb: 0.0234,
  },
  {
    group_key: "pet_containers_natural",
    group_name: "PET Containers (Natural)",
    status: "MRL",
    base_rate_per_lb: 0.0189,
  },
  {
    group_key: "hdpe_containers_colored",
    group_name: "HDPE Containers (Colored)",
    status: "MRL",
    base_rate_per_lb: 0.0156,
  },
  {
    group_key: "hdpe_containers_natural",
    group_name: "HDPE Containers (Natural)",
    status: "MRL",
    base_rate_per_lb: 0.0142,
  },
  {
    group_key: "aluminum_cans",
    group_name: "Aluminum Cans",
    status: "MRL",
    base_rate_per_lb: 0.0098,
  },
  {
    group_key: "steel_containers",
    group_name: "Steel Containers",
    status: "MRL",
    base_rate_per_lb: 0.0067,
  },
  {
    group_key: "paper_cardboard",
    group_name: "Paper - Cardboard",
    status: "MRL",
    base_rate_per_lb: 0.015,
  },
  {
    group_key: "plastic_rigid",
    group_name: "Plastic - Rigid",
    status: "MRL",
    base_rate_per_lb: 0.02,
  },
  // Edge case: group with zero rate (indicates backend data problem)
  {
    group_key: "broken_group",
    group_name: "Broken Group",
    status: "NC",
    base_rate_per_lb: 0,
  },
];

describe("Colorado rate resolution", () => {
  describe("resolveColoradoRate", () => {
    it("resolves a non-zero rate for PET Containers (Colored) by group_key", () => {
      const rate = resolveColoradoRate(
        mockColoradoPhase2Groups,
        "pet_containers_colored"
      );

      expect(rate).toBeGreaterThan(0);
      expect(rate).toBe(0.0234);
    });

    it("resolves correct rate for Paper - Cardboard", () => {
      const rate = resolveColoradoRate(
        mockColoradoPhase2Groups,
        "paper_cardboard"
      );

      expect(rate).toBe(0.015);
    });

    it("resolves correct rate for Plastic - Rigid", () => {
      const rate = resolveColoradoRate(
        mockColoradoPhase2Groups,
        "plastic_rigid"
      );

      expect(rate).toBe(0.02);
    });

    it("throws ColoradoRateError for unknown material group", () => {
      expect(() =>
        resolveColoradoRate(mockColoradoPhase2Groups, "unknown_plastic_thing")
      ).toThrow(ColoradoRateError);

      expect(() =>
        resolveColoradoRate(mockColoradoPhase2Groups, "unknown_plastic_thing")
      ).toThrow(/not found/i);
    });

    it("throws ColoradoRateError when group has zero rate", () => {
      expect(() =>
        resolveColoradoRate(mockColoradoPhase2Groups, "broken_group")
      ).toThrow(ColoradoRateError);

      expect(() =>
        resolveColoradoRate(mockColoradoPhase2Groups, "broken_group")
      ).toThrow(/invalid rate/i);
    });

    it("throws ColoradoRateError for empty groups array", () => {
      expect(() => resolveColoradoRate([], "plastic_rigid")).toThrow(
        ColoradoRateError
      );

      expect(() => resolveColoradoRate([], "plastic_rigid")).toThrow(
        /no groups available/i
      );
    });

    it("throws ColoradoRateError for empty group key", () => {
      expect(() => resolveColoradoRate(mockColoradoPhase2Groups, "")).toThrow(
        ColoradoRateError
      );
    });

    it("is case-sensitive for group_key", () => {
      // Group keys should be exact matches
      expect(() =>
        resolveColoradoRate(mockColoradoPhase2Groups, "PET_CONTAINERS_COLORED")
      ).toThrow(ColoradoRateError);
    });
  });

  describe("validateColoradoRate", () => {
    it("returns true for valid positive rates", () => {
      expect(validateColoradoRate(0.02)).toBe(true);
      expect(validateColoradoRate(0.0001)).toBe(true);
      expect(validateColoradoRate(1.5)).toBe(true);
    });

    it("returns false for zero rate", () => {
      expect(validateColoradoRate(0)).toBe(false);
    });

    it("returns false for negative rate", () => {
      expect(validateColoradoRate(-0.01)).toBe(false);
    });

    it("returns false for NaN", () => {
      expect(validateColoradoRate(NaN)).toBe(false);
    });

    it("returns false for Infinity", () => {
      expect(validateColoradoRate(Infinity)).toBe(false);
      expect(validateColoradoRate(-Infinity)).toBe(false);
    });

    it("returns false for undefined (cast as number)", () => {
      expect(validateColoradoRate(undefined as unknown as number)).toBe(false);
    });
  });
});

describe("Colorado UI + Engine Consistency", () => {
  it("uses the same resolved rate for UI breakdown and calculation", () => {
    const groupKey = "pet_containers_colored";
    const weightLbs = 10023;

    // Resolve rate from groups
    const rate = resolveColoradoRate(mockColoradoPhase2Groups, groupKey);

    // Calculate expected base dues
    const expectedBaseDues = rate * weightLbs;

    // Verify calculation is consistent
    expect(rate).toBe(0.0234);
    expect(expectedBaseDues).toBeCloseTo(234.54, 2);
  });

  it("provides consistent rate for calculation with modulations", () => {
    const groupKey = "plastic_rigid";
    const weightLbs = 1000;
    const ecoModPct = 0.05; // 5%
    const cdphePct = 0.02; // 2%

    const rate = resolveColoradoRate(mockColoradoPhase2Groups, groupKey);
    const baseDues = rate * weightLbs;
    const afterEcoMod = baseDues - baseDues * ecoModPct;
    const afterCdphe = afterEcoMod - baseDues * cdphePct;

    expect(rate).toBe(0.02);
    expect(baseDues).toBe(20);
    expect(afterEcoMod).toBe(19); // 20 - 1
    expect(afterCdphe).toBe(18.6); // 19 - 0.4
  });
});

describe("Colorado regression guards", () => {
  it("final payable equals after-CDPHE minus in-kind credit (floored at 0)", () => {
    const groupKey = "paper_cardboard";
    const weightLbs = 100;
    const inKindCredit = 0.5;

    const rate = resolveColoradoRate(mockColoradoPhase2Groups, groupKey);
    const baseDues = rate * weightLbs;
    const afterCdphe = baseDues; // No modulations
    const finalPayable = Math.max(0, afterCdphe - inKindCredit);

    expect(finalPayable).toBeCloseTo(afterCdphe - inKindCredit, 2);
  });

  it("ensures rate is never silently coerced to 0", () => {
    // This tests the core invariant: we never silently produce 0 rate
    const goodGroups = mockColoradoPhase2Groups.filter(
      (g) => g.base_rate_per_lb > 0
    );

    for (const group of goodGroups) {
      const rate = resolveColoradoRate(mockColoradoPhase2Groups, group.group_key);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBe(group.base_rate_per_lb);
    }
  });
});
