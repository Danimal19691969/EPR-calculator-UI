/**
 * Timeline Module - Shared Timeline Visualization
 *
 * This module provides the authoritative data model and builder function
 * for timeline visualization, used by BOTH UI and PDF.
 *
 * Exports:
 * - TimelineNode: The shared node data model
 * - TimelineModel: Model containing nodes and metadata
 * - buildTimelineNodesFromBackend: The authoritative builder function
 * - getTimelineNodes: Convenience function for node extraction
 */

export type { TimelineNode, TimelineModel, TimelineNodeRole } from "./TimelineNode";
export { buildTimelineNodesFromBackend, getTimelineNodes } from "./buildTimelineNodesFromBackend";
