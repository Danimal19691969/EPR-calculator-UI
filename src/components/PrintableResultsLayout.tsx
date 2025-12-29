/**
 * PrintableResultsLayout Component
 *
 * A hidden, print-optimized layout for PDF export. This component renders
 * a complete fee summary document suitable for client delivery, compliance
 * review, and internal discussions.
 *
 * IMPORTANT CONSTRAINTS:
 * - Do NOT change any wording of labels, explanations, legal text, or disclaimers
 * - Do NOT recompute any fees — all values come from props
 * - Preserve the dark, glass-like, neon-accent visual identity
 *
 * This component is rendered off-screen and captured via html2canvas.
 */

import { forwardRef } from "react";
import type { TimelineStep } from "./DeltaTimeline";
import type { AdjustmentTimelineStep } from "../services/api";
import {
  PDF_TITLE,
  PDF_LOGO_ALT,
  PDF_META_LABELS,
  PDF_FEE_SUMMARY,
  PDF_SECTION_TITLES,
  PDF_TIMELINE,
  PDF_DISCLAIMER_TEXT,
  buildPDFFooterText,
} from "../pdf/labels";

export interface BreakdownRow {
  label: string;
  value: string;
  type: "normal" | "subtotal" | "credit" | "total" | "header";
}

export interface PrintableResultsLayoutProps {
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

  /**
   * Timeline steps for delta visualization.
   *
   * ARCHITECTURE: Backend is SINGLE SOURCE OF TRUTH.
   * - If backendTimeline is provided, it is used directly (preferred)
   * - If only timelineSteps is provided, it falls back to legacy format
   *
   * The backendTimeline provides running_total directly from backend,
   * ensuring UI and PDF display identical values.
   */
  timelineSteps: TimelineStep[];
  backendTimeline?: AdjustmentTimelineStep[];

  // Fee breakdown rows
  breakdownRows: BreakdownRow[];

  // Explanation text (plain text paragraphs)
  explanationParagraphs: string[];

  // Authority & basis
  authorityText: string;
  lawReference: string;

  // State-specific compliance notice
  complianceNotice?: string;
}

/**
 * Format currency safely.
 */
