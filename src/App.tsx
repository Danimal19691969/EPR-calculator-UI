import { useState, useEffect, useMemo } from "react";
import {
  calculateEPR,
  fetchMaterials,
  fetchOregonGroupedMaterials,
  fetchColoradoPhase2Groups,
  calculateColoradoPhase2,
} from "./services/api";
import type {
  Material,
  CalculateResponse,
  OregonCategory,
  ColoradoPhase2Group,
  ColoradoPhase2CalculateResponse,
} from "./services/api";
import { getStateRules } from "./config/stateRules";
import { getProgramRules } from "./config/programRules";
import type { LCAOptionType } from "./config/programRules";
import FeeBreakdown from "./components/FeeBreakdown";
import FeeExplanation from "./components/FeeExplanation";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import LcaSelector from "./components/LcaSelector";
import ColoradoPhaseSelector, { SHOW_CURRENT_PROGRAM } from "./components/ColoradoPhaseSelector";
import type { ColoradoPhase } from "./components/ColoradoPhaseSelector";
import ColoradoPhase2Breakdown from "./components/ColoradoPhase2Breakdown";
import CdphePerformanceSelector, { cdpheCriteriaToPercent } from "./components/CdphePerformanceSelector";
import type { CdpheCriteria } from "./components/CdphePerformanceSelector";
import EcoModulationSelector, { ecoModulationTierToPercent } from "./components/EcoModulationSelector";
import type { EcoModulationTier } from "./components/EcoModulationSelector";
import InKindAdvertisingCredit, { isInKindEligible } from "./components/InKindAdvertisingCredit";
import "./App.css";

// Default phase based on feature flag
// When SHOW_CURRENT_PROGRAM is false, default to phase2 (2026 Program)
const DEFAULT_COLORADO_PHASE: ColoradoPhase = SHOW_CURRENT_PROGRAM ? "phase1" : "phase2";

