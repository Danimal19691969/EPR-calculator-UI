/**
 * ColoradoPhase2Breakdown Component Tests
 *
 * These tests verify Colorado Phase 2 calculation display and edge cases.
 * CRITICAL: These tests ONLY cover Colorado - Oregon tests are in separate files.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ColoradoPhase2Breakdown from "./ColoradoPhase2Breakdown";
import type { ColoradoPhase2CalculateResponse } from "../services/api";

describe("ColoradoPhase2Breakdown", () => {
  /**
   * Valid calculation result - should display correctly
   */
  it("renders correctly with valid calculation result", () => {
    const validResult: ColoradoPhase2CalculateResponse = {
      aggregated_group: "plastic_rigid",
      weight_lbs: 100,
      base_rate_per_lb: 0.02,
      base_dues: 2.0,
      after_eco_modulation: 2.0,
      after_cdphe_bonus: 2.0,
      final_payable: 2.0,
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 0,
    };

    render(
      <ColoradoPhase2Breakdown
        result={validResult}
        groupName="Plastic - Rigid"
        resolvedRate={0.02}
      />
    );

    // Check main fee display
    expect(screen.getByText("Estimated 2026 Program Fee")).toBeInTheDocument();

    // Main display shows final payable
    expect(screen.getByText("$2.00", { selector: ".fee-display-main" })).toBeInTheDocument();

    // Check rate display - should show $0.0200/lb NOT $0.0000/lb
    expect(screen.getByText("$0.0200/lb")).toBeInTheDocument();

    // Check weight - find in the Weight row
    const weightRow = screen.getByText("Weight").closest("tr");
    expect(weightRow?.textContent).toContain("100");
    expect(weightRow?.textContent).toContain("lbs");
  });

  /**
   * CRITICAL BUG TEST: Rate of 0 should NOT display as $0.0000/lb silently
   * When base_rate_per_lb is 0, it indicates a data problem.
   */
  it("does NOT silently display $0.0000/lb when rate is zero - shows warning", () => {
    const zeroRateResult: ColoradoPhase2CalculateResponse = {
      aggregated_group: "unknown_group",
      weight_lbs: 100,
      base_rate_per_lb: 0, // BUG: Zero rate indicates missing data
      base_dues: 0,
      after_eco_modulation: 0,
      after_cdphe_bonus: 0,
      final_payable: 0,
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 0,
    };

    render(<ColoradoPhase2Breakdown result={zeroRateResult} />);

    // Should NOT show $0.0000/lb - that hides the real problem
    const rateCell = screen.getByText(/JBC-Approved Medium Scenario Rate/i)
      .closest("tr")
      ?.querySelector(".fee-row-value");

    // Rate should show "—" (em-dash), NOT "$0.0000/lb"
    expect(rateCell?.textContent).toBe("—/lb");

    // Should show a warning banner
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Rate Not Yet Published/i)).toBeInTheDocument();
  });

  /**
   * CRITICAL BUG TEST: NaN rate should not render NaN
   */
  it("does NOT render NaN when rate is NaN", () => {
    const nanRateResult: ColoradoPhase2CalculateResponse = {
      aggregated_group: "plastic_rigid",
      weight_lbs: 100,
      base_rate_per_lb: NaN,
      base_dues: NaN,
      after_eco_modulation: NaN,
      after_cdphe_bonus: NaN,
      final_payable: NaN,
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 0,
    };

    render(<ColoradoPhase2Breakdown result={nanRateResult} />);

    // Should not contain "NaN" anywhere
    const html = document.body.innerHTML;
    expect(html).not.toContain("NaN");
  });

  /**
   * CRITICAL BUG TEST: Undefined rate should not render NaN or crash
   */
  it("handles undefined rate gracefully", () => {
    // Simulate what happens when API returns missing field
    const undefinedRateResult = {
      aggregated_group: "plastic_rigid",
      weight_lbs: 100,
      // base_rate_per_lb is undefined (missing from API response)
      base_dues: 0,
      after_eco_modulation: 0,
      after_cdphe_bonus: 0,
      final_payable: 0,
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 0,
    } as ColoradoPhase2CalculateResponse;

    render(<ColoradoPhase2Breakdown result={undefinedRateResult} />);

    // Should not contain "NaN" or "undefined"
    const html = document.body.innerHTML;
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("undefined");
  });

  /**
   * Calculation consistency: base_dues must equal weight * rate
   */
  it("displays mathematically consistent base_dues (weight × rate)", () => {
    const result: ColoradoPhase2CalculateResponse = {
      aggregated_group: "paper_cardboard",
      weight_lbs: 500,
      base_rate_per_lb: 0.015, // $0.015/lb
      base_dues: 7.5, // 500 × 0.015 = 7.50
      after_eco_modulation: 7.5,
      after_cdphe_bonus: 7.5,
      final_payable: 7.5,
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 0,
    };

    render(<ColoradoPhase2Breakdown result={result} groupName="Paper - Cardboard" resolvedRate={0.015} />);

    // Rate should be $0.0150/lb
    expect(screen.getByText("$0.0150/lb")).toBeInTheDocument();

    // Base dues should be $7.50 (in subtotal row)
    const baseDuesRow = screen.getByText("Base Dues").closest("tr");
    expect(baseDuesRow?.textContent).toContain("$7.50");
  });

  /**
   * Layer 1 (PRO Eco-Modulation) calculation
   */
  it("calculates PRO Eco-Modulation correctly (Layer 1)", () => {
    const result: ColoradoPhase2CalculateResponse = {
      aggregated_group: "plastic_rigid",
      weight_lbs: 1000,
      base_rate_per_lb: 0.02,
      base_dues: 20.0, // 1000 × 0.02
      after_eco_modulation: 18.0, // 20 - (20 × 0.10) = 18
      after_cdphe_bonus: 18.0,
      final_payable: 18.0,
      pro_modulation_percent: 0.10, // 10% reduction
      cdphe_bonus_percent: 0,
      newspaper_credit: 0,
    };

    render(<ColoradoPhase2Breakdown result={result} />);

    // Should show the eco-modulation as credit
    expect(screen.getByText(/PRO Eco-Modulation \(10%\)/i)).toBeInTheDocument();
    // Delta should be −$2.00
    expect(screen.getByText("−$2.00")).toBeInTheDocument();
    // After eco-mod should be $18.00 - find in the specific row
    const afterEcoModRow = screen.getByText("After PRO Eco-Modulation").closest("tr");
    expect(afterEcoModRow?.textContent).toContain("$18.00");
  });

  /**
   * Layer 2 (CDPHE Performance Benchmarks) calculation
   */
  it("calculates CDPHE Performance Benchmarks correctly (Layer 2)", () => {
    const result: ColoradoPhase2CalculateResponse = {
      aggregated_group: "plastic_rigid",
      weight_lbs: 1000,
      base_rate_per_lb: 0.02,
      base_dues: 20.0,
      after_eco_modulation: 17.0, // After 15% eco-mod
      after_cdphe_bonus: 16.4, // After 3% CDPHE (applies to base_dues)
      final_payable: 16.4,
      pro_modulation_percent: 0.15, // 15% PRO reduction
      cdphe_bonus_percent: 0.03, // 3% CDPHE reduction
      newspaper_credit: 0,
    };

    render(<ColoradoPhase2Breakdown result={result} />);

    // Should show CDPHE bonus
    expect(screen.getByText(/CDPHE Bonus \(3%\)/i)).toBeInTheDocument();
  });

  /**
   * In-Kind Advertising Credit
   */
  it("displays In-Kind Advertising Credit correctly", () => {
    const result: ColoradoPhase2CalculateResponse = {
      aggregated_group: "newspaper",
      weight_lbs: 1000,
      base_rate_per_lb: 0.01,
      base_dues: 10.0,
      after_eco_modulation: 10.0,
      after_cdphe_bonus: 10.0,
      final_payable: 5.0, // After $5 in-kind credit
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 5.0,
    };

    render(<ColoradoPhase2Breakdown result={result} />);

    // Should show in-kind credit
    expect(screen.getByText(/In-Kind Advertising Credit Applied/i)).toBeInTheDocument();
    expect(screen.getByText("-$5.00")).toBeInTheDocument();
  });

  /**
   * Final payable should never go negative (floor at $0)
   */
  it("floors final payable at $0.00 (never negative)", () => {
    const result: ColoradoPhase2CalculateResponse = {
      aggregated_group: "newspaper",
      weight_lbs: 100,
      base_rate_per_lb: 0.01,
      base_dues: 1.0,
      after_eco_modulation: 1.0,
      after_cdphe_bonus: 1.0,
      final_payable: 0, // Even if calculation would be negative
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 10.0, // Credit larger than base dues
    };

    render(<ColoradoPhase2Breakdown result={result} />);

    // Final should be $0.00, not negative
    const finalRow = screen.getByText("Final Payable").closest("tr");
    expect(finalRow?.textContent).toContain("$0.00");

    // Main display should show $0.00
    expect(screen.getByText("$0.00", { selector: ".fee-display-main" })).toBeInTheDocument();
  });

  /**
   * Returns null when result is null
   */
  it("renders nothing when result is null", () => {
    const { container } = render(<ColoradoPhase2Breakdown result={null} />);
    expect(container.firstChild).toBeNull();
  });
});