function fmtCurrency(value: number): string {
  if (typeof value !== "number" || isNaN(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format delta with sign.
 */
function fmtDelta(value: number): string {
  if (typeof value !== "number" || isNaN(value) || value === 0) return "$0.00";
  const sign = value < 0 ? "-" : "+";
  return `${sign}${fmtCurrency(Math.abs(value))}`;
}

/**
 * PrintableResultsLayout
 *
 * Renders a PDF-ready layout with all required sections in exact order:
 * 1. Header & Summary
 * 2. Total Fee Summary
 * 3. Delta Timeline Visualization
 * 4. Fee Breakdown
 * 5. Explanation of Fee
 * 6. Authority, Basis & Disclaimer
 */
const PrintableResultsLayout = forwardRef<HTMLDivElement, PrintableResultsLayoutProps>(
  function PrintableResultsLayout(
    {
      state,
      programName,
      materialCategory,
      subcategory,
      weightLbs,
      dateGenerated,
      finalPayable,
      baseDues,
      timelineSteps,
      backendTimeline,
      breakdownRows,
      explanationParagraphs,
      authorityText,
      lawReference,
      complianceNotice,
    },
    ref
  ) {
    /**
     * UNIFIED TIMELINE RENDERING
     *
     * Backend is SINGLE SOURCE OF TRUTH:
     * - If backendTimeline is provided, use it directly (preferred path)
     * - Otherwise, fall back to legacy buildTimelineNodes (for backwards compat)
     *
     * This ensures PDF displays IDENTICAL values to on-screen BackendTimeline.
     */
    const timelineNodes = backendTimeline
      ? buildTimelineNodesFromBackend(backendTimeline)
      : buildTimelineNodes(baseDues, timelineSteps, finalPayable);

    const maxAbsDelta = Math.max(
      ...(backendTimeline
        ? backendTimeline.map((s) => Math.abs(s.amount ?? s.rate_delta ?? 0))
        : timelineSteps.map((s) => Math.abs(s.delta))),
      1
    );

    // Log for verification
    if (backendTimeline) {
      console.log("PDF_TIMELINE_RENDER_FROM_BACKEND_ONLY: true");
    }

    return (
      <div ref={ref} className="pdf-layout">
        {/* ============================================
            PAGE 1: HEADER & TITLE
            ============================================ */}
        <div className="pdf-header">
          <div className="pdf-header-content">
            <h1 className="pdf-title">{PDF_TITLE}</h1>
          </div>
          <div className="pdf-logo-container">
            <img
              src="/portco-logo.png"
              alt={PDF_LOGO_ALT}
              className="pdf-logo"
              crossOrigin="anonymous"
            />
          </div>
        </div>

        {/* ============================================
            DISCLAIMER - Immediately under title (per UI layout)
            ============================================ */}
        <div className="pdf-disclaimer-section">
          <div className="pdf-disclaimer-content">
            {PDF_DISCLAIMER_TEXT.split("\n\n").map((para, i) => (
              <p key={i} className={i === 0 ? "pdf-disclaimer-title" : "pdf-disclaimer-text"}>
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* ============================================
            METADATA - State, Program, Material, Weight
            ============================================ */}
        <div className="pdf-meta">
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.state}</span>
            <span className="pdf-meta-value">{state}</span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.program}</span>
            <span className="pdf-meta-value">{programName}</span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.material}</span>
            <span className="pdf-meta-value">
              {materialCategory}
              {subcategory && ` (${subcategory})`}
            </span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.weight}</span>
            <span className="pdf-meta-value">{weightLbs} lbs</span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.generated}</span>
            <span className="pdf-meta-value">{dateGenerated}</span>
          </div>
        </div>

        {/* ============================================
            TOTAL FEE SUMMARY
            ============================================ */}
        <div className="pdf-fee-summary">
          <div className="pdf-fee-summary-label">{PDF_FEE_SUMMARY.label}</div>
          <div className="pdf-fee-summary-value">{fmtCurrency(finalPayable)}</div>
          <div className="pdf-fee-summary-subtitle">
            {PDF_FEE_SUMMARY.subtitle}
          </div>
        </div>

        {/* ============================================
            DELTA TIMELINE VISUALIZATION
            ============================================ */}
        <div className="pdf-timeline-section">
          <div className="pdf-section-title">{PDF_SECTION_TITLES.timeline}</div>
          <div className="pdf-timeline-container">
            <svg
              className="pdf-timeline-svg"
              width="540"
              height="160"
              viewBox="0 0 540 160"
            >
              <defs>
                {/* Simplified gradients for PDF */}
                <linearGradient id="pdfSpine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#00F5FF" stopOpacity="0.8" />
                  <stop offset="0.5" stopColor="#FF4DFF" stopOpacity="0.6" />
                  <stop offset="1" stopColor="#00FF9A" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="pdfReduction" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#00FF9A" />
                  <stop offset="1" stopColor="#00F5FF" />
                </linearGradient>
              </defs>

              {/* Background */}
              <rect x="0" y="0" width="540" height="160" rx="12" fill="#0a0d12" />

              {/* Grid pattern */}
              {Array.from({ length: 27 }).map((_, i) => (
                <line
                  key={`vgrid-${i}`}
                  x1={i * 20}
                  y1="0"
                  x2={i * 20}
                  y2="160"
                  stroke="#ffffff"
                  strokeOpacity="0.03"
                />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <line
                  key={`hgrid-${i}`}
                  x1="0"
                  y1={i * 20}
                  x2="540"
                  y2={i * 20}
                  stroke="#ffffff"
                  strokeOpacity="0.03"
                />
              ))}

              {/* Timeline spine */}
              <line
                x1="50"
                y1="80"
                x2="490"
                y2="80"
                stroke="url(#pdfSpine)"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Render nodes */}
              {timelineNodes.map((node, i) => {
                const nodeCount = timelineNodes.length;
                const spacing = 440 / Math.max(nodeCount - 1, 1);
                const x = 50 + i * spacing;
                const y = 80;

                const isStart = node.type === "start";
                const isFinal = node.type === "final";
                const isDelta = node.type === "delta";

                // Node colors
                let nodeColor = "#00F5FF";
                if (isFinal) nodeColor = "#00FF9A";
                else if (isDelta && node.delta < 0) nodeColor = "#00FF9A";

                const radius = isFinal ? 10 : 7;

                // Delta bar
                let barHeight = 0;
                let barY = y;
                if (isDelta && node.delta !== 0) {
                  barHeight = Math.max(8, (Math.abs(node.delta) / maxAbsDelta) * 35);
                  barY = y + 6;
                }

                return (
                  <g key={node.id}>
                    {/* Delta bar */}
                    {isDelta && node.delta !== 0 && (
                      <rect
                        x={x - 8}
                        y={barY}
                        width={16}
                        height={barHeight}
                        rx="4"
                        fill="url(#pdfReduction)"
                        opacity="0.85"
                      />
                    )}

                    {/* Node circle */}
                    <circle cx={x} cy={y} r={radius} fill={nodeColor} />
                    {isFinal && (
                      <circle cx={x} cy={y} r={radius - 3} fill="#ffffff" opacity="0.4" />
                    )}

                    {/* Label */}
                    <text
                      x={x}
                      y={y - (isDelta && node.delta !== 0 ? 24 : 18)}
                      textAnchor="middle"
                      fill="#EAF3FF"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {node.label}
                    </text>

                    {/* Delta value */}
                    {isDelta && node.delta !== 0 && (
                      <text
                        x={x}
                        y={barY + barHeight + 14}
                        textAnchor="middle"
                        fill="#00FF9A"
                        fontSize="9"
                        fontWeight="700"
                      >
                        {fmtDelta(node.delta)}
                      </text>
                    )}

                    {/* Running value for start/final */}
                    {(isStart || isFinal) && (
                      <text
                        x={x}
                        y={y + 24}
                        textAnchor="middle"
                        fill="#CDE7FF"
                        fontSize="10"
                        fontWeight={isFinal ? "700" : "500"}
                      >
                        {fmtCurrency(node.runningValue)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="pdf-timeline-caption">
            {PDF_TIMELINE.caption}
          </div>
        </div>

        {/* ============================================
            FEE BREAKDOWN TABLE
            ============================================ */}
        <div className="pdf-breakdown-section">
          <div className="pdf-section-title">{PDF_SECTION_TITLES.breakdown}</div>
          <table className="pdf-breakdown-table">
            <tbody>
              {breakdownRows.map((row, i) => (
                <tr key={i} className={`pdf-breakdown-row pdf-breakdown-row--${row.type}`}>
                  <td className="pdf-breakdown-label">{row.label}</td>
                  <td className="pdf-breakdown-value">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ============================================
            EXPLANATION OF FEE
            ============================================ */}
        <div className="pdf-explanation-section">
          <div className="pdf-section-title">{PDF_SECTION_TITLES.explanation}</div>
          <div className="pdf-explanation-content">
            {explanationParagraphs.map((para, i) => (
              <p key={i} className="pdf-explanation-paragraph">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* ============================================
            AUTHORITY, BASIS & DISCLAIMER
            ============================================ */}
        <div className="pdf-authority-section">
          <div className="pdf-section-title">{PDF_SECTION_TITLES.authority}</div>
          <div className="pdf-authority-content">
            <p className="pdf-authority-text">{authorityText}</p>
            <p className="pdf-law-reference">{lawReference}</p>
            {complianceNotice && (
              <p className="pdf-compliance-notice">{complianceNotice}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pdf-footer">
          <div className="pdf-footer-text">
            {buildPDFFooterText(dateGenerated)}
          </div>
        </div>
      </div>
    );
  }
);

/**
 * Build timeline nodes from steps for rendering.
 */
function buildTimelineNodes(
  baseDues: number,
  steps: TimelineStep[],
  finalPayable: number
): Array<{
  id: string;
  label: string;
  type: "start" | "delta" | "final";
  delta: number;
  runningValue: number;
}> {
  const nodes: Array<{
    id: string;
    label: string;
    type: "start" | "delta" | "final";
    delta: number;
    runningValue: number;
  }> = [];

  let running = baseDues;

  // Start node
  nodes.push({
    id: "start",
    label: PDF_TIMELINE.startLabel,
    type: "start",
    delta: 0,
    runningValue: running,
  });

  // Delta nodes
  steps.forEach((step, i) => {
    const safeDelta = Number.isFinite(step.delta) ? step.delta : 0;
    running = Math.max(0, running + safeDelta);
    nodes.push({
      id: `step-${i}`,
      label: step.label,
      type: "delta",
      delta: safeDelta,
      runningValue: running,
    });
  });

  // Final node
  nodes.push({
    id: "final",
    label: PDF_TIMELINE.finalLabel,
    type: "final",
    delta: 0,
    runningValue: finalPayable,
  });

  return nodes;
}

/**
 * Build timeline nodes from backend AdjustmentTimelineStep[].
 *
 * CRITICAL: This function does NOT compute any values.
 * It uses running_total directly from backend - the SINGLE SOURCE OF TRUTH.
 *
 * This ensures PDF displays IDENTICAL values to on-screen BackendTimeline.
 */
function buildTimelineNodesFromBackend(
  backendSteps: AdjustmentTimelineStep[]
): Array<{
  id: string;
  label: string;
  type: "start" | "delta" | "final";
  delta: number;
  runningValue: number;
}> {
  if (!backendSteps || backendSteps.length === 0) {
    return [];
  }

  const nodes: Array<{
    id: string;
    label: string;
    type: "start" | "delta" | "final";
    delta: number;
    runningValue: number;
  }> = [];

  backendSteps.forEach((step, i) => {
    const delta = step.amount ?? step.rate_delta ?? 0;
    const isFinal = step.is_final === true || i === backendSteps.length - 1;
    const isFirst = i === 0;

    // Determine node type based on position and content
    let type: "start" | "delta" | "final";
    if (isFirst && delta === 0) {
      type = "start";
    } else if (isFinal) {
      type = "final";
    } else {
      type = "delta";
    }

    nodes.push({
      id: `step-${step.step}`,
      label: step.label,
      type,
      delta,
      // CRITICAL: Use running_total from backend directly - NO CLIENT-SIDE COMPUTATION
      runningValue: step.running_total,
    });
  });

  // If the last node isn't marked as final but we have a finalPayable,
  // ensure the last node shows the correct final value
  if (nodes.length > 0) {
    const lastNode = nodes[nodes.length - 1];
    if (lastNode.type !== "final") {
      lastNode.type = "final";
    }
    // Use backend running_total, not finalPayable (backend is authoritative)
  }

  return nodes;
}

export default PrintableResultsLayout;
