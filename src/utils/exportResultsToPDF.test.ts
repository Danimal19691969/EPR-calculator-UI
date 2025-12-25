/**
 * PDF Export Utility Tests
 *
 * CRITICAL: These tests verify that PDF export formatting matches on-screen display.
 * The PDF must never show different values than the UI.
 */

import { describe, it, expect } from "vitest";
import {
  formatCurrencyForPDF,
  formatRateForPDF,
  isValidRateForPDF,
  generatePDFFilename,
} from "./exportResultsToPDF";

describe("formatRateForPDF", () => {
  /**
   * CRITICAL BUG FIX: Zero rate must show "—", not "$0.0000"
   */
  it("returns '—' for zero rate (data problem indicator)", () => {
    expect(formatRateForPDF(0)).toBe("—");
  });

  it("returns '—' for negative rate", () => {
    expect(formatRateForPDF(-0.01)).toBe("—");
  });

  it("returns '—' for NaN", () => {
    expect(formatRateForPDF(NaN)).toBe("—");
  });

  it("returns '—' for Infinity", () => {
    expect(formatRateForPDF(Infinity)).toBe("—");
    expect(formatRateForPDF(-Infinity)).toBe("—");
  });

  it("returns '—' for undefined (cast as number)", () => {
    expect(formatRateForPDF(undefined as unknown as number)).toBe("—");
  });

  it("formats valid rate with 4 decimal places", () => {
    expect(formatRateForPDF(0.02)).toBe("$0.0200");
    expect(formatRateForPDF(0.015)).toBe("$0.0150");
    expect(formatRateForPDF(0.0001)).toBe("$0.0001");
  });

  it("formats larger rates correctly", () => {
    expect(formatRateForPDF(1.5)).toBe("$1.5000");
    expect(formatRateForPDF(10)).toBe("$10.0000");
  });
});

describe("isValidRateForPDF", () => {
  it("returns false for zero", () => {
    expect(isValidRateForPDF(0)).toBe(false);
  });

  it("returns false for negative numbers", () => {
    expect(isValidRateForPDF(-0.01)).toBe(false);
    expect(isValidRateForPDF(-100)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isValidRateForPDF(NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isValidRateForPDF(Infinity)).toBe(false);
    expect(isValidRateForPDF(-Infinity)).toBe(false);
  });

  it("returns true for valid positive rates", () => {
    expect(isValidRateForPDF(0.02)).toBe(true);
    expect(isValidRateForPDF(0.0001)).toBe(true);
    expect(isValidRateForPDF(1)).toBe(true);
    expect(isValidRateForPDF(100)).toBe(true);
  });
});

describe("formatCurrencyForPDF", () => {
  it("formats currency with 2 decimal places", () => {
    expect(formatCurrencyForPDF(2.0)).toBe("$2.00");
    expect(formatCurrencyForPDF(7.5)).toBe("$7.50");
    expect(formatCurrencyForPDF(1234.56)).toBe("$1,234.56");
  });

  it("returns '$0.00' for NaN", () => {
    expect(formatCurrencyForPDF(NaN)).toBe("$0.00");
  });

  it("returns '$0.00' for undefined", () => {
    expect(formatCurrencyForPDF(undefined as unknown as number)).toBe("$0.00");
  });
});

describe("generatePDFFilename", () => {
  it("generates correct filename format", () => {
    const filename = generatePDFFilename("Colorado", "Plastic - Rigid");
    expect(filename).toMatch(/^EPR_Fee_Estimate_Portco_Colorado_Plastic_Rigid_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("sanitizes special characters in material name", () => {
    const filename = generatePDFFilename("Oregon", "Glass/Ceramics (clear)");
    // Note: sanitizeFilename replaces special chars with _, then collapses multiple _
    // "Glass/Ceramics (clear)" → "Glass_Ceramics_clear_" (trailing from space+paren)
    expect(filename).toMatch(/^EPR_Fee_Estimate_Portco_Oregon_Glass_Ceramics_clear_+\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("handles empty material name", () => {
    const filename = generatePDFFilename("Colorado", "");
    expect(filename).toMatch(/^EPR_Fee_Estimate_Portco_Colorado__\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
