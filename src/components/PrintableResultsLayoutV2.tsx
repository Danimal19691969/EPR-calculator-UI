/**
 * PrintableResultsLayout V2 Component
 *
 * SNAPSHOT-BASED PDF RENDERING
 *
 * This component renders a PDF from a PdfSnapshot object.
 * It has NO formatting functions, NO calculations, NO business logic.
 *
 * ALL values in the snapshot are PRE-FORMATTED strings from the UI.
 * This component simply displays them.
 *
 * CRITICAL INVARIANT:
 * This component MUST NOT:
 * - Format any numbers
 * - Calculate any values
 * - Apply any business logic
 * - Modify any labels or text
 *
 * If you need to change what appears in the PDF, you MUST change
 * the snapshot builder (buildColoradoPhase2Snapshot.ts), NOT this component.
 */

import { forwardRef } from "react";
import type { PdfSnapshot } from "../pdf/PdfSnapshot";
import {
  PDF_LOGO_ALT,
  PDF_META_LABELS,
  PDF_SECTION_TITLES,
  PDF_TIMELINE,
  buildPDFFooterText,
} from "../pdf/labels";

export interface PrintableResultsLayoutV2Props {
  /** The complete PDF snapshot - all data pre-formatted from UI */
  snapshot: PdfSnapshot;
}

/**
 * PrintableResultsLayout V2
 *
 * Renders a PDF-ready layout from a PdfSnapshot.
 * No calculations, no formatting - just display.
 */
const PrintableResultsLayoutV2 = forwardRef<HTMLDivElement, PrintableResultsLayoutV2Props>(
  function PrintableResultsLayoutV2({ snapshot }, ref) {
    const { header, metadata, summary, breakdownRows, timeline, explanationParagraphs, authority } = snapshot;

    // Build timeline nodes for SVG rendering
    const timelineNodes = buildTimelineNodes(timeline);
    const maxAbsDelta = Math.max(
      ...timeline.steps.map((s) => Math.abs(s.deltaMagnitude)),
      1
    );

    return (
      <div ref={ref} className="pdf-layout">
        {/* ============================================
            PAGE 1: HEADER & TITLE
            ============================================ */}
        <div className="pdf-header">
          <div className="pdf-header-content">
            <h1 className="pdf-title">{header.title}</h1>
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
            {header.disclaimer.split("\n\n").map((para, i) => (
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
            <span className="pdf-meta-value">{metadata.state}</span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.program}</span>
            <span className="pdf-meta-value">{metadata.programName}</span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.material}</span>
            <span className="pdf-meta-value">
              {metadata.materialCategory}
              {metadata.subcategory && ` (${metadata.subcategory})`}
            </span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.weight}</span>
            <span className="pdf-meta-value">{metadata.weightDisplay}</span>
          </div>
          <div className="pdf-meta-row">
            <span className="pdf-meta-label">{PDF_META_LABELS.generated}</span>
            <span className="pdf-meta-value">{metadata.dateGenerated}</span>
          </div>
        </div>

        {/* ============================================
            TOTAL FEE SUMMARY - EXACT UI values
            ============================================ */}
        <div className="pdf-fee-summary">
          <div className="pdf-fee-summary-label">{summary.title}</div>
          <div className="pdf-fee-summary-value">{summary.amount}</div>
          {summary.scenarioLabel && (
            <div className="pdf-fee-summary-subtitle">{summary.scenarioLabel}</div>
          )}
        </div>

        {/* ============================================
            DELTA TIMELINE VISUALIZATION
            ============================================ */}
        {timeline.steps.length > 0 && (
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
                  else if (isDelta && node.deltaMagnitude > 0) nodeColor = "#00FF9A";

                  const radius = isFinal ? 10 : 7;

                  // Delta bar
                  let barHeight = 0;
                  let barY = y;
                  if (isDelta && node.deltaMagnitude !== 0) {
                    barHeight = Math.max(8, (Math.abs(node.deltaMagnitude) / maxAbsDelta) * 35);
                    barY = y + 6;
                  }

                  return (
                    <g key={node.id}>
                      {/* Delta bar */}
                      {isDelta && node.deltaMagnitude !== 0 && (
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
                        y={y - (isDelta && node.deltaMagnitude !== 0 ? 24 : 18)}
                        textAnchor="middle"
                        fill="#EAF3FF"
                        fontSize="10"
                        fontWeight="600"
                      >
                        {node.label}
                      </text>

                      {/* Delta value - PRE-FORMATTED from snapshot */}
                      {isDelta && node.deltaDisplay && (
                        <text
                          x={x}
                          y={barY + barHeight + 14}
                          textAnchor="middle"
                          fill="#00FF9A"
                          fontSize="9"
                          fontWeight="700"
                        >
                          {node.deltaDisplay}
                        </text>
                      )}

                      {/* Running value for start/final - PRE-FORMATTED from snapshot */}
                      {(isStart || isFinal) && (
                        <text
                          x={x}
                          y={y + 24}
                          textAnchor="middle"
                          fill="#CDE7FF"
                          fontSize="10"
                          fontWeight={isFinal ? "700" : "500"}
                        >
                          {node.valueDisplay}
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
        )}

        {/* ============================================
            FEE BREAKDOWN TABLE - EXACT UI values
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
            EXPLANATION OF FEE - EXACT UI text
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
            <p className="pdf-authority-text">{authority.text}</p>
            <p className="pdf-law-reference">{authority.lawReference}</p>
            {authority.complianceNotice && (
              <p className="pdf-compliance-notice">{authority.complianceNotice}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pdf-footer">
          <div className="pdf-footer-text">
            {buildPDFFooterText(metadata.dateGenerated)}
          </div>
        </div>
      </div>
    );
  }
);

/**
 * Timeline node for SVG rendering.
 * All display values are PRE-FORMATTED from the snapshot.
 */
interface TimelineNode {
  id: string;
  label: string;
  type: "start" | "delta" | "final";
  deltaDisplay?: string;
  deltaMagnitude: number;
  valueDisplay: string;
}

/**
 * Build timeline nodes from snapshot timeline data.
 * NO formatting happens here - all values come from snapshot.
 */
function buildTimelineNodes(timeline: PdfSnapshot["timeline"]): TimelineNode[] {
  const nodes: TimelineNode[] = [];

  // Start node
  nodes.push({
    id: "start",
    label: PDF_TIMELINE.startLabel,
    type: "start",
    deltaMagnitude: 0,
    valueDisplay: timeline.startValueDisplay,
  });

  // Delta nodes from snapshot steps
  timeline.steps.forEach((step, i) => {
    nodes.push({
      id: `step-${i}`,
      label: step.label,
      type: "delta",
      deltaDisplay: step.deltaDisplay,
      deltaMagnitude: step.deltaMagnitude,
      valueDisplay: "",
    });
  });

  // Final node
  nodes.push({
    id: "final",
    label: PDF_TIMELINE.finalLabel,
    type: "final",
    deltaMagnitude: 0,
    valueDisplay: timeline.finalValueDisplay,
  });

  return nodes;
}

export default PrintableResultsLayoutV2;
