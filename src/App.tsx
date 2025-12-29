import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { getProgramRules, OREGON_OPERATIONAL_PORTION } from "./config/programRules";
import type { LCAOptionType } from "./config/programRules";
import { getStateLegal } from "./config/stateLegal";
import FeeBreakdown from "./components/FeeBreakdown";
import FeeExplanation from "./components/FeeExplanation";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import LcaSelector from "./components/LcaSelector";
import ColoradoPhaseSelector, { SHOW_CURRENT_PROGRAM } from "./components/ColoradoPhaseSelector";
import type { ColoradoPhase } from "./components/ColoradoPhaseSelector";
import ColoradoPhase2Breakdown from "./components/ColoradoPhase2Breakdown";
import ColoradoPhase2FeeExplanation from "./components/ColoradoPhase2FeeExplanation";
import { generateColoradoPhase2Explanation } from "./utils/coloradoPhase2Explanation";
import { computeColoradoPhase2DerivedValues } from "./utils/coloradoPhase2DerivedValues";
import CdphePerformanceSelector, { cdpheCriteriaToPercent } from "./components/CdphePerformanceSelector";
import type { CdpheCriteria } from "./components/CdphePerformanceSelector";
import EcoModulationSelector, { ecoModulationTierToPercent } from "./components/EcoModulationSelector";
import type { EcoModulationTier } from "./components/EcoModulationSelector";
import InKindAdvertisingCredit, { isInKindEligible } from "./components/InKindAdvertisingCredit";
import OregonLcaExplanation from "./components/OregonLcaExplanation";
import type { TimelineStep } from "./components/DeltaTimeline";
import BackendTimeline from "./components/BackendTimeline";
import PrintableResultsLayout from "./components/PrintableResultsLayout";
import type { BreakdownRow } from "./components/PrintableResultsLayout";
import PrintableResultsLayoutV2 from "./components/PrintableResultsLayoutV2";
import { buildColoradoPhase2Snapshot } from "./pdf/buildColoradoPhase2Snapshot";
import type { PdfSnapshot } from "./pdf/PdfSnapshot";
import { generatePDFFilename, exportElementToPDF, formatCurrencyForPDF, formatRateForPDF } from "./utils/exportResultsToPDF";
import {
  resolveColoradoRateSafe,
  hasValidColoradoRate,
  logColoradoRateDiagnostics,
} from "./utils/coloradoRateResolver";
import { Download } from "lucide-react";
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
  // Oregon: 2027 Estimate mode toggle (enables Bonus B selection)
  const [oregon2027Mode, setOregon2027Mode] = useState(false);
  // Oregon Bonus B tier selection (only used when bonusB is selected in LCA Status)
  const [oregonBonusBTier, setOregonBonusBTier] = useState<"tier1" | "tier2" | "tier3" | null>(null);
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  // Explicit Phase 2 loading state for UX guardrails
  const [phase2GroupsLoading, setPhase2GroupsLoading] = useState(false);
  // Delta Timeline toggle state (hidden by default)
  const [showTimeline, setShowTimeline] = useState(false);
  // PDF export state
  const [isExporting, setIsExporting] = useState(false);
  const printableLayoutRef = useRef<HTMLDivElement>(null);

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
  // CRITICAL: Also checks that the selected group has a valid rate
  // CRITICAL: Must NOT enable during loading - rate validation is meaningless then
  const canEstimatePhase2 =
    !phase2GroupsLoading &&
    safePhase2Groups.length > 0 &&
    !!selectedPhase2Group &&
    weight > 0 &&
    hasValidColoradoRate(safePhase2Groups, selectedPhase2Group);

  // Resolve the rate for the selected group (null if invalid)
  const selectedGroupRate = useMemo(
    () => resolveColoradoRateSafe(safePhase2Groups, selectedPhase2Group),
    [safePhase2Groups, selectedPhase2Group]
  );

  // SINGLE SOURCE OF TRUTH: Compute derived values for Colorado Phase 2
  // Both UI and PDF MUST use these values to ensure parity
  const phase2DerivedValues = useMemo(
    () => (phase2Result ? computeColoradoPhase2DerivedValues(phase2Result) : null),
    [phase2Result]
  );

  // SINGLE SOURCE OF TRUTH: Build PDF snapshot for Colorado Phase 2
  // This snapshot captures EXACTLY what the UI displays - no recomputation in PDF
  const coloradoPhase2Snapshot: PdfSnapshot | null = useMemo(() => {
    if (!isColoradoPhase2 || !phase2Result) return null;
    const group = safePhase2Groups.find((g) => g.group_key === selectedPhase2Group);
    const groupName = group?.group_name || phase2Result.aggregated_group;
    return buildColoradoPhase2Snapshot({
      result: phase2Result,
      resolvedRate: selectedGroupRate,
      groupName,
    });
  }, [isColoradoPhase2, phase2Result, safePhase2Groups, selectedPhase2Group, selectedGroupRate]);

  // Flag to indicate rate resolution failed for selected group
  // CRITICAL: Only validate rates AFTER groups have finished loading
  // During loading, resolver returns null but that's expected (not an error)
  const hasRateError =
    isColoradoPhase2 &&
    !phase2GroupsLoading &&
    selectedPhase2Group &&
    selectedGroupRate === null;

  // DERIVED Colorado rate error message (SINGLE SOURCE OF TRUTH)
  // This is NOT stored in state - it's computed fresh on every render
  // The error disappears automatically when a valid group is selected
  const coloradoRateError = hasRateError
    ? "This material group does not yet have a published Colorado rate under the 2026 Program Plan. Please select a different group or consult the PRO."
    : null;

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
      // Reset Oregon LCA state when switching states
      setOregon2027Mode(false);
      setOregonBonusBTier(null);
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
          // DEV ONLY: Log diagnostic table to trace rate data flow
          logColoradoRateDiagnostics(groups);

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
      bonusC: "bonus_c", // Disabled in UI - not selectable until 2027
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
      // CRITICAL: Validate rate before calculation
      // Only validate after groups are loaded - during loading, validation is meaningless
      // NOTE: Do NOT call setError() here - Colorado rate errors are DERIVED, not stored
      // The coloradoRateError derived value handles displaying the error message
      if (!phase2GroupsLoading && !hasValidColoradoRate(safePhase2Groups, selectedPhase2Group)) {
        return; // Block calculation, but error is shown via derived coloradoRateError
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

  /**
   * Build PDF export data and trigger download.
   */
  const handleExportPDF = useCallback(async () => {
    if (!printableLayoutRef.current) return;

    setIsExporting(true);

    try {
      // Determine material name for filename
      let materialName = "";
      if (isColoradoPhase2 && selectedPhase2Group) {
        const group = safePhase2Groups.find((g) => g.group_key === selectedPhase2Group);
        materialName = group?.group_name || selectedPhase2Group;
      } else if (isOregon && selectedCategory) {
        materialName = selectedCategory.category_name;
      } else if (selectedMaterial) {
        materialName = selectedMaterial.material_name;
      }

      const filename = generatePDFFilename(state, materialName);

      // Small delay to ensure the hidden layout is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 100));

      await exportElementToPDF(printableLayoutRef.current, filename);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [
    state,
    isColoradoPhase2,
    isOregon,
    selectedPhase2Group,
    safePhase2Groups,
    selectedCategory,
    selectedMaterial,
  ]);

  /**
   * Build breakdown rows for PDF export based on current state and result.
   *
   * CRITICAL: For Colorado Phase 2, uses phase2DerivedValues (memoized) as the
   * SINGLE SOURCE OF TRUTH for all derived values. This ensures the PDF
   * displays identical values to the UI (ColoradoPhase2Breakdown component).
   */
  const buildBreakdownRows = useCallback((): BreakdownRow[] => {
    const rows: BreakdownRow[] = [];

    if (isColoradoPhase2 && phase2DerivedValues) {
      // SINGLE SOURCE OF TRUTH: Use memoized derived values
      // This guarantees PDF values match UI values exactly
      const derived = phase2DerivedValues;

      const group = safePhase2Groups.find((g) => g.group_key === selectedPhase2Group);
      const groupName = group?.group_name || "Material Group";

      rows.push({
        label: "Material Group",
        value: groupName,
        type: "header",
      });
      // SINGLE SOURCE OF TRUTH: Use resolved rate from groups API only
      // Calculation response rate is intentionally ignored - resolver is the only authority
      rows.push({
        label: `Rate (per lb)`,
        value: formatRateForPDF(selectedGroupRate),
        type: "normal",
      });
      rows.push({
        label: `Weight`,
        value: `${derived.weightLbs} lbs`,
        type: "normal",
      });
      rows.push({
        label: "Base Dues",
        value: formatCurrencyForPDF(derived.baseDues),
        type: "subtotal",
      });

      if (derived.proModulationPercent > 0) {
        rows.push({
          label: `PRO Eco-Modulation (${(derived.proModulationPercent * 100).toFixed(0)}%)`,
          value: `-${formatCurrencyForPDF(derived.proModulationDelta)}`,
          type: "credit",
        });
      }

      if (derived.cdpheBonusPercent > 0) {
        rows.push({
          label: `CDPHE Performance Bonus (${(derived.cdpheBonusPercent * 100).toFixed(0)}%)`,
          value: `-${formatCurrencyForPDF(derived.cdpheBonusDelta)}`,
          type: "credit",
        });
      }

      if (derived.inKindCredit > 0) {
        rows.push({
          label: "In-Kind Advertising Credit",
          value: `-${formatCurrencyForPDF(derived.inKindCredit)}`,
          type: "credit",
        });
      }

      rows.push({
        label: "Final Payable",
        value: formatCurrencyForPDF(derived.finalPayable),
        type: "total",
      });
    } else if (result) {
      // Oregon or Colorado Phase 1
      const materialLabel = isOregon
        ? selectedCategory?.category_name || "Material"
        : selectedMaterial?.material_name || "Material";
      const baseRate = isOregon
        ? selectedOregonSubcategory?.rate || 0
        : selectedMaterial?.net_effective_rate_lbs || 0;

      rows.push({
        label: "Material",
        value: materialLabel,
        type: "header",
      });

      if (isOregon && selectedOregonSubcategory) {
        rows.push({
          label: "Subcategory",
          value: selectedOregonSubcategory.display_name,
          type: "normal",
        });
      }

      rows.push({
        label: "Rate (per lb)",
        value: formatRateForPDF(baseRate),
        type: "normal",
      });
      rows.push({
        label: "Weight",
        value: `${result.weight_lbs} lbs`,
        type: "normal",
      });
      rows.push({
        label: "Initial Fee",
        value: formatCurrencyForPDF(result.initial_fee),
        type: "subtotal",
      });

      if (result.lca_bonus.amount > 0) {
        rows.push({
          label: `LCA Bonus (${result.lca_bonus.type})`,
          value: `-${formatCurrencyForPDF(result.lca_bonus.amount)}`,
          type: "credit",
        });
      }

      rows.push({
        label: "Total Fee",
        value: formatCurrencyForPDF(result.total_fee),
        type: "total",
      });
    }

    return rows;
  }, [
    isColoradoPhase2,
    isOregon,
    phase2DerivedValues,
    result,
    safePhase2Groups,
    selectedPhase2Group,
    selectedGroupRate,
    selectedCategory,
    selectedMaterial,
    selectedOregonSubcategory,
  ]);

  /**
   * Build explanation paragraphs for PDF export.
   *
   * COLORADO PHASE 2: Uses generateColoradoPhase2Explanation() as SINGLE SOURCE OF TRUTH.
   * This ensures PDF and UI display identical explanation text.
   */
  const buildExplanationParagraphs = useCallback((): string[] => {
    const stateLegal = getStateLegal(state);

    // Colorado Phase 2: Use shared explanation generator (single source of truth)
    if (isColoradoPhase2 && phase2Result) {
      const group = safePhase2Groups.find((g) => g.group_key === selectedPhase2Group);
      const groupName = group?.group_name || "the selected material group";

      return generateColoradoPhase2Explanation({
        groupName,
        result: phase2Result,
        resolvedRate: selectedGroupRate,
      });
    }

    // Oregon and other states: build explanation paragraphs here
    const paragraphs: string[] = [];
    if (result) {
      const materialLabel = isOregon
        ? selectedCategory?.category_name || "the selected material"
        : selectedMaterial?.material_name || "the selected material";
      const baseRate = isOregon
        ? selectedOregonSubcategory?.rate || 0
        : selectedMaterial?.net_effective_rate_lbs || 0;

      paragraphs.push(
        `This estimate is calculated for ${materialLabel} under the ${stateLegal.lawName} (${stateLegal.statuteReference}).`
      );

      paragraphs.push(
        `The initial fee of ${formatCurrencyForPDF(result.initial_fee)} is calculated by multiplying the weight (${result.weight_lbs} lbs) by the per-pound rate (${formatRateForPDF(baseRate)}).`
      );

      if (isOregon && result.lca_bonus.amount > 0) {
        const bonusPercent = result.lca_bonus.type === "bonus_a" ? "5%" : "variable";
        paragraphs.push(
          `An LCA bonus of ${formatCurrencyForPDF(result.lca_bonus.amount)} (${bonusPercent} reduction) has been applied based on the selected lifecycle assessment status. ${OREGON_OPERATIONAL_PORTION} of the fee represents operational costs not subject to LCA adjustments.`
        );
      }
    }

    return paragraphs;
  }, [
    state,
    isColoradoPhase2,
    isOregon,
    phase2Result,
    result,
    safePhase2Groups,
    selectedPhase2Group,
    selectedCategory,
    selectedMaterial,
    selectedOregonSubcategory,
  ]);

  /**
   * Build timeline steps for PDF export.
   *
   * CRITICAL: Backend is the SINGLE SOURCE OF TRUTH for timeline data.
   * This function maps backend AdjustmentTimelineStep[] to TimelineStep[]
   * for the PDF layout component. NO computation - just format transformation.
   */
  const buildTimelineSteps = useCallback((): TimelineStep[] => {
    // Get backend timeline from whichever result is available
    const backendTimeline = phase2Result?.adjustment_timeline ?? result?.adjustment_timeline;

    if (!backendTimeline || backendTimeline.length === 0) {
      return [];
    }

    // Map backend format to PDF format (simple transformation, no computation)
    return backendTimeline.map((step) => ({
      label: step.label,
      delta: step.amount ?? step.rate_delta ?? 0,
      sublabel: step.description,
    }));
  }, [phase2Result?.adjustment_timeline, result?.adjustment_timeline]);

  // Determine if we have exportable results
  const hasExportableResults = (isColoradoPhase2 && phase2Result) || (!isColoradoPhase2 && result);

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
                <>
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
                  {/* Warning when selected group has invalid rate - uses DERIVED error, not state */}
                  {coloradoRateError && (
                    <div className="form-error" role="alert">
                      {coloradoRateError}
                    </div>
                  )}
                </>
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

        {/* LCA Bonus Selection - only shown for states that support it */}
        {stateRules.supportsLCA && programRules.lcaOptions && (
          <LcaSelector
            value={lcaSelection}
            onChange={setLcaSelection}
            lcaOptions={programRules.lcaOptions}
            is2027Mode={oregon2027Mode}
            on2027ModeChange={setOregon2027Mode}
          />
        )}

        {/* Oregon LCA Explanation - rendered below LCA Status selector */}
        {isOregon && (
          <OregonLcaExplanation
            selectedOption={lcaSelection}
            bonusBTier={oregonBonusBTier}
            onBonusBTierChange={(tier) => setOregonBonusBTier(tier)}
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
          <>
            <ColoradoPhase2Breakdown
              result={phase2Result}
              groupName={
                safePhase2Groups.length > 0 && selectedPhase2Group
                  ? safePhase2Groups.find((g) => g.group_key === selectedPhase2Group)?.group_name
                  : undefined
              }
              resolvedRate={selectedGroupRate}
            />

            {/* Colorado Phase 2 Fee Explanation - uses same text as PDF */}
            {phase2Result && (
              <ColoradoPhase2FeeExplanation
                result={phase2Result}
                groupName={
                  safePhase2Groups.find((g) => g.group_key === selectedPhase2Group)?.group_name ||
                  "the selected material group"
                }
                resolvedRate={selectedGroupRate}
              />
            )}

          </>
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

        {/* ================================================================
            UNIFIED TIMELINE RENDER BLOCK
            Backend is the SINGLE SOURCE OF TRUTH for adjustment_timeline.
            This block is OUTSIDE all state/phase branching.
            Renders when either result or phase2Result has timeline data.
            ================================================================ */}
        {(() => {
          const timeline = phase2Result?.adjustment_timeline ?? result?.adjustment_timeline;

          // Verification guard for production debugging
          console.log("TIMELINE_RENDER_CHECK", {
            hasResultTimeline: !!result?.adjustment_timeline,
            hasPhase2Timeline: !!phase2Result?.adjustment_timeline,
            timelineLength: timeline?.length ?? 0,
          });

          if (!timeline || timeline.length === 0) {
            return null;
          }

          return (
            <>
              <button
                type="button"
                className="timeline-toggle-btn"
                onClick={() => setShowTimeline(!showTimeline)}
                aria-expanded={showTimeline}
              >
                {showTimeline ? "Hide Fee Adjustment Timeline" : "Show Fee Adjustment Timeline"}
              </button>

              {showTimeline && (
                <BackendTimeline
                  steps={timeline}
                  currency="$"
                />
              )}
            </>
          );
        })()}

        {/* PDF Export Button - shown when results are available */}
        {hasExportableResults && (
          <button
            type="button"
            className="pdf-export-btn"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <Download size={16} />
            {isExporting ? "Generating PDF..." : "Download Fee Summary (PDF)"}
          </button>
        )}
      </div>

      {/* Hidden Printable Layout for PDF Export */}
      {/* Colorado Phase 2: Use snapshot-based V2 component for guaranteed UI/PDF parity */}
      {isColoradoPhase2 && coloradoPhase2Snapshot && (
        <PrintableResultsLayoutV2
          ref={printableLayoutRef}
          snapshot={coloradoPhase2Snapshot}
        />
      )}
      {/* Oregon/Other: Use legacy component (Oregon is not being refactored) */}
      {!isColoradoPhase2 && hasExportableResults && (
        <PrintableResultsLayout
          ref={printableLayoutRef}
          state={state}
          programName={getStateLegal(state).lawName}
          materialCategory={
            isOregon
              ? selectedCategory?.category_name || ""
              : selectedMaterial?.material_name || ""
          }
          subcategory={
            isOregon ? selectedOregonSubcategory?.display_name : undefined
          }
          weightLbs={result?.weight_lbs || weight}
          dateGenerated={new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          finalPayable={result?.total_fee || 0}
          baseDues={result?.initial_fee || 0}
          timelineSteps={buildTimelineSteps()}
          breakdownRows={buildBreakdownRows()}
          explanationParagraphs={buildExplanationParagraphs()}
          authorityText={`This estimate is calculated under the ${getStateLegal(state).lawName}.`}
          lawReference={getStateLegal(state).statuteReference}
        />
      )}

      <Footer state={state} />
    </div>
  );
}
