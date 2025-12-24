import { getStateLegal } from "../config/stateLegal";

interface FooterProps {
  state: string;
}

/**
 * Footer Component
 *
 * Renders a state-reactive legal reference footer with global compliance disclaimer.
 * Shows the statute and law name for the selected state, plus a high-visibility
 * disclaimer about the estimator's informational nature.
 *
 * COMPLIANCE NOTE: The global disclaimer is required to be visible (not hidden)
 * per Colorado Phase 2 compliance requirements.
 */
export default function Footer({ state }: FooterProps) {
  const legal = getStateLegal(state);
  const isColorado = state === "Colorado";

  return (
    <div className="estimator-footer">
      <div className="footer-statute">
        {legal.footerText}
      </div>
      {isColorado && (
        <div className="footer-compliance-notice">
          This estimator references publicly available planning documents,
          including the Colorado Amended Program Plan (June 2025). Final
          compliance obligations, eligibility determinations, and fee
          assessments are issued by CDPHE and the Producer Responsibility
          Organization.
        </div>
      )}
    </div>
  );
}
