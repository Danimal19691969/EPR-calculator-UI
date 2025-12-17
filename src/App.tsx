import { useState, useEffect } from "react";
import { calculateEPR, fetchMaterials } from "./services/api";
import type { Material, CalculateResponse } from "./services/api";
import FeeBreakdown from "./components/FeeBreakdown";
import "./App.css";

export default function App() {
  const [state, setState] = useState("Colorado");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialCode, setMaterialCode] = useState("");
  const [weight, setWeight] = useState(100);
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMaterials() {
      setMaterialsLoading(true);
      setMaterialsError(null);
      setMaterialCode("");
      setMaterials([]);

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
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>EPR Fee Calculator</h1>

      <label>
        State:
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="Colorado">Colorado</option>
          <option value="Oregon">Oregon</option>
        </select>
      </label>

      <br /><br />

      <label>
        Material:
        {materialsLoading ? (
          <span> Loading...</span>
        ) : materialsError ? (
          <span style={{ color: "red" }}> {materialsError}</span>
        ) : materials.length === 0 ? (
          <span> No materials available for this state</span>
        ) : (
          <select
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
      </label>

      <br /><br />

      <label>
        Weight (lbs):
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
        />
      </label>

      <br /><br />

      <button onClick={handleCalculate}>Calculate</button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <FeeBreakdown result={result} />
    </div>
  );
}
