/**
 * TimelineNode - Shared Data Model for Timeline Visualization
 *
 * SINGLE SOURCE OF TRUTH: This interface defines the authoritative structure
 * for timeline nodes used by BOTH the UI (BackendTimeline) and PDF
 * (PrintableResultsLayoutV2).
 *
 * CRITICAL INVARIANTS:
 * 1. Both UI and PDF MUST use this exact data model
 * 2. All values come directly from backend - NO client-side computation
 * 3. Labels for start/final nodes use PDF_TIMELINE constants
 * 4. Delta nodes use backend-provided labels
 *
 * Node Structure (matching PDF exactly):
 * - Start: First node, shows base dues, label from PDF_TIMELINE.startLabel
 * - Delta: Middle nodes, show adjustments, labels from backend steps
 * - Final: Last node, shows final payable, label from PDF_TIMELINE.finalLabel
 */

/**
 * Visual role of a timeline node.
 * Determines rendering behavior (colors, sizes, displayed values).
 */
export type TimelineNodeRole = "start" | "delta" | "final";

/**
 * TimelineNode - The authoritative node model.
 *
 * Used by BOTH UI and PDF timeline renderers.
 * All display values are pre-formatted strings.
 */
export interface TimelineNode {
  /** Unique identifier for React key */
  id: string;

  /** Display label for the node */
  label: string;

  /** Optional sublabel/description */
  sublabel?: string;

  /** Node's visual role - determines rendering style */
  role: TimelineNodeRole;

  /**
   * Delta amount (negative = reduction, positive = increase).
   * Only meaningful for "delta" role nodes.
   * Comes directly from backend step.amount or step.rate_delta.
   */
  delta: number;

  /**
   * Running total from backend.
   * Used verbatim - NO client-side computation.
   * Comes directly from backend step.running_total.
   */
  runningTotal: number;

  /**
   * Pre-formatted delta display string (e.g., "-$1.56").
   * Only set for "delta" role nodes.
   */
  deltaDisplay?: string;

  /**
   * Pre-formatted value display string (e.g., "$15.60").
   * Set for "start" and "final" role nodes.
   */
  valueDisplay: string;

  /**
   * Whether this is the final node.
   * Determines visual emphasis (larger radius, glow effect).
   */
  isFinal: boolean;
}

/**
 * Timeline model containing all nodes and metadata.
 * Used by timeline renderers for layout calculations.
 */
export interface TimelineModel {
  /** All timeline nodes in display order */
  nodes: TimelineNode[];

  /** Maximum absolute delta for bar height normalization */
  maxAbsDelta: number;

  /** Start value (base dues) */
  startValue: number;

  /** Final value (final payable) */
  finalValue: number;
}
