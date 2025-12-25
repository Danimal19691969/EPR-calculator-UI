/**
 * PDF Export Utility
 *
 * Exports EPR calculator results as a professionally formatted PDF document.
 * Uses html2canvas to capture a hidden print-optimized layout, then embeds
 * the image(s) into a jsPDF document.
 *
 * IMPORTANT: This utility does NOT recalculate any fees. All values must
 * come directly from the existing calculator state.
 *
 * Future-proofing: This module is structured to support additional export
 * formats (CSV, Excel) in the future.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Shared data structure for PDF export.
 * Contains all values needed to render the PDF, sourced from UI state.
 */
export interface PDFExportData {
  // Header information
  state: string;
  programName: string;
  materialCategory: string;
  subcategory?: string;
  weightLbs: number;
  dateGenerated: string;

  // Fee summary
  finalPayable: number;
  baseDues: number;

  // Timeline steps (for delta visualization)
  timelineSteps: Array<{
    label: string;
    delta: number;
    sublabel?: string;
  }>;

  // Fee breakdown rows
  breakdownRows: Array<{
    label: string;
    value: string;
    type: "normal" | "subtotal" | "credit" | "total" | "header";
  }>;

  // Explanation text (plain text, not JSX)
  explanationText: string;

  // Authority & basis references
  authorityText: string;
  lawReference: string;

  // State-specific compliance notice (optional)
  complianceNotice?: string;
}

/**
 * Format a date as YYYY-MM-DD for filename.
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Sanitize a string for use in filenames.
 */
function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
}

/**
 * Generate the PDF filename following the required format.
 */
export function generatePDFFilename(state: string, material: string): string {
  const dateStr = formatDateForFilename(new Date());
  const sanitizedState = sanitizeFilename(state);
  const sanitizedMaterial = sanitizeFilename(material);
  return `EPR_Fee_Estimate_Portco_${sanitizedState}_${sanitizedMaterial}_${dateStr}.pdf`;
}

/**
 * The exact background color used in the PDF layout.
 * This MUST match the UI background color exactly to prevent seams.
 */
const PDF_BACKGROUND_COLOR = "#1a1d24";

/**
 * Overlap bleed in pixels to prevent page break seams.
 * Each slice extends this many pixels into the next page's territory.
 * This eliminates anti-aliasing artifacts at slice boundaries.
 */
const OVERLAP_BLEED_PX = 2;

/**
 * Render the printable layout element to a canvas, then to PDF.
 *
 * This function captures the HTML element as a high-resolution canvas image,
 * then slices it into page-sized chunks for the PDF.
 *
 * CRITICAL: PAGE BREAK SEAM PREVENTION
 * =====================================
 * White horizontal lines at page breaks are caused by:
 * 1. Fractional pixel boundaries during canvas slicing
 * 2. Canvas transparency at slice edges
 * 3. Subpixel anti-aliasing during drawImage operations
 * 4. Gaps between consecutive page slices
 *
 * To prevent seams, this function:
 * - Uses ONLY integer pixel values for ALL slice boundaries
 * - Computes a fixed integer slice height used for ALL pages
 * - Adds OVERLAP_BLEED_PX overlap between slices (each slice extends into next)
 * - Fills each page canvas with solid background BEFORE drawing content
 * - Disables image smoothing to prevent anti-aliasing artifacts
 * - Places each image at exactly (0, 0) with no negative offsets
 *
 * DO NOT refactor this logic without testing multi-page PDF output visually.
 *
 * @param element - The hidden printable layout DOM element
 * @param filename - The output filename
 */
