/**
 * PDF Snapshot Interface
 *
 * SINGLE SOURCE OF TRUTH for UI → PDF data transfer.
 *
 * This interface defines the EXACT data structure that the PDF generator
 * receives from the UI. The PDF generator has NO ACCESS to:
 * - Backend API responses
 * - Calculation functions
 * - Business logic
 * - Rate resolvers
 *
 * ALL values in this snapshot are PRE-FORMATTED strings exactly as they
 * appear on screen. The PDF renderer simply displays these values.
 *
 * CRITICAL INVARIANT:
 * If you can see it in the UI, it MUST appear identically in the PDF.
 * No recomputation. No reformatting. No interpretation.
 */

/**
 * Header section data - exactly as displayed in UI.
 */
export interface PdfSnapshotHeader {
  /** Main title (e.g., "EPR Fee Estimator") */
  title: string;
  /** Subtitle if present */
  subtitle?: string;
  /** Full disclaimer text - EXACT wording from UI */
  disclaimer: string;
}

/**
 * Metadata section - state, program, material, weight.
 */
export interface PdfSnapshotMetadata {
  /** State name (e.g., "Colorado") */
  state: string;
  /** Program name (e.g., "Colorado Phase 2 (2026 Program)") */
  programName: string;
  /** Material category (e.g., "Newspapers") */
  materialCategory: string;
  /** Subcategory if applicable */
  subcategory?: string;
  /** Weight display string (e.g., "100 lbs") */
  weightDisplay: string;
  /** Date generated display string */
  dateGenerated: string;
}

/**
 * Summary card data - the main fee display.
 */
export interface PdfSnapshotSummary {
  /** Title text (e.g., "Estimated 2026 Program Fee") - EXACT UI text */
  title: string;
  /** Formatted amount string (e.g., "$1.34") - EXACT UI format */
  amount: string;
  /** Scenario label (e.g., "JBC-Approved Medium Scenario") */
  scenarioLabel?: string;
  /** Additional info line (e.g., "Newspapers · 100 lbs") */
  infoLine?: string;
}

/**
 * A single row in the fee breakdown table.
 * Values are PRE-FORMATTED strings exactly as shown in UI.
 */
export interface PdfSnapshotBreakdownRow {
  /** Label text - EXACT UI label */
  label: string;
  /** Formatted value string - EXACT UI value */
  value: string;
  /** Row type for styling (matches UI styling) */
  type: "header" | "normal" | "subtotal" | "credit" | "total";
}

/**
 * A single step in the delta timeline.
 * Values are PRE-FORMATTED strings exactly as shown in UI.
 */
export interface PdfSnapshotTimelineStep {
  /** Step label (e.g., "Eco-Mod", "CDPHE", "In-Kind") */
  label: string;
  /** Sublabel with full description */
  sublabel?: string;
  /** Formatted delta value (e.g., "-$0.50") - INCLUDES sign */
  deltaDisplay: string;
  /** Numeric delta for bar height calculation (the ONLY number allowed) */
  deltaMagnitude: number;
}

/**
 * Timeline section data.
 */
export interface PdfSnapshotTimeline {
  /** Starting value display (e.g., "$1.34") */
  startValueDisplay: string;
  /** Final value display (e.g., "$1.00") */
  finalValueDisplay: string;
  /** Timeline steps */
  steps: PdfSnapshotTimelineStep[];
}

/**
 * Complete PDF Snapshot - everything needed to render the PDF.
 *
 * This is the ONLY input the PDF generator accepts.
 * There is no other way for data to enter the PDF.
 */
export interface PdfSnapshot {
  /** Header section */
  header: PdfSnapshotHeader;

  /** Metadata section */
  metadata: PdfSnapshotMetadata;

  /** Summary card (main fee display) */
  summary: PdfSnapshotSummary;

  /** Fee breakdown rows - IN ORDER as displayed in UI */
  breakdownRows: PdfSnapshotBreakdownRow[];

  /** Delta timeline data */
  timeline: PdfSnapshotTimeline;

  /** Explanation of fee - EXACT UI text, multiple paragraphs */
  explanationParagraphs: string[];

  /** Authority section */
  authority: {
    /** Authority text */
    text: string;
    /** Law reference */
    lawReference: string;
    /** Compliance notice if applicable */
    complianceNotice?: string;
  };
}

/**
 * Type guard to validate a PdfSnapshot has all required fields.
 */
export function isValidPdfSnapshot(snapshot: unknown): snapshot is PdfSnapshot {
  if (!snapshot || typeof snapshot !== "object") return false;
  const s = snapshot as PdfSnapshot;

  return (
    // Header
    typeof s.header?.title === "string" &&
    typeof s.header?.disclaimer === "string" &&
    // Metadata
    typeof s.metadata?.state === "string" &&
    typeof s.metadata?.programName === "string" &&
    typeof s.metadata?.materialCategory === "string" &&
    typeof s.metadata?.weightDisplay === "string" &&
    typeof s.metadata?.dateGenerated === "string" &&
    // Summary
    typeof s.summary?.title === "string" &&
    typeof s.summary?.amount === "string" &&
    // Breakdown
    Array.isArray(s.breakdownRows) &&
    s.breakdownRows.every(
      (row) =>
        typeof row.label === "string" &&
        typeof row.value === "string" &&
        ["header", "normal", "subtotal", "credit", "total"].includes(row.type)
    ) &&
    // Timeline
    typeof s.timeline?.startValueDisplay === "string" &&
    typeof s.timeline?.finalValueDisplay === "string" &&
    Array.isArray(s.timeline?.steps) &&
    // Explanation
    Array.isArray(s.explanationParagraphs) &&
    // Authority
    typeof s.authority?.text === "string" &&
    typeof s.authority?.lawReference === "string"
  );
}