export default function App() {
  const [state, setState] = useState("Colorado");
  // Colorado Phase toggle - defaults based on SHOW_CURRENT_PROGRAM flag
  const [coloradoPhase, setColoradoPhase] = useState<ColoradoPhase>(DEFAULT_COLORADO_PHASE);
  // Colorado Phase 1: flat material list
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialCode, setMaterialCode] = useState("");
  // Colorado Phase 2: aggregated groups
  const [phase2Groups, setPhase2Groups] = useState<ColoradoPhase2Group[]>([]);
  const [selectedPhase2Group, setSelectedPhase2Group] = useState("");
  // Colorado Phase 2: compliance-safe tier selectors (replacing free-form inputs)
  const [ecoModulationTier, setEcoModulationTier] = useState<EcoModulationTier>("none");
  // Colorado Phase 2: CDPHE Performance Benchmarks (4 independent benchmarks, each 1%)
  // Note: standardizedSorting is disabled until 2029 per CDPHE Proposed Rule
  const [cdpheCriteria, setCdpheCriteria] = useState<CdpheCriteria>({
    endMarketUtilization: false,
    certifiedCompostable: false,
    innovationCaseStudy: false,
    standardizedSorting: false, // Disabled until 2029
  });
  // Colorado Phase 2: in-kind advertising credit (checkbox + conditional input)
  const [inKindEligible, setInKindEligible] = useState(false);
  const [inKindValue, setInKindValue] = useState(0);
  // Colorado Phase 2: result
  const [phase2Result, setPhase2Result] = useState<ColoradoPhase2CalculateResponse | null>(null);
  // Oregon: grouped categories → subcategories
  const [oregonCategories, setOregonCategories] = useState<OregonCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  // Legacy subcategory (for flat materials with subcategories - not used for Oregon grouped)
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  // Weight is stored as a numeric value. Unit is always LBS for now.
  // Metric support intentionally deferred.
  // Future: Add weightUnit state, use toLbs() before API call.
  // See: src/utils/weight.ts for conversion utilities.
  const [weight, setWeight] = useState(100);
  // LCA selection - explicitly tracked for states that support it (e.g., Oregon)
  const [lcaSelection, setLcaSelection] = useState<LCAOptionType>("none");
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  // Explicit Phase 2 loading state for UX guardrails
  const [phase2GroupsLoading, setPhase2GroupsLoading] = useState(false);

  // Derived values
  const stateRules = getStateRules(state);
  const programRules = getProgramRules(state);
  const isOregon = state === "Oregon";
  const isColorado = state === "Colorado";
  const isColoradoPhase2 = isColorado && coloradoPhase === "phase2";

  // Normalize Phase 2 groups to guarantee array (prevents undefined crashes during async transitions)
  const safePhase2Groups = useMemo(
    () => (Array.isArray(phase2Groups) ? phase2Groups : []),
    [phase2Groups]
  );

  // Phase 2 readiness guard - Estimate button disabled until data is valid
  const canEstimatePhase2 =
    safePhase2Groups.length > 0 &&
    !!selectedPhase2Group &&
    weight > 0;

  // In-Kind Advertising Credit is only available for specific material groups
  const showInKindCredit = isColoradoPhase2 && isInKindEligible(selectedPhase2Group);

  // Colorado: flat material list
  const selectedMaterial = materials.find((m) => m.material_code === materialCode);

  // Oregon: category → subcategory hierarchy
  const selectedCategory = oregonCategories.find((c) => c.category_id === selectedCategoryId);
  const selectedOregonSubcategory = selectedCategory?.subcategories.find(
    (s) => s.id === selectedSubcategoryId
  );

  // Subcategory selector should only appear when:
  // 1. State supports subcategories
  // 2. Selected material has subcategories defined
  // (This is for flat materials with embedded subcategories, NOT Oregon grouped)
  const showSubcategorySelector =
    !isOregon &&
    stateRules.supportsSubcategories &&
    selectedMaterial?.subcategories &&
    selectedMaterial.subcategories.length > 0;

  // Get selected subcategory for display in explanation (flat materials only)
  const selectedSubcategory = selectedMaterial?.subcategories?.find(
    (sub) => sub.subcategory_id === subcategoryId
  );

  // Load materials when state changes
  useEffect(() => {
    let cancelled = false;

    async function loadMaterials() {
      setMaterialsLoading(true);
      setMaterialsError(null);
      // Reset all selection state
      setMaterialCode("");
      setMaterials([]);
      setOregonCategories([]);
      setSelectedCategoryId(null);
      setSelectedSubcategoryId(null);
      setSubcategoryId(null);
      setLcaSelection("none");
      setResult(null);
      setPhase2Result(null);
      setError(null);
      // Reset Phase 2 state when switching states
      setPhase2Groups([]);
      setSelectedPhase2Group("");
      setEcoModulationTier("none");
      setCdpheCriteria({
        endMarketUtilization: false,
        certifiedCompostable: false,
        innovationCaseStudy: false,
        standardizedSorting: false,
      });
      setInKindEligible(false);
      setInKindValue(0);
      // Reset phase to default when switching states
      setColoradoPhase(DEFAULT_COLORADO_PHASE);

      try {
        if (state === "Oregon") {
          // Oregon uses grouped endpoint
          const data = await fetchOregonGroupedMaterials();
          if (!cancelled) {
            setOregonCategories(data.categories);
          }
        } else {
          // Other states use flat material list (Colorado Phase 1)
          const data = await fetchMaterials(state);
          if (!cancelled) {
            setMaterials(data);
            if (data.length > 0) {
              setMaterialCode(data[0].material_code);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setMaterialsError(err.message || "Failed to load materials");
        }
      } finally {
        if (!cancelled) {
          setMaterialsLoading(false);
        }
      }
    }

    loadMaterials();

    return () => {
      cancelled = true;
    };
  }, [state]);

  // Load Phase 2 groups when Colorado Phase 2 is selected
  useEffect(() => {
    if (!isColoradoPhase2) {
      // Reset Phase 2 loading state when not in Phase 2
      setPhase2GroupsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPhase2Groups() {
      setPhase2GroupsLoading(true);
      setMaterialsError(null);
      // Reset Phase 2 selection
      setSelectedPhase2Group("");
      setResult(null);
      setPhase2Result(null);
      setError(null);

      try {
        // Backend returns raw array directly (not wrapped in object)
        const groups = await fetchColoradoPhase2Groups();
        if (!cancelled) {
          setPhase2Groups(groups);
          if (groups.length > 0) {
            setSelectedPhase2Group(groups[0].group_key);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          // User-friendly error message, not technical details
          setMaterialsError("Unable to load Phase 2 material groups. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setPhase2GroupsLoading(false);
        }
      }
    }

    loadPhase2Groups();

    return () => {
      cancelled = true;
    };
  }, [isColoradoPhase2]);

  // Clear In-Kind credit when material group changes to non-eligible
  useEffect(() => {
    if (!showInKindCredit) {
      setInKindEligible(false);
      setInKindValue(0);
    }
  }, [showInKindCredit]);

  // Map UI LCA option type to API LCA selection type (camelCase → snake_case)
  function toLCASelectionType(option: LCAOptionType): string {
    const mapping: Record<LCAOptionType, string> = {
      none: "none",
      bonusA: "bonus_a",
      bonusB: "bonus_b",
    };
    return mapping[option];
  }

  async function handleCalculate() {
    setError(null);

    // Colorado Phase 2 validation and calculation
    if (isColoradoPhase2) {
      if (!selectedPhase2Group) {
        setError("Please select a material group");
        return;
      }
      if (weight <= 0) {
        setError("Weight must be greater than 0");
        return;
      }

      try {
        const res = await calculateColoradoPhase2({
          aggregated_group: selectedPhase2Group,
          weight_lbs: weight,
          pro_modulation_percent: ecoModulationTierToPercent(ecoModulationTier),
          cdphe_bonus_percent: cdpheCriteriaToPercent(cdpheCriteria),
          // Only send in-kind credit if group is eligible AND user claims eligibility
          newspaper_credit: showInKindCredit && inKindEligible ? inKindValue : 0,
        });
        setPhase2Result(res);
        setResult(null); // Clear Phase 1 result
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }

    // Oregon validation: require category + subcategory
    if (isOregon) {
      if (!selectedCategoryId) {
        setError("Please select a category");
        return;
      }
      if (!selectedSubcategoryId) {
        setError("Please select a subcategory");
        return;
      }
    } else {
      // Colorado Phase 1/other states: require material
      if (!materialCode) {
        setError("Please select a material");
        return;
      }
      // Validate subcategory selection for materials that require it
      if (showSubcategorySelector && !subcategoryId) {
        setError("Please select a sub-category for this material");
        return;
      }
    }

    try {
      // API expects weight in pounds. Currently weight is always in LBS.
      // Build payload based on state - Oregon and Colorado have different field requirements
      const res = await calculateEPR(
        isOregon
          ? {
              // Oregon: uses material_category + sub_category
              state,
              material_category: selectedCategoryId!,
              sub_category: selectedSubcategoryId!,
              weight_lbs: weight,
              lca_bonus: toLCASelectionType(lcaSelection),
            }
          : {
              // Colorado Phase 1: uses flat material code
              state,
              material: materialCode,
              weight_lbs: weight,
            }
      );

      setResult(res);
      setPhase2Result(null); // Clear Phase 2 result
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="calculator-shell">
      <header className="calculator-header">
        <img
          src="/portco-logo.png"
          alt="Portco Packaging"
          className="calculator-logo"
        />
        <h1 className="calculator-title">EPR Fee Estimator</h1>
      </header>

      <Disclaimer />

      <div className="calculator-controls">
        <div className="form-group">
          <label htmlFor="state-select">State</label>
          <select
            id="state-select"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="Colorado">Colorado</option>
            <option value="Oregon">Oregon</option>
          </select>
        </div>

        {/* Fee Model with state-specific law reference */}
        <ColoradoPhaseSelector
          value={coloradoPhase}
          onChange={setColoradoPhase}
          state={state}
        />

        {/* Material selection: Oregon uses category/subcategory, Colorado Phase 2 uses groups, others use flat material */}
        {isOregon ? (
          <>
            {/* Oregon Category Selection - Dropdown */}
            <div className="form-group">
              <label htmlFor="oregon-category-select">Select Category</label>
              {materialsLoading ? (
                <div className="form-status">Loading...</div>
              ) : materialsError ? (
                <div className="form-error">{materialsError}</div>
              ) : oregonCategories.length === 0 ? (
                <div className="form-status">No categories available</div>
              ) : (
                <select
                  id="oregon-category-select"
                  value={selectedCategoryId ?? ""}
                  onChange={(e) => {
                    const value = e.target.value || null;
                    setSelectedCategoryId(value);
                    setSelectedSubcategoryId(null); // Reset subcategory when category changes
                  }}
                >
                  <option value="">Select a category</option>
                  {oregonCategories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Oregon Subcategory Selection - Dropdown (only shown after category is selected) */}
            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <div className="form-group">
                <label htmlFor="oregon-subcategory-select">Select Subcategory</label>
                <select
                  id="oregon-subcategory-select"
                  value={selectedSubcategoryId ?? ""}
                  onChange={(e) => setSelectedSubcategoryId(e.target.value || null)}
                >
                  <option value="">Select a subcategory</option>
                  {selectedCategory.subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : isColoradoPhase2 ? (
          <>
            {/* Colorado Phase 2: Aggregated Group Selection */}
            <div className="form-group">
              <label htmlFor="phase2-group-select">Select Material Group</label>
              {phase2GroupsLoading ? (
                <div className="form-status">Loading Colorado Phase 2 material groups…</div>
              ) : materialsError ? (
                <div className="form-error">{materialsError}</div>
              ) : safePhase2Groups.length === 0 ? (
                <div className="form-status">Loading Colorado Phase 2 material groups…</div>
              ) : (
                <select
                  id="phase2-group-select"
                  value={selectedPhase2Group}
                  onChange={(e) => setSelectedPhase2Group(e.target.value)}
                >
                  {safePhase2Groups.map((g) => (
                    <option key={g.group_key} value={g.group_key}>
                      {g.group_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Colorado Phase 2: Eco-Modulation Tier Selector */}
            <EcoModulationSelector
              value={ecoModulationTier}
              onChange={setEcoModulationTier}
            />

            {/* Colorado Phase 2: CDPHE Performance Criteria Selector */}
            <CdphePerformanceSelector
              value={cdpheCriteria}
              onChange={setCdpheCriteria}
            />

            {/* Colorado Phase 2: In-Kind Advertising Credit */}
            {showInKindCredit ? (
              <InKindAdvertisingCredit
                eligible={inKindEligible}
                onEligibleChange={setInKindEligible}
                value={inKindValue}
                onValueChange={setInKindValue}
              />
            ) : (
              <div className="form-group form-group-disabled">
                <label className="checkbox-label checkbox-label-disabled">
                  <input type="checkbox" disabled />
                  <span className="checkbox-label-text">In-Kind Advertising Credit</span>
                </label>
                <div className="form-hint form-hint-muted">
                  In-kind advertising credits apply only to newspaper and magazine materials under the Colorado Program Plan.
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Colorado Phase 1/Other states: flat material dropdown */}
            <div className="form-group">
              <label htmlFor="material-select">Select Material Type</label>
              {materialsLoading ? (
                <div className="form-status">Loading...</div>
              ) : materialsError ? (
                <div className="form-error">{materialsError}</div>
              ) : materials.length === 0 ? (
                <div className="form-status">No materials available</div>
              ) : (
                <select
                  id="material-select"
                  value={materialCode}
                  onChange={(e) => {
                    setMaterialCode(e.target.value);
                    setSubcategoryId(null); // Reset subcategory when material changes
                  }}
                >
                  {materials.map((m) => (
                    <option key={m.material_code} value={m.material_code}>
                      {m.material_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sub-category selector - only shown when state supports subcategories AND material has subcategories */}
            {showSubcategorySelector && selectedMaterial?.subcategories && (
              <div className="form-group">
                <label htmlFor="subcategory-select">Sub-Category</label>
                <select
                  id="subcategory-select"
                  value={subcategoryId ?? ""}
                  onChange={(e) => setSubcategoryId(e.target.value || null)}
                >
                  <option value="">Select a sub-category</option>
                  {selectedMaterial.subcategories.map((sub) => (
                    <option key={sub.subcategory_id} value={sub.subcategory_id}>
                      {sub.subcategory_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div className="form-group">
          <label htmlFor="weight-input">Weight (lbs)</label>
          <div className="number-field">
            <input
              id="weight-input"
              type="number"
              inputMode="numeric"
              className="number-input"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              min={0}
            />
            <div className="number-stepper" aria-hidden="false">
              <button
                type="button"
                className="step-btn step-up"
                aria-label="Increase weight"
                onClick={() => setWeight(Math.max(0, weight + 1))}
              >
                ▲
              </button>
              <button
                type="button"
                className="step-btn step-down"
                aria-label="Decrease weight"
                onClick={() => setWeight(Math.max(0, weight - 1))}
              >
                ▼
              </button>
            </div>
          </div>
        </div>

        {/* LCA Selection - only shown for states that support it */}
        {stateRules.supportsLCA && programRules.lcaOptions && (
          <LcaSelector
            value={lcaSelection}
            onChange={setLcaSelection}
            lcaOptions={programRules.lcaOptions}
          />
        )}

        <button
          onClick={handleCalculate}
          disabled={isColoradoPhase2 && !canEstimatePhase2}
        >
          Estimate
        </button>

        {error && <div className="form-error">{error}</div>}

        {/* Colorado Phase 2 uses its own breakdown component */}
        {isColoradoPhase2 ? (
          <ColoradoPhase2Breakdown
            result={phase2Result}
            groupName={
              safePhase2Groups.length > 0 && selectedPhase2Group
                ? safePhase2Groups.find((g) => g.group_key === selectedPhase2Group)?.group_name
                : undefined
            }
          />
        ) : (
          <>
            <FeeBreakdown
              result={result}
              baseRate={isOregon ? selectedOregonSubcategory?.rate : selectedMaterial?.net_effective_rate_lbs}
              stateRules={stateRules}
            />

            {result && (isOregon ? selectedOregonSubcategory : selectedMaterial) && (
              <FeeExplanation
                state={state}
                materialLabel={isOregon ? (selectedCategory?.category_name ?? "") : selectedMaterial!.material_name}
                subcategoryLabel={isOregon ? selectedOregonSubcategory?.display_name : selectedSubcategory?.subcategory_name}
                weightLbs={result.weight_lbs}
                baseRate={isOregon ? (selectedOregonSubcategory?.rate ?? 0) : selectedMaterial!.net_effective_rate_lbs}
                initialFee={result.initial_fee}
                netFee={result.total_fee}
                lcaSelection={lcaSelection}
                lcaAdjustmentAmount={result.lca_bonus.amount}
                programRules={programRules}
                stateRules={stateRules}
              />
            )}
          </>
        )}
      </div>

      <Footer state={state} />
    </div>
  );
}
