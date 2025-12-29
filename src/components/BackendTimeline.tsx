/**
 * BackendTimeline Component
 *
 * Renders the fee adjustment timeline using ONLY backend-provided data.
 * This component is a pure renderer - it does NOT compute or derive any values.
 *
 * The backend's `adjustment_timeline` field is the SINGLE SOURCE OF TRUTH.
 *
 * CRITICAL ARCHITECTURE RULES:
 * 1. DO NOT recompute or derive timeline steps in this component
 * 2. DO NOT gate rendering by state (Oregon vs Colorado)
 * 3. DO NOT gate rendering by phase
 * 4. DO NOT infer adjustments from other fields
 * 5. ONLY render what the backend provides
 */

import { useMemo } from "react";
import type { AdjustmentTimelineStep } from "../services/api";

interface BackendTimelineProps {
  /** Backend-provided timeline steps - rendered verbatim */
  steps: AdjustmentTimelineStep[];
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
  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${currency}${Math.abs(value).toFixed(2)}`;
}

export default function BackendTimeline({
  steps,
  currency = "$",
}: BackendTimelineProps) {
  /**
   * Build the visualization model from backend data.
   * No client-side computation - just formatting for display.
   */
  const model = useMemo(() => {
    if (!steps || steps.length === 0) {
      return null;
    }

    // Find the starting value (first step's running_total before adjustments)
    // and the final value (last step with is_final or the last running_total)
    const firstStep = steps[0];
    const lastStep = steps[steps.length - 1];

    // Start value: first step's running_total (represents base before adjustments)
    // OR we can infer from first step if it has amount
    const startValue = firstStep.running_total;

    // Final value: last step's running_total
    const finalValue = lastStep.running_total;

    // Calculate max delta for bar normalization
    const maxAbsDelta = Math.max(
      ...steps.map((s) => Math.abs(s.amount ?? s.rate_delta ?? 0)),
      1 // Prevent division by zero
    );

    return {
      steps,
      startValue,
      finalValue,
      maxAbsDelta,
    };
  }, [steps]);

  if (!model) {
    return null;
  }

  // Layout constants
  const SVG_WIDTH = 380;
  const SVG_HEIGHT = 180;
  const TIMELINE_Y = 90;
  const NODE_RADIUS = 8;
  const FINAL_NODE_RADIUS = 12;
  const MAX_BAR_HEIGHT = 40;
  const PADDING_X = 40;

  // Build node list: each step becomes a node
  const nodes = model.steps.map((step, i) => {
    const delta = step.amount ?? step.rate_delta ?? 0;
    const isFinal = step.is_final === true || i === model.steps.length - 1;

    return {
      id: `step-${step.step}`,
      label: step.label,
      sublabel: step.description,
      delta,
      runningTotal: step.running_total,
      isFinal,
      isFirst: i === 0,
    };
  });

  // Calculate node positions
  const nodeCount = nodes.length;
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
              {fmtMoney(model.finalValue, currency)}
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
            <filter id="btGlow" x="-60%" y="-60%" width="220%" height="220%">
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
            <filter id="btGlowStrong" x="-80%" y="-80%" width="260%" height="260%">
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
            <linearGradient id="btSpine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#00F5FF" stopOpacity="0.7" />
              <stop offset="0.5" stopColor="#FF4DFF" stopOpacity="0.5" />
              <stop offset="1" stopColor="#00FF9A" stopOpacity="0.9" />
            </linearGradient>

            {/* Reduction bar gradient (neon green/teal) */}
            <linearGradient id="btReduction" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#00FF9A" stopOpacity="1" />
              <stop offset="1" stopColor="#00F5FF" stopOpacity="0.85" />
            </linearGradient>

            {/* Increase bar gradient (magenta/orange) */}
            <linearGradient id="btIncrease" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF4DFF" stopOpacity="1" />
              <stop offset="1" stopColor="#FFB000" stopOpacity="0.9" />
            </linearGradient>

            {/* Glass overlay */}
            <linearGradient id="btGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.08" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.02" />
            </linearGradient>

            {/* Grid pattern */}
            <pattern
              id="btGrid"
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
          <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} rx="16" fill="url(#btGlass)" />
          <rect x="10" y="10" width={SVG_WIDTH - 20} height={SVG_HEIGHT - 20} rx="10" fill="url(#btGrid)" />

          {/* Timeline spine */}
          <line
            x1={PADDING_X}
            y1={TIMELINE_Y}
            x2={SVG_WIDTH - PADDING_X}
            y2={TIMELINE_Y}
            stroke="url(#btSpine)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#btGlow)"
          />

          {/* Nodes and delta bars */}
          {nodes.map((node, i) => {
            const x = PADDING_X + i * nodeSpacing;
            const hasDelta = node.delta !== 0;
            const isReduction = node.delta < 0;

            // Node colors
            let nodeColor = "#00F5FF"; // Cyan default
            if (node.isFinal) nodeColor = "#00FF9A"; // Green for final
            else if (node.isFirst) nodeColor = "#00F5FF"; // Cyan for first
            else if (isReduction) nodeColor = "#00FF9A"; // Green for reductions
            else if (hasDelta) nodeColor = "#FF4DFF"; // Magenta for increases

            const radius = node.isFinal ? FINAL_NODE_RADIUS : NODE_RADIUS;
            const glowFilter = node.isFinal ? "url(#btGlowStrong)" : "url(#btGlow)";

            // Delta bar dimensions
            let barHeight = 0;
            let barY = TIMELINE_Y;
            let barGradient = "url(#btReduction)";

            if (hasDelta) {
              const normalizedHeight =
                (Math.abs(node.delta) / model.maxAbsDelta) * MAX_BAR_HEIGHT;
              barHeight = Math.max(6, normalizedHeight);

              if (isReduction) {
                // Reduction: bar extends downward
                barY = TIMELINE_Y + 4;
                barGradient = "url(#btReduction)";
              } else {
                // Increase: bar extends upward
                barY = TIMELINE_Y - barHeight - 4;
                barGradient = "url(#btIncrease)";
              }
            }

            return (
              <g key={node.id}>
                {/* Delta bar (only for nodes with non-zero delta) */}
                {hasDelta && (
                  <rect
                    x={x - 8}
                    y={barY}
                    width={16}
                    height={barHeight}
                    rx="4"
                    fill={barGradient}
                    filter="url(#btGlow)"
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
                {node.isFinal && (
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
                  y={TIMELINE_Y - (hasDelta ? Math.max(barHeight, 20) + 18 : 20)}
                  textAnchor="middle"
                  fill="#EAF3FF"
                  fontSize="10"
                  fontWeight="600"
                  opacity="0.95"
                >
                  {node.label}
                </text>

                {/* Delta value (only for nodes with delta) */}
                {hasDelta && (
                  <text
                    x={x}
                    y={isReduction ? barY + barHeight + 14 : barY - 6}
                    textAnchor="middle"
                    fill={isReduction ? "#00FF9A" : "#FF4DFF"}
                    fontSize="10"
                    fontWeight="700"
                    opacity="0.95"
                  >
                    {fmtDelta(node.delta, currency)}
                  </text>
                )}

                {/* Running total below timeline (for first and final only) */}
                {(node.isFirst || node.isFinal) && (
                  <text
                    x={x}
                    y={TIMELINE_Y + 28}
                    textAnchor="middle"
                    fill="#CDE7FF"
                    fontSize="11"
                    fontWeight={node.isFinal ? "700" : "500"}
                    opacity={node.isFinal ? "1" : "0.8"}
                  >
                    {fmtMoney(node.runningTotal, currency)}
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
