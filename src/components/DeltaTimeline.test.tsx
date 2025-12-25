/**
 * DeltaTimeline Component Tests
 *
 * CRITICAL ARCHITECTURE RULE:
 * The DeltaTimeline is a RENDER-ONLY component. It does NOT compute any values.
 * - finalValue is MANDATORY and used verbatim
 * - The component NEVER sums deltas to derive a final value
 * - All tests verify that the component displays canonical values exactly as provided
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeltaTimeline from "./DeltaTimeline";

describe("DeltaTimeline", () => {
  describe("Render-Only Architecture", () => {
    it("renders without crashing with valid inputs", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[{ label: "Test", delta: -10 }]}
          finalValue={90}
        />
      );
      expect(screen.getByText("FEE ADJUSTMENT TIMELINE")).toBeInTheDocument();
    });

    it("displays the EXACT finalValue provided - no computation", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[{ label: "Reduction", delta: -25 }]}
          finalValue={75}
        />
      );
      // The component MUST use finalValue verbatim, NOT compute 100 - 25
      const readoutValue = document.querySelector(".delta-timeline__readoutValue");
      expect(readoutValue).toHaveTextContent("$75.00");
    });

    it("uses finalValue even when it does NOT match sum of deltas", () => {
      // This test verifies the timeline does NOT recompute
      // Deltas sum to 100 - 10 - 5 = 85, but finalValue is 77
      render(
        <DeltaTimeline
          startValue={100}
          steps={[
            { label: "Step 1", delta: -10 },
            { label: "Step 2", delta: -5 },
          ]}
          finalValue={77}
        />
      );
      // Must show 77, not 85
      const readoutValue = document.querySelector(".delta-timeline__readoutValue");
      expect(readoutValue).toHaveTextContent("$77.00");
    });

    it("displays startValue exactly as provided", () => {
      render(
        <DeltaTimeline
          startValue={156.78}
          steps={[{ label: "Test", delta: -10 }]}
          finalValue={146.78}
        />
      );
      // Should display exact startValue (Base Dues value)
      // The startValue appears in the SVG timeline
      expect(screen.getByText("$156.78")).toBeInTheDocument();
      // The finalValue appears in header readout and SVG timeline
      // Use getAllByText since finalValue appears in multiple places
      const finalElements = screen.getAllByText("$146.78");
      expect(finalElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("NaN/Infinity Safety", () => {
    it("does NOT render NaN when startValue is NaN", () => {
      render(
        <DeltaTimeline
          startValue={NaN}
          steps={[{ label: "Test", delta: -10 }]}
          finalValue={0}
        />
      );
      const html = document.body.innerHTML;
      expect(html).not.toContain("NaN");
      const readoutValue = document.querySelector(".delta-timeline__readoutValue");
      expect(readoutValue).toHaveTextContent("$0.00");
    });

    it("does NOT render NaN when step delta is NaN", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[{ label: "Bad Delta", delta: NaN }]}
          finalValue={100}
        />
      );
      const html = document.body.innerHTML;
      expect(html).not.toContain("NaN");
    });

    it("does NOT render NaN when finalValue is NaN", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[]}
          finalValue={NaN}
        />
      );
      const html = document.body.innerHTML;
      expect(html).not.toContain("NaN");
      const readoutValue = document.querySelector(".delta-timeline__readoutValue");
      expect(readoutValue).toHaveTextContent("$0.00");
    });

    it("handles Infinity in startValue gracefully", () => {
      render(
        <DeltaTimeline
          startValue={Infinity}
          steps={[{ label: "Test", delta: -10 }]}
          finalValue={0}
        />
      );
      const html = document.body.innerHTML;
      expect(html).not.toContain("Infinity");
    });

    it("handles Infinity in finalValue gracefully", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[]}
          finalValue={Infinity}
        />
      );
      const html = document.body.innerHTML;
      expect(html).not.toContain("Infinity");
    });
  });

  describe("Negative Value Handling", () => {
    it("clamps negative finalValue to zero", () => {
      render(
        <DeltaTimeline
          startValue={50}
          steps={[{ label: "Big Reduction", delta: -100 }]}
          finalValue={-50}
        />
      );
      // Final should be clamped to $0.00, not -$50.00
      const readoutValue = document.querySelector(".delta-timeline__readoutValue");
      expect(readoutValue).toHaveTextContent("$0.00");
      const html = document.body.innerHTML;
      expect(html).not.toContain("-$50");
    });
  });

  describe("UI Rendering", () => {
    it("renders the footer note", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[]}
          finalValue={100}
        />
      );
      expect(screen.getByText(/estimates only/i)).toBeInTheDocument();
    });

    it("renders Base Dues and Final nodes", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[{ label: "Reduction", delta: -25 }]}
          finalValue={75}
        />
      );
      expect(screen.getByText("Base Dues")).toBeInTheDocument();
      expect(screen.getByText("Final")).toBeInTheDocument();
    });

    it("renders step labels correctly", () => {
      render(
        <DeltaTimeline
          startValue={100}
          steps={[
            { label: "Eco-Mod", delta: -10 },
            { label: "CDPHE", delta: -5 },
          ]}
          finalValue={85}
        />
      );
      expect(screen.getByText("Eco-Mod")).toBeInTheDocument();
      expect(screen.getByText("CDPHE")).toBeInTheDocument();
    });

    it("handles multiple steps correctly", () => {
      render(
        <DeltaTimeline
          startValue={200}
          steps={[
            { label: "Step 1", delta: -50 },
            { label: "Step 2", delta: -30 },
            { label: "Step 3", delta: -20 },
          ]}
          finalValue={100}
        />
      );
      // Verifies all step labels render and finalValue is used verbatim
      expect(screen.getByText("Step 1")).toBeInTheDocument();
      expect(screen.getByText("Step 2")).toBeInTheDocument();
      expect(screen.getByText("Step 3")).toBeInTheDocument();
      const readoutValue = document.querySelector(".delta-timeline__readoutValue");
      expect(readoutValue).toHaveTextContent("$100.00");
    });
  });
});
