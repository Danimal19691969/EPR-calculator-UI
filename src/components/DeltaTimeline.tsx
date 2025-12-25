/**
 * DeltaTimeline Component
 *
 * A horizontal timeline visualization that shows the fee lifecycle from
 * Base Dues to Final Payable through various adjustments (Eco-Modulation,
 * CDPHE bonuses, LCA bonuses, In-Kind credits, etc.).
 *
 * Design: Glass-like panel with horizontal spine and glowing nodes,
 * matching the existing neon/glassmorphism aesthetic.
 *
 * CRITICAL ARCHITECTURE RULE:
 * This component is RENDER-ONLY. It does NOT compute any values.
 * All values (startValue, deltas, finalValue) must be pre-computed
 * by the caller using the same source of truth as the Fee Breakdown.
 *
 * The finalValue parameter is MANDATORY and used verbatim.
 * This component will NEVER sum deltas to derive a final value.
 *
 * Key features:
 * - Horizontal process timeline (not vertical bars)
 * - Nodes placed left → right in application order
 * - Delta bars normalized relative to largest adjustment
 * - Toggle-controlled visibility (hidden by default)
 *
 * Safety: All inputs are sanitized to prevent NaN from appearing in the UI.
 */

import { useMemo } from "react";

export type TimelineStep = {
  /** Short label for the node (e.g., "Eco-Mod", "CDPHE") */
  label: string;
  /** Dollar amount of the adjustment (negative = reduction) */
  delta: number;
  /** Optional description shown below the label */
  sublabel?: string;
};

interface DeltaTimelineProps {
  /** The starting value (Base Dues) - pre-computed, not calculated here */
  startValue: number;
  /** Ordered adjustments applied after startValue - pre-computed deltas */
  steps: TimelineStep[];
  /**
   * MANDATORY: Final payable amount.
   * This component NEVER computes this value - it uses it verbatim.
   * Must come from the same source of truth as the Fee Breakdown.
   */
  finalValue: number;
  /** Currency symbol (default: "$") */
  currency?: string;
}

/**
 * Safely format a number as currency, returning "$0.00" for NaN/Infinity.
 */
function fmtMoney(value: number, currency = "$"): string {
  if (!Number.isFinite(value)) return `${currency}0.00`;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${currency}${abs.toFixed(2)}`;
}

/**
 * Format delta with explicit sign prefix
 */
function fmtDelta(value: number, currency = "$"): string {
  if (!Number.isFinite(value) || value === 0) return `${currency}0.00`;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${fmtMoney(value, currency)}`;
}

