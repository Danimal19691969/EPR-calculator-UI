import type { LCAOptionType, LCAOption } from "../config/programRules";

interface LcaSelectorProps {
  /** Current LCA selection */
  value: LCAOptionType;
  /** Callback when selection changes */
  onChange: (value: LCAOptionType) => void;
  /** LCA options to display */
  lcaOptions: Record<LCAOptionType, LCAOption>;
}

/**
 * LCA (Life Cycle Assessment) selection component.
 *
 * Renders radio buttons for LCA participation level.
 * Only rendered when state supports LCA (controlled by parent).
 */
export default function LcaSelector({
  value,
  onChange,
  lcaOptions,
}: LcaSelectorProps) {
  const options: { key: LCAOptionType; option: LCAOption }[] = [
    { key: "none", option: lcaOptions.none },
    { key: "bonusA", option: lcaOptions.bonusA },
    { key: "bonusB", option: lcaOptions.bonusB },
  ];

  return (
    <div className="form-group">
      <label>LCA Status</label>
      <div className="lca-radio-group">
        {options.map(({ key, option }) => (
          <label key={key} className="lca-radio-option">
            <input
              type="radio"
              name="lca-selection"
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
            />
            <span className="lca-radio-label">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
