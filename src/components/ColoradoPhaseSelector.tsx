/**
 * ColoradoPhaseSelector Component
 *
 * Displays the Fee Model information with state-specific law references.
 * When SHOW_CURRENT_PROGRAM is false, shows an informational label (not a selector).
 *
 * FEATURE FLAG: SHOW_CURRENT_PROGRAM
 * When false, the Current Program option is hidden and only 2026 Program is shown.
 * All underlying logic for Current Program is preserved for future use.
 *
 * LAW REFERENCES (verbatim, do not modify):
 * - Colorado: "Producer Responsibility Program for Statewide Recycling Act"
 * - Oregon: "Oregon SB 582 – Plastic Pollution and Recycling Modernization Act"
 */

// CURRENT PROGRAM selector intentionally hidden.
// Retained for future comparison, historical modeling, or internal use.
// Set to true to re-enable the Current Program option in the UI.
export const SHOW_CURRENT_PROGRAM = false;

export type ColoradoPhase = "phase1" | "phase2";

interface ColoradoPhaseSelectorProps {
  value: ColoradoPhase;
  onChange: (phase: ColoradoPhase) => void;
  state: string;
}

/**
 * Returns the verbatim law reference for the given state.
 * DO NOT modify these strings - they are exact statutory names.
 */
function getStateLawReference(state: string): string {
  if (state === "Colorado") {
    return "Producer Responsibility Program for Statewide Recycling Act";
  }
  if (state === "Oregon") {
    return "Oregon SB 582 – Plastic Pollution and Recycling Modernization Act";
  }
  return "";
}

export default function ColoradoPhaseSelector({
  value,
  onChange,
  state,
}: ColoradoPhaseSelectorProps) {
  const lawReference = getStateLawReference(state);

  // When Current Program is hidden, render as informational label (not a selector)
  // The 2026 Program is the only option and is auto-selected via App.tsx
  if (!SHOW_CURRENT_PROGRAM) {
    return (
      <div className="form-group">
        <label className="phase-selector-label">Fee Model</label>
        <div className="phase-info-container">
          <span className="phase-info-label">2026 Program (HB22-1355)</span>
          {lawReference && (
            <span className="phase-law-reference">{lawReference}</span>
          )}
        </div>
      </div>
    );
  }

  // Full selector with both options (when SHOW_CURRENT_PROGRAM === true)
  return (
    <div className="form-group">
      <label className="phase-selector-label">Fee Model</label>
      <div className="phase-selector">
        <label className={`phase-option ${value === "phase1" ? "selected" : ""}`}>
          <input
            type="radio"
            name="colorado-phase"
            value="phase1"
            checked={value === "phase1"}
            onChange={() => onChange("phase1")}
          />
          <span className="phase-option-label">Current Program</span>
        </label>
        <label className={`phase-option ${value === "phase2" ? "selected" : ""}`}>
          <input
            type="radio"
            name="colorado-phase"
            value="phase2"
            checked={value === "phase2"}
            onChange={() => onChange("phase2")}
          />
          <span className="phase-option-label">2026 Program (HB22-1355)</span>
        </label>
      </div>
      {lawReference && (
        <span className="phase-law-reference">{lawReference}</span>
      )}
    </div>
  );
}
