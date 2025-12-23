import { useState, useEffect } from "react";
import { calculateEPR, fetchMaterials, fetchOregonGroupedMaterials } from "./services/api";
import type {
  Material,
  CalculateResponse,
  LCASelectionType,
  OregonCategory,
} from "./services/api";
import { getStateRules } from "./config/stateRules";
import { getProgramRules } from "./config/programRules";
import type { LCAOptionType } from "./config/programRules";
import FeeBreakdown from "./components/FeeBreakdown";
import FeeExplanation from "./components/FeeExplanation";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import LcaSelector from "./components/LcaSelector";
import "./App.css";

export default function App() {
  const [state, setState] = useState("Colorado");
  // Colorado: flat material list
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialCode, setMaterialCode] = useState("");
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

  // Derived values
  const stateRules = getStateRules(state);
  const programRules = getProgramRules(state);
  const isOregon = state === "Oregon";

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
      setError(null);

      try {
        if (state === "Oregon") {
          // Oregon uses grouped endpoint
          const data = await fetchOregonGroupedMaterials();
          if (!cancelled) {
            setOregonCategories(data.categories);
          }
        } else {
          // Other states use flat material list
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

  // Map UI LCA option type to API LCA selection type (camelCase → snake_case)
  function toLCASelectionType(option: LCAOptionType): LCASelectionType {
    const mapping: Record<LCAOptionType, LCASelectionType> = {
      none: "none",
      bonusA: "bonus_a",
      bonusB: "bonus_b",
    };
    return mapping[option];
  }

  async function handleCalculate() {
    setError(null);

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
      // Colorado/other states: require material
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
      // Future: If user selects KG, convert here: toLbs(createWeight(weight, weightUnit))
      const res = await calculateEPR({
        state,
        // Oregon uses subcategory_id as the material identifier
        material: isOregon ? (selectedSubcategoryId ?? "") : materialCode,
        weight_lbs: weight,
        // Oregon-specific fields - only included when state supports them
        ...(isOregon && selectedSubcategoryId
          ? { subcategory_id: selectedSubcategoryId }
          : stateRules.supportsSubcategories && subcategoryId
            ? { subcategory_id: subcategoryId }
            : {}),
        ...(stateRules.supportsLCA
          ? { lca_selection: toLCASelectionType(lcaSelection) }
          : {}),
      });

      setResult(res);
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

      <Disclaimer state={state} />

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

        {/* Material selection: Oregon uses category/subcategory dropdowns, others use flat material dropdown */}
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
        ) : (
          <>
            {/* Colorado/Other states: flat material dropdown */}
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

        <button onClick={handleCalculate}>Estimate</button>

        {error && <div className="form-error">{error}</div>}

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
      </div>

      <Footer state={state} />
    </div>
  );
}
