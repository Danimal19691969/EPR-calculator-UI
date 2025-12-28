/**
 * State Code Normalization Tests
 *
 * These tests ensure the state code normalization utility correctly handles
 * all edge cases and prevents the 404 bug from recurring.
 *
 * BUG CONTEXT: The backend API requires lowercase state codes in URLs.
 * For example: /materials/colorado NOT /materials/Colorado
 * FastAPI routes are case-sensitive, so incorrect casing causes 404 errors.
 */

import { describe, it, expect } from "vitest";
import { normalizeStateCode, isValidStateCode } from "./stateCode";

describe("normalizeStateCode", () => {
  describe("successful normalization", () => {
    it('converts "Colorado" to "colorado"', () => {
      expect(normalizeStateCode("Colorado")).toBe("colorado");
    });

    it('converts " Oregon " (with whitespace) to "oregon"', () => {
      expect(normalizeStateCode(" Oregon ")).toBe("oregon");
    });

    it('converts "COLORADO" to "colorado"', () => {
      expect(normalizeStateCode("COLORADO")).toBe("colorado");
    });

    it('converts "oregon" (already lowercase) to "oregon"', () => {
      expect(normalizeStateCode("oregon")).toBe("oregon");
    });

    it('converts "  OREGON  " (uppercase with extra whitespace) to "oregon"', () => {
      expect(normalizeStateCode("  OREGON  ")).toBe("oregon");
    });

    it('converts "CoLoRaDo" (mixed case) to "colorado"', () => {
      expect(normalizeStateCode("CoLoRaDo")).toBe("colorado");
    });

    it("handles tab and newline whitespace", () => {
      expect(normalizeStateCode("\tColorado\n")).toBe("colorado");
    });
  });

  describe("error handling", () => {
    it('throws error for empty string ""', () => {
      expect(() => normalizeStateCode("")).toThrow("State code is required but was empty");
    });

    it("throws error for undefined", () => {
      expect(() => normalizeStateCode(undefined)).toThrow(
        "State code is required but was undefined or null"
      );
    });

    it("throws error for null", () => {
      expect(() => normalizeStateCode(null)).toThrow(
        "State code is required but was undefined or null"
      );
    });

    it('throws error for whitespace-only string "   "', () => {
      expect(() => normalizeStateCode("   ")).toThrow("State code is required but was empty");
    });

    it('throws error for tab-only string "\\t"', () => {
      expect(() => normalizeStateCode("\t")).toThrow("State code is required but was empty");
    });
  });
});

describe("isValidStateCode", () => {
  describe("valid state codes", () => {
    it('returns true for "Colorado"', () => {
      expect(isValidStateCode("Colorado")).toBe(true);
    });

    it('returns true for "oregon"', () => {
      expect(isValidStateCode("oregon")).toBe(true);
    });

    it('returns true for " Oregon " (with whitespace)', () => {
      expect(isValidStateCode(" Oregon ")).toBe(true);
    });
  });

  describe("invalid state codes", () => {
    it('returns false for empty string ""', () => {
      expect(isValidStateCode("")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidStateCode(undefined)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isValidStateCode(null)).toBe(false);
    });

    it('returns false for whitespace-only "   "', () => {
      expect(isValidStateCode("   ")).toBe(false);
    });
  });
});