export async function exportElementToPDF(
  element: HTMLElement,
  filename: string
): Promise<void> {
  // Use integer scale factor for consistent rendering
  const scale = 2;

  // Capture the element as a canvas with high quality
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true, // Allow cross-origin images (logo)
    backgroundColor: PDF_BACKGROUND_COLOR,
    logging: false,
  });

  // A4 dimensions in mm (integers)
  const pdfPageWidth = 210;
  const pdfPageHeight = 297;

  // CRITICAL: Calculate slice height as an INTEGER to prevent fractional pixel boundaries
  // This is the number of canvas pixels that correspond to one PDF page height.
  // Using Math.floor ensures we never exceed the page and creates consistent slicing.
  const canvasPageHeightExact = (canvas.width * pdfPageHeight) / pdfPageWidth;
  const sliceHeightPerPage = Math.floor(canvasPageHeightExact);

  // Calculate total pages needed (using the integer slice height)
  const totalPages = Math.ceil(canvas.height / sliceHeightPerPage);

  // Create PDF
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Process each page by slicing the canvas
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    // CRITICAL: Use integer-only math for slice boundaries
    // sliceY = pageIndex * sliceHeightPerPage (always an integer)
    const sliceY = pageIndex * sliceHeightPerPage;

    // For the last page, we may have less content than a full page
    const remainingHeight = canvas.height - sliceY;

    // CRITICAL: Add overlap bleed to prevent seams between pages
    // Each slice extends OVERLAP_BLEED_PX pixels beyond its nominal boundary
    // This ensures any anti-aliasing at the edge is covered by the next page
    const isLastPage = pageIndex === totalPages - 1;
    const nominalSliceHeight = Math.min(sliceHeightPerPage, remainingHeight);
    const bleedExtension = isLastPage ? 0 : Math.min(OVERLAP_BLEED_PX, canvas.height - sliceY - nominalSliceHeight);
    const thisSliceHeight = nominalSliceHeight + bleedExtension;

    // Skip if no content for this page
    if (thisSliceHeight <= 0) continue;

    // Create a new canvas for this page slice
    // CRITICAL: Canvas dimensions must be integers
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.floor(canvas.width); // Ensure integer
    pageCanvas.height = Math.floor(sliceHeightPerPage); // Use full page height (integer)

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) continue;

    // CRITICAL: Disable image smoothing to prevent anti-aliasing artifacts at edges
    // This prevents subpixel interpolation that can create faint lines
    ctx.imageSmoothingEnabled = false;

    // CRITICAL: Fill the ENTIRE canvas with solid background color FIRST
    // This ensures no transparency anywhere, even if content doesn't fill the page
    ctx.fillStyle = PDF_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // Draw the slice of the original canvas onto this page canvas
    // All values are integers to prevent subpixel rendering
    // The slice includes overlap bleed but is drawn to fill the page canvas
    ctx.drawImage(
      canvas,
      0,                              // Source X (integer)
      Math.floor(sliceY),             // Source Y (integer, floored for safety)
      Math.floor(canvas.width),       // Source width (integer)
      Math.floor(thisSliceHeight),    // Source height with bleed (integer)
      0,                              // Destination X (integer)
      0,                              // Destination Y - ALWAYS 0, never negative
      Math.floor(canvas.width),       // Destination width (integer)
      Math.floor(thisSliceHeight)     // Destination height (integer)
    );

    // Convert to image data
    const pageImgData = pageCanvas.toDataURL("image/png");

    // CRITICAL: Add image at exactly (0, 0) - never use negative offsets
    // Use integer dimensions for PDF placement
    pdf.addImage(
      pageImgData,
      "PNG",
      0,                              // X position (always 0)
      0,                              // Y position (always 0)
      Math.floor(pdfPageWidth),       // Width in mm (integer)
      Math.floor(pdfPageHeight)       // Height in mm (integer)
    );
  }

  // Download the PDF
  pdf.save(filename);
}

/**
 * Format currency for display in PDF.
 */
export function formatCurrencyForPDF(value: number): string {
  if (typeof value !== "number" || isNaN(value)) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format currency with 4 decimal places (for rates).
 * CRITICAL: Returns "—" for invalid/zero/null rates to match on-screen display.
 * A rate of 0 or null indicates missing backend data - never hide this.
 */
export function formatRateForPDF(value: number | null): string {
  // Guard against null/NaN/undefined/0 - these indicate data problems
  // Must match the behavior of ColoradoPhase2Breakdown.formatRate()
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

/**
 * Check if a rate is valid (positive, finite number).
 */
export function isValidRateForPDF(value: number): boolean {
  return typeof value === "number" && isFinite(value) && !isNaN(value) && value > 0;
}

/**
 * Re-export disclaimer text from centralized labels file.
 * This maintains backward compatibility with existing imports.
 */
export { PDF_DISCLAIMER_TEXT } from "../pdf/labels";