export default function DeltaTimeline({
  startValue,
  steps,
  finalValue,
  currency = "$",
}: DeltaTimelineProps) {
  /**
   * Build the visualization model.
   *
   * CRITICAL: This component is RENDER-ONLY.
   * - startValue is used verbatim (sanitized for NaN only)
   * - Each step.delta is used verbatim (sanitized for NaN only)
   * - finalValue is used verbatim - NEVER computed from deltas
   *
   * The runningValue for delta nodes is purely for visual positioning
   * of delta bars, not for deriving the final value.
   */
  const model = useMemo(() => {
    // Sanitize inputs for NaN/Infinity only - no math transformations
    const safeStart = Number.isFinite(startValue) ? startValue : 0;
    const safeFinal = Number.isFinite(finalValue) ? Math.max(0, finalValue) : 0;

    // Build node list: Start → Steps → Final
    const nodes: Array<{
      id: string;
      label: string;
      sublabel?: string;
      type: "start" | "delta" | "final";
      delta: number;
      displayValue: number;
    }> = [];

    // Start node - displays the canonical startValue
    nodes.push({
      id: "start",
      label: "Base Dues",
      sublabel: "Starting reference",
      type: "start",
      delta: 0,
      displayValue: safeStart,
    });

    // Delta nodes - display their deltas only (no running totals computed)
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const safeDelta = Number.isFinite(step.delta) ? step.delta : 0;

      nodes.push({
        id: `step-${i}`,
        label: step.label,
        sublabel: step.sublabel,
        type: "delta",
        delta: safeDelta,
        displayValue: 0, // Delta nodes don't display a running total
      });
    }

    // Final node - displays the canonical finalValue (NEVER computed)
    nodes.push({
      id: "final",
      label: "Final",
      sublabel: "Estimated payable",
      type: "final",
      delta: 0,
      displayValue: safeFinal,
    });

    // Calculate max delta for bar normalization (visual only)
    const deltaNodes = nodes.filter((n) => n.type === "delta");
    const maxAbsDelta = Math.max(
      ...deltaNodes.map((n) => Math.abs(n.delta)),
      1 // Prevent division by zero
    );

    return { nodes, maxAbsDelta, safeStart, safeFinal };
  }, [startValue, steps, finalValue]);

  // Layout constants
  const SVG_WIDTH = 380;
  const SVG_HEIGHT = 180;
  const TIMELINE_Y = 90;
  const NODE_RADIUS = 8;
  const FINAL_NODE_RADIUS = 12;
  const MAX_BAR_HEIGHT = 40;
  const PADDING_X = 40;

  // Calculate node positions
  const nodeCount = model.nodes.length;
  const usableWidth = SVG_WIDTH - PADDING_X * 2;
  const nodeSpacing = usableWidth / Math.max(nodeCount - 1, 1);

  return (
    <div className="delta-timeline">
      <div className="delta-timeline__chrome" />
      <div className="delta-timeline__inner">
        <div className="delta-timeline__header">
          <div className="delta-timeline__title">FEE ADJUSTMENT TIMELINE</div>
          <div className="delta-timeline__readout">
            <div className="delta-timeline__readoutLabel">FINAL</div>
            <div className="delta-timeline__readoutValue">
              {fmtMoney(model.safeFinal, currency)}
            </div>
          </div>
        </div>

        <svg
          className="delta-timeline__svg"
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label="Fee adjustment timeline"
        >
          <defs>
            {/* Glow filter */}
            <filter id="dtGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.85 0
                "
                result="colored"
              />
              <feMerge>
                <feMergeNode in="colored" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Strong glow for final node */}
            <filter id="dtGlowStrong" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 1 0
                "
                result="colored"
              />
              <feMerge>
                <feMergeNode in="colored" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Timeline spine gradient */}
            <linearGradient id="dtSpine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#00F5FF" stopOpacity="0.7" />
              <stop offset="0.5" stopColor="#FF4DFF" stopOpacity="0.5" />
              <stop offset="1" stopColor="#00FF9A" stopOpacity="0.9" />
            </linearGradient>

            {/* Reduction bar gradient (neon green/teal) */}
            <linearGradient id="dtReduction" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#00FF9A" stopOpacity="1" />
              <stop offset="1" stopColor="#00F5FF" stopOpacity="0.85" />
            </linearGradient>

            {/* Increase bar gradient (magenta/orange) */}
            <linearGradient id="dtIncrease" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF4DFF" stopOpacity="1" />
              <stop offset="1" stopColor="#FFB000" stopOpacity="0.9" />
            </linearGradient>

            {/* Glass overlay */}
            <linearGradient id="dtGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.08" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.02" />
            </linearGradient>

            {/* Grid pattern */}
            <pattern
              id="dtGrid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity="0.04"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Background */}
          <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} rx="16" fill="#070A0F" />
          <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} rx="16" fill="url(#dtGlass)" />
          <rect x="10" y="10" width={SVG_WIDTH - 20} height={SVG_HEIGHT - 20} rx="10" fill="url(#dtGrid)" />

          {/* Timeline spine */}
          <line
            x1={PADDING_X}
            y1={TIMELINE_Y}
            x2={SVG_WIDTH - PADDING_X}
            y2={TIMELINE_Y}
            stroke="url(#dtSpine)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#dtGlow)"
          />

          {/* Nodes and delta bars */}
          {model.nodes.map((node, i) => {
            const x = PADDING_X + i * nodeSpacing;
            const isStart = node.type === "start";
            const isFinal = node.type === "final";
            const isDelta = node.type === "delta";

            // Node colors
            let nodeColor = "#00F5FF"; // Cyan for start
            if (isFinal) nodeColor = "#00FF9A"; // Green for final
            else if (isDelta && node.delta < 0) nodeColor = "#00FF9A"; // Green for reductions
            else if (isDelta && node.delta > 0) nodeColor = "#FF4DFF"; // Magenta for increases

            const radius = isFinal ? FINAL_NODE_RADIUS : NODE_RADIUS;
            const glowFilter = isFinal ? "url(#dtGlowStrong)" : "url(#dtGlow)";

            // Delta bar dimensions (only for delta nodes)
            let barHeight = 0;
            let barY = TIMELINE_Y;
            let barGradient = "url(#dtReduction)";

            if (isDelta && node.delta !== 0) {
              const normalizedHeight =
                (Math.abs(node.delta) / model.maxAbsDelta) * MAX_BAR_HEIGHT;
              barHeight = Math.max(6, normalizedHeight);

              if (node.delta < 0) {
                // Reduction: bar extends downward
                barY = TIMELINE_Y + 4;
                barGradient = "url(#dtReduction)";
              } else {
                // Increase: bar extends upward
                barY = TIMELINE_Y - barHeight - 4;
                barGradient = "url(#dtIncrease)";
              }
            }

            return (
              <g key={node.id}>
                {/* Delta bar (only for delta nodes with non-zero delta) */}
                {isDelta && node.delta !== 0 && (
                  <rect
                    x={x - 8}
                    y={barY}
                    width={16}
                    height={barHeight}
                    rx="4"
                    fill={barGradient}
                    filter="url(#dtGlow)"
                    opacity="0.9"
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={x}
                  cy={TIMELINE_Y}
                  r={radius}
                  fill={nodeColor}
                  filter={glowFilter}
                />

                {/* Inner glow for final node */}
                {isFinal && (
                  <circle
                    cx={x}
                    cy={TIMELINE_Y}
                    r={radius - 3}
                    fill="#FFFFFF"
                    opacity="0.3"
                  />
                )}

                {/* Label above node */}
                <text
                  x={x}
                  y={TIMELINE_Y - (isDelta && node.delta !== 0 ? Math.max(barHeight, 20) + 18 : 20)}
                  textAnchor="middle"
                  fill="#EAF3FF"
                  fontSize="10"
                  fontWeight="600"
                  opacity="0.95"
                >
                  {node.label}
                </text>

                {/* Delta value (only for delta nodes) */}
                {isDelta && node.delta !== 0 && (
                  <text
                    x={x}
                    y={node.delta < 0 ? barY + barHeight + 14 : barY - 6}
                    textAnchor="middle"
                    fill={node.delta < 0 ? "#00FF9A" : "#FF4DFF"}
                    fontSize="10"
                    fontWeight="700"
                    opacity="0.95"
                  >
                    {fmtDelta(node.delta, currency)}
                  </text>
                )}

                {/* Display value below timeline (for start and final only) */}
                {(isStart || isFinal) && (
                  <text
                    x={x}
                    y={TIMELINE_Y + 28}
                    textAnchor="middle"
                    fill="#CDE7FF"
                    fontSize="11"
                    fontWeight={isFinal ? "700" : "500"}
                    opacity={isFinal ? "1" : "0.8"}
                  >
                    {fmtMoney(node.displayValue, currency)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Footer note */}
        <div className="delta-timeline__footer">
          Neon timeline view · estimates only
        </div>
      </div>
    </div>
  );
}
