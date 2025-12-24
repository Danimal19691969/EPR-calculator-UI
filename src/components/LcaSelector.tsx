import type { LCAOptionType, LCAOption } from "../config/programRules";

interface LcaSelectorProps {
  /** Current LCA selection */
  value: LCAOptionType;
  /** Callback when selection changes */
  onChange: (value: LCAOptionType) => void;
  /** LCA options to display */
  lcaOptions: Record<LCAOptionType, LCAOption>;
  /** Whether 2027 estimate mode is enabled */
  is2027Mode: boolean;
  /** Callback when 2027 mode changes */
  on2027ModeChange: (enabled: boolean) => void;
}

/**
 * LCA Bonus Selection component for Oregon.
 *
 * Implements MUTUALLY EXCLUSIVE radio button selection per Oregon Program Plan p.214:
 * "For each SKU or batch of SKUs, a producer will be eligible for either Bonus A or Bonus B, but not both bonuses."
 *
 * Bonus B is only available in 2027 estimate mode.
 * Bonus C is always disabled (pending amendment).
 */
export default function LcaSelector({
  value,
  onChange,
  lcaOptions,
  is2027Mode,
  on2027ModeChange,
}: LcaSelectorProps) {
  const options: { key: LCAOptionType; option: LCAOption }[] = [
    { key: "none", option: lcaOptions.none },
    { key: "bonusA", option: lcaOptions.bonusA },
    { key: "bonusB", option: lcaOptions.bonusB },
    { key: "bonusC", option: lcaOptions.bonusC },
  ];

  // Determine if an option should be disabled
  function isOptionDisabled(_key: LCAOptionType, option: LCAOption): boolean {
    // Always disabled options (like Bonus C)
    if (option.disabled) return true;
    // Options that require 2027 mode
    if (option.requires2027 && !is2027Mode) return true;
    return false;
  }

  // Handle selection change - if user selects a 2027-only option, auto-deselect when toggling off
  function handleSelectionChange(key: LCAOptionType) {
    onChange(key);
  }

  // Handle 2027 mode toggle
  function handle2027Toggle(enabled: boolean) {
    on2027ModeChange(enabled);
    // If disabling 2027 mode and currently have a 2027-only option selected, reset to none
    if (!enabled && value === "bonusB") {
      onChange("none");
    }
  }

  return (
    <div className="form-group">
      <label className="tier-selector-label">LCA Bonus Selection</label>

      {/* 2027 Estimate Toggle */}
      <div className="lca-year-toggle">
        <label className="lca-year-toggle-label">
          <input
            type="checkbox"
            checked={is2027Mode}
            onChange={(e) => handle2027Toggle(e.target.checked)}
          />
          <span className="lca-year-toggle-text">2027 Estimate</span>
        </label>
        <span className="lca-year-toggle-hint">
          {is2027Mode ? "Showing 2027 fee options" : "Showing 2026 fee options (default)"}
        </span>
      </div>

      <div className="lca-radio-group">
        {options.map(({ key, option }) => {
          const disabled = isOptionDisabled(key, option);
          const showDisabledReason = disabled && option.disabledReason;
          const show2027Hint = option.requires2027 && !is2027Mode;

          return (
            <label
              key={key}
              className={`lca-radio-option ${disabled ? "lca-radio-option-disabled" : ""} ${value === key ? "lca-radio-option-selected" : ""}`}
            >
              <input
                type="radio"
                name="lca-selection"
                value={key}
                checked={value === key}
                onChange={() => handleSelectionChange(key)}
                disabled={disabled}
              />
              <span className="lca-radio-content">
                <span className="lca-radio-label">{option.label}</span>
                {/* Helper text for selected option (e.g., 80% operational fee rule) */}
                {value === key && option.helperText && (
                  <span className="lca-radio-helper-text">
                    {option.helperText}
                  </span>
                )}
                {show2027Hint && (
                  <span className="lca-radio-disabled-reason">
                    {option.disabledReason}
                  </span>
                )}
                {showDisabledReason && !option.requires2027 && (
                  <span className="lca-radio-disabled-reason">
                    {option.disabledReason}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
