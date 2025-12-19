const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

/**
 * Sub-category for materials that have granular classifications.
 * Only used for states that support sub-categories (e.g., Oregon).
 */
export interface MaterialSubcategory {
  subcategory_id: string;
  subcategory_name: string;
  /** Rate modifier - may override or adjust the base material rate */
  rate_modifier?: number;
}

export interface Material {
  material_code: string;
  material_name: string;
  material_class: string;
  net_effective_rate_lbs: number;
  covered: boolean;
  recyclable: boolean;
  compostable: boolean;
  /** Optional sub-categories for granular material classification */
  subcategories?: MaterialSubcategory[];
}

/**
 * LCA selection types for API requests.
 * Uses snake_case to match API convention (matches lca_bonus response type).
 */
export type LCASelectionType = "none" | "bonus_a" | "bonus_b";

/**
 * API request payload for EPR fee calculation.
 *
 * NOTE: The API always expects weight in pounds (weight_lbs).
 * Metric support intentionally deferred.
 * When adding KG input, convert to LBS before calling this API:
 *   import { toLbs, createWeight } from '../utils/weight';
 *   weight_lbs: toLbs(createWeight(userValue, userUnit))
 */
export interface CalculateRequest {
  state: string;
  material: string;
  /** Weight in pounds - the authoritative unit for all calculations */
  weight_lbs: number;
  /** Sub-category ID - only for states that support subcategories (e.g., Oregon) */
  subcategory_id?: string;
  /** LCA selection - only for states that support LCA (e.g., Oregon) */
  lca_selection?: LCASelectionType;
}


export interface LCABonus {
  type: "none" | "bonus_a" | "bonus_b";
  amount: number;
  tier?: string;
}

export interface CalculateResponse {
  state: string;
  weight_lbs: number;
  initial_fee: number;
  lca_bonus: LCABonus;
  total_fee: number;
  status: string;
  program_start: string | null;
}

export async function fetchMaterials(state: string): Promise<Material[]> {
  const res = await fetch(
    `${API_BASE_URL}/materials/${encodeURIComponent(state)}`
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch materials: ${text}`);
  }

  return res.json();
}

export async function calculateEPR(
  payload: CalculateRequest
): Promise<CalculateResponse> {
  const res = await fetch(`${API_BASE_URL}/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}
