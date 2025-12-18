import { AlertTriangle } from "lucide-react";
import { getStateLegal } from "../config/stateLegal";

interface DisclaimerProps {
  state: string;
}

/**
 * Disclaimer Component
 *
 * Renders a prominent, state-aware legal disclaimer with warning styling.
 * Displayed near the top of the calculator, below the header.
 *
 * The disclaimer references the correct statute for the selected state.
 */
export default function Disclaimer({ state }: DisclaimerProps) {
  const legal = getStateLegal(state);

  return (
    <div className="disclaimer-card">
      <div className="disclaimer-header">
        <AlertTriangle size={16} />
        <span>Disclaimer</span>
      </div>

      <p>
        This packaging EPR fee estimator provides estimates for general
        informational purposes only and is not an official fee calculation.
        This tool does not constitute legal or compliance advice. Material
        categories and fee rates are subject to change.
      </p>

      <p>
        Producers must consult with compliance professionals, the state agency,
        and/or the applicable producer responsibility organization to confirm
        their compliance obligation and total fees under{" "}
        <strong>
          {legal.statuteReference} – {legal.lawName}
        </strong>
        .
      </p>
    </div>
  );
}
