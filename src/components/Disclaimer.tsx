import { AlertTriangle } from "lucide-react";

/**
 * Disclaimer Component
 *
 * Renders a prominent, state-agnostic legal disclaimer with warning styling.
 * Displayed near the top of the calculator, below the header.
 *
 * NOTE: This disclaimer is intentionally state-agnostic and must be
 * identical for all states. Do not add state-specific references.
 */
export default function Disclaimer() {
  return (
    <div className="disclaimer-card">
      <div className="disclaimer-header">
        <AlertTriangle size={16} />
        <span>Disclaimer</span>
      </div>

      <p>
        <b>Disclaimer:</b> This packaging EPR fee estimation tool is provided for general informational purposes only. The estimates this tool generates are non-binding, not an official fee calculation, and the results depend on the accuracy and completeness of User inputs. The tool does not provide legal or compliance advice, and material categories and fee rates are subject to change. User agrees to indemnify, defend, and hold harmless Portco Packaging, its affiliates, and their respective officers, employees, and agents from any claims, losses, liabilities, penalties, enforcement actions, costs, or expenses (including reasonable attorneys’ fees) arising from or related to User’s use of or reliance on the tool.
      </p>

    </div>
  );
}
