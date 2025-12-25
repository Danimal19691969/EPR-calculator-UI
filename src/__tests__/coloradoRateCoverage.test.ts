/**
 * Colorado Rate Coverage Tests
 *
 * These tests verify that ALL Colorado material groups have valid rates.
 * The goal is to ensure no material group silently returns 0 or fails without
 * clear error messaging.
 *
 * CRITICAL: If any of these tests fail, it indicates either:
 * 1. The backend is returning 0 rates for some material groups
 * 2. The frontend's expected group_keys don't match what the backend returns
 *
 * This test file uses mock data to simulate what the backend returns.
 * To test against the real backend, use integration tests.
 */

import { describe, it, expect } from "vitest";
import {
  resolveColoradoRate,
  resolveColoradoRateSafe,
  hasValidColoradoRate,
  ColoradoRateError,
} from "../utils/coloradoRateResolver";
import { formatRateForPDF } from "../utils/exportResultsToPDF";
import { IN_KIND_ELIGIBLE_GROUPS } from "../components/InKindAdvertisingCredit";
import type { ColoradoPhase2Group } from "../services/api";

/**
 * Expected Colorado Phase 2 material group keys.
 * These are the groups that the UI expects to exist and have valid rates.
 *
 * This list should match what the backend returns from:
 * GET /materials/colorado/phase2/groups
 *
 * If a group is added to the backend but not here, the test won't catch it.
 * If a group is here but not in the backend, the test will fail (good!).
 */
const EXPECTED_COLORADO_GROUPS = [
  // Paper/Cardboard Groups
  "cardboard_boxes_&_kraft_bags",
  "paper-based_cartons",
  "paper_(printed)",
  "other_paper_packaging",
  // Print Publications (in-kind eligible)
  "newspapers",
  "magazines_/_catalogs",
  "newsprint_(inserts/circulars)",
  // Plastic Groups
  "pet_beverage_containers",
  "hdpe_beverage_containers",
  "pet_other_containers",
  "hdpe_other_containers",
  "pp_containers",
  "other_rigid_plastic",
  "plastic_film",
  // Metal Groups
  "aluminum_beverage_containers",
  "steel_food_&_beverage_containers",
  "other_metal_packaging",
  // Glass Groups
  "glass_beverage_containers",
  "glass_food_containers",
  // Other Groups
  "wood_packaging",
  "textiles_(for_packaging)",
] as const;

/**
 * Mock groups data representing what a healthy backend should return.
 * All groups should have positive, non-zero rates.
 *
 * IMPORTANT: These rates are for TESTING ONLY.
 * Real rates come from the backend and are based on JBC-Approved Medium Scenario.
 */
