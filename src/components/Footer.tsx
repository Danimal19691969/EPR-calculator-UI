import { getStateLegal } from "../config/stateLegal";

interface FooterProps {
  state: string;
}

/**
 * Footer Component
 *
 * Renders a state-reactive legal reference footer.
 * Shows the statute and law name for the selected state.
 *
 * Automatically updates when state selection changes.
 */
export default function Footer({ state }: FooterProps) {
  const legal = getStateLegal(state);

  return (
    <div className="estimator-footer">
      {legal.footerText}
    </div>
  );
}
