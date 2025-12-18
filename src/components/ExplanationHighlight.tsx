/**
 * ExplanationHighlight
 *
 * Inline component for visually emphasizing key variables within
 * fee explanation text. Used for material names, weights, rates,
 * fees, and other calculated/selected values.
 *
 * Styled to be subtle and readable — not flashy or marketing-like.
 */

interface ExplanationHighlightProps {
  children: React.ReactNode;
}

export function ExplanationHighlight({ children }: ExplanationHighlightProps) {
  return <span className="explanation-highlight">{children}</span>;
}