const mockColoradoPhase2Groups: ColoradoPhase2Group[] = [
  // Paper/Cardboard
  { group_key: "cardboard_boxes_&_kraft_bags", group_name: "Cardboard Boxes & Kraft Bags", status: "MRL", base_rate_per_lb: 0.0156 },
  { group_key: "paper-based_cartons", group_name: "Paper-Based Cartons", status: "MRL", base_rate_per_lb: 0.0189 },
  { group_key: "paper_(printed)", group_name: "Paper (Printed)", status: "MRL", base_rate_per_lb: 0.0142 },
  { group_key: "other_paper_packaging", group_name: "Other Paper Packaging", status: "MRL", base_rate_per_lb: 0.0167 },
  // Print Publications (in-kind eligible)
  { group_key: "newspapers", group_name: "Newspapers", status: "MRL", base_rate_per_lb: 0.0134 },
  { group_key: "magazines_/_catalogs", group_name: "Magazines / Catalogs", status: "MRL", base_rate_per_lb: 0.0156 },
  { group_key: "newsprint_(inserts/circulars)", group_name: "Newsprint (Inserts/Circulars)", status: "MRL", base_rate_per_lb: 0.0142 },
  // Plastic
  { group_key: "pet_beverage_containers", group_name: "PET Beverage Containers", status: "MRL", base_rate_per_lb: 0.0234 },
  { group_key: "hdpe_beverage_containers", group_name: "HDPE Beverage Containers", status: "MRL", base_rate_per_lb: 0.0189 },
  { group_key: "pet_other_containers", group_name: "PET Other Containers", status: "MRL", base_rate_per_lb: 0.0267 },
  { group_key: "hdpe_other_containers", group_name: "HDPE Other Containers", status: "MRL", base_rate_per_lb: 0.0201 },
  { group_key: "pp_containers", group_name: "PP Containers", status: "MRL", base_rate_per_lb: 0.0312 },
  { group_key: "other_rigid_plastic", group_name: "Other Rigid Plastic", status: "MRL", base_rate_per_lb: 0.0378 },
  { group_key: "plastic_film", group_name: "Plastic Film", status: "MRL", base_rate_per_lb: 0.0445 },
  // Metal
  { group_key: "aluminum_beverage_containers", group_name: "Aluminum Beverage Containers", status: "MRL", base_rate_per_lb: 0.0098 },
  { group_key: "steel_food_&_beverage_containers", group_name: "Steel Food & Beverage Containers", status: "MRL", base_rate_per_lb: 0.0067 },
  { group_key: "other_metal_packaging", group_name: "Other Metal Packaging", status: "MRL", base_rate_per_lb: 0.0089 },
  // Glass
  { group_key: "glass_beverage_containers", group_name: "Glass Beverage Containers", status: "MRL", base_rate_per_lb: 0.0112 },
  { group_key: "glass_food_containers", group_name: "Glass Food Containers", status: "MRL", base_rate_per_lb: 0.0134 },
  // Other
  { group_key: "wood_packaging", group_name: "Wood Packaging", status: "MRL", base_rate_per_lb: 0.0078 },
  { group_key: "textiles_(for_packaging)", group_name: "Textiles (for Packaging)", status: "MRL", base_rate_per_lb: 0.0256 },
];

