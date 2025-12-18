import { useState, useEffect } from "react";
import { calculateEPR, fetchMaterials } from "./services/api";
import type { Material, CalculateResponse } from "./services/api";
import { getStateRules } from "./config/stateRules";
import { getProgramRules } from "./config/programRules";
import type { LCAOptionType } from "./config/programRules";
import FeeBreakdown from "./components/FeeBreakdown";
import FeeExplanation from "./components/FeeExplanation";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import "./App.css";

export default function App() {
  const [state, setState] = useState("Colorado");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialCode, setMaterialCode] = useState("");
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
  const selectedMaterial = materials.find((m) => m.material_code === materialCode);

  useEffect(() => {
    let cancelled = false;

    async function loadMaterials() {
      setMaterialsLoading(true);
      setMaterialsError(null);
      setMaterialCode("");
      setMaterials([]);
      setLcaSelection("none"); // Reset LCA selection when state changes

      try {
        const data = await fetchMaterials(state);
        if (!cancelled) {
          setMaterials(data);
          if (data.length > 0) {
            setMaterialCode(data[0].material_code);
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

  async function handleCalculate() {
    setError(null);
    if (!materialCode) {
      setError("Please select a material");
      return;
    }
    try {
      // API expects weight in pounds. Currently weight is always in LBS.
      // Future: If user selects KG, convert here: toLbs(createWeight(weight, weightUnit))
      const res = await calculateEPR({
        state,
        material: materialCode,
        weight_lbs: weight,
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
              onChange={(e) => setMaterialCode(e.target.value)}
            >
              {materials.map((m) => (
                <option key={m.material_code} value={m.material_code}>
                  {m.material_name}
                </option>
              ))}
            </select>
          )}
        </div>

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
          <div className="form-group">
            <label htmlFor="lca-select">LCA Status</label>
            <select
              id="lca-select"
              value={lcaSelection}
              onChange={(e) => setLcaSelection(e.target.value as LCAOptionType)}
            >
              <option value="none">{programRules.lcaOptions.none.label}</option>
              <option value="bonusA">{programRules.lcaOptions.bonusA.label}</option>
              <option value="bonusB">{programRules.lcaOptions.bonusB.label}</option>
            </select>
          </div>
        )}

        <button onClick={handleCalculate}>Estimate</button>

        {error && <div className="form-error">{error}</div>}

        <FeeBreakdown
          result={result}
          baseRate={selectedMaterial?.net_effective_rate_lbs}
          stateRules={stateRules}
        />

        {result && selectedMaterial && (
          <FeeExplanation
            state={state}
            materialLabel={selectedMaterial.material_name}
            weightLbs={result.weight_lbs}
            baseRate={selectedMaterial.net_effective_rate_lbs}
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