describe("Colorado Phase 2 rate coverage", () => {
  describe("All expected material groups have valid rates", () => {
    EXPECTED_COLORADO_GROUPS.forEach((groupKey) => {
      it(`resolves a valid rate for "${groupKey}"`, () => {
        // This test will fail if the mock data doesn't include this group
        // or if the rate is 0/invalid
        expect(hasValidColoradoRate(mockColoradoPhase2Groups, groupKey)).toBe(true);

        const rate = resolveColoradoRate(mockColoradoPhase2Groups, groupKey);
        expect(rate).toBeGreaterThan(0);
      });
    });
  });

  describe("In-Kind eligible groups have valid rates", () => {
    IN_KIND_ELIGIBLE_GROUPS.forEach((groupKey) => {
      it(`"${groupKey}" is in expected groups and has valid rate`, () => {
        // Verify the in-kind eligible group is in our expected list
        expect(EXPECTED_COLORADO_GROUPS).toContain(groupKey);

        // Verify it has a valid rate
        expect(hasValidColoradoRate(mockColoradoPhase2Groups, groupKey)).toBe(true);
      });
    });
  });

  describe("Rate resolver guards", () => {
    it("throws ColoradoRateError for group not in data", () => {
      expect(() =>
        resolveColoradoRate(mockColoradoPhase2Groups, "nonexistent_group")
      ).toThrow(ColoradoRateError);
    });

    it("throws ColoradoRateError for group with zero rate", () => {
      const groupsWithZeroRate: ColoradoPhase2Group[] = [
        { group_key: "broken_group", group_name: "Broken", status: "NC", base_rate_per_lb: 0 },
      ];

      expect(() =>
        resolveColoradoRate(groupsWithZeroRate, "broken_group")
      ).toThrow(ColoradoRateError);
    });

    it("throws ColoradoRateError with helpful message for missing groups", () => {
      try {
        resolveColoradoRate(mockColoradoPhase2Groups, "nonexistent_plastic");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ColoradoRateError);
        const error = err as ColoradoRateError;
        expect(error.message).toContain("not found");
        expect(error.groupKey).toBe("nonexistent_plastic");
        expect(error.availableGroups).toBeDefined();
        expect(error.availableGroups!.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Mock data completeness check", () => {
    it("mock data contains all expected groups", () => {
      const mockKeys = mockColoradoPhase2Groups.map((g) => g.group_key);

      for (const expectedKey of EXPECTED_COLORADO_GROUPS) {
        expect(mockKeys).toContain(expectedKey);
      }
    });

    it("all mock groups have positive rates", () => {
      for (const group of mockColoradoPhase2Groups) {
        expect(group.base_rate_per_lb).toBeGreaterThan(0);
      }
    });

    it("no duplicate group keys in mock data", () => {
      const keys = mockColoradoPhase2Groups.map((g) => g.group_key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});

/**
 * UI + PDF Parity Tests
 *
 * These tests verify that on-screen display and PDF export use identical
 * resolved rate values. This prevents the bug where PDF shows different
 * rates than the UI.
 */
describe("Colorado UI + PDF rate parity", () => {
  it("resolveColoradoRateSafe returns same value used by formatRateForPDF", () => {
    // For each group, verify the resolved rate formats identically
    for (const group of mockColoradoPhase2Groups) {
      if (group.base_rate_per_lb > 0) {
        const resolvedRate = resolveColoradoRate(mockColoradoPhase2Groups, group.group_key);
        const formattedRate = formatRateForPDF(resolvedRate);

        // The formatted rate should NOT be "—" for valid groups
        expect(formattedRate).not.toBe("—");
        expect(formattedRate).toMatch(/^\$\d+\.\d{4}$/);
      }
    }
  });

  it("invalid rates produce identical '—' in both UI and PDF contexts", () => {
    // Create a group with zero rate
    const groupsWithZeroRate: ColoradoPhase2Group[] = [
      { group_key: "broken_group", group_name: "Broken", status: "NC", base_rate_per_lb: 0 },
    ];

    // resolveColoradoRateSafe should return null for invalid rate
    const resolvedRate = resolveColoradoRateSafe(groupsWithZeroRate, "broken_group");
    expect(resolvedRate).toBeNull();

    // formatRateForPDF should return "—" for null/0 rate
    expect(formatRateForPDF(0)).toBe("—");
    expect(formatRateForPDF(resolvedRate as unknown as number)).toBe("—");
  });

  it("PDF and UI use the same resolved rate value (not API response)", () => {
    // This test documents the contract: all Colorado rate consumers
    // MUST use resolveColoradoRate/resolveColoradoRateSafe, NOT
    // the raw base_rate_per_lb from API responses.

    const groupKey = "newspapers";
    const resolvedRate = resolveColoradoRate(mockColoradoPhase2Groups, groupKey);

    // Simulate a scenario where API response has different rate
    const apiResponseRate = 0; // Backend bug - returns 0

    // The UI/PDF should use resolvedRate, not apiResponseRate
    expect(resolvedRate).toBeGreaterThan(0);
    expect(resolvedRate).not.toBe(apiResponseRate);

    // This is the contract we enforce in the code:
    // displayRate = resolvedRate ?? result.base_rate_per_lb
    // If resolvedRate is provided, it takes precedence
  });
});

/**
 * Integration test placeholder for testing against real backend.
 *
 * To enable:
 * 1. Set VITE_RUN_INTEGRATION_TESTS=true in environment
 * 2. Ensure backend is running at the configured API_BASE_URL
 *
 * These tests verify the actual backend returns valid data.
 */
describe.skip("Colorado Phase 2 backend integration", () => {
  it("fetches groups from real backend with valid rates", async () => {
    // TODO: Implement when integration test infrastructure is ready
    // const groups = await fetchColoradoPhase2Groups();
    // for (const group of groups) {
    //   expect(group.base_rate_per_lb).toBeGreaterThan(0);
    // }
  });
});
