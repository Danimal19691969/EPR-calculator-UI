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
 * Oregon grouped materials response structure.
 * Oregon uses a category → subcategory hierarchy instead of a flat list.
 */
export interface OregonSubcategory {
  id: string;
  display_name: string;
  rate: number;
}

export interface OregonCategory {
  category_id: string;
  category_name: string;
  subcategories: OregonSubcategory[];
}

export interface OregonGroupedMaterialsResponse {
  state: string;
  categories: OregonCategory[];
}

/**
 * LCA selection types for API requests.
 * Uses snake_case to match API convention (matches lca_bonus response type).
 */
export type LCASelectionType = "none" | "bonus_a" | "bonus_b";

/**
 * API request payload for EPR fee calculation.
 *
 * NOTE: The API expects different fields for different states:
 * - Oregon: material_category + sub_category
 * - Colorado: material
 *
 * This interface represents the INPUT from App.tsx.
 * The calculateEPR function transforms it to the correct backend format.
 */
export interface CalculateRequest {
  state: string;
  weight_lbs: number;
  // Oregon-specific fields
  material_category?: string;
  sub_category?: string;
  lca_bonus?: string;
  lca_tier?: string;
  // Colorado-specific fields
  material?: string;
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

/**
 * Fetch Oregon's grouped materials (category → subcategory hierarchy).
 * Oregon uses a different endpoint and response structure than other states.
 */
export async function fetchOregonGroupedMaterials(): Promise<OregonGroupedMaterialsResponse> {
  const res = await fetch(`${API_BASE_URL}/materials/oregon/grouped`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Oregon materials: ${text}`);
  }

  return res.json();
}

/**
 * Build the correct API payload based on state.
 * Oregon and Colorado have different required fields.
 */
function buildCalculatePayload(input: CalculateRequest): Record<string, unknown> {
  const { state, weight_lbs } = input;

  if (state.toLowerCase() === "oregon") {
    // HARD GUARD: Oregon requires material_category and sub_category
    if (!input.material_category) {
      throw new Error("Oregon requires material_category");
    }
    if (!input.sub_category) {
      throw new Error("Oregon requires sub_category");
    }

    // Oregon payload - NEVER include 'material'
    const payload: Record<string, unknown> = {
      state: state.toLowerCase(),
      material_category: input.material_category,
      sub_category: input.sub_category,
      weight_lbs,
    };

    if (input.lca_bonus && input.lca_bonus !== "none") {
      payload.lca_bonus = input.lca_bonus;
    }
    if (input.lca_tier) {
      payload.lca_tier = input.lca_tier;
    }

    return payload;
  }

  // Colorado/default payload - uses 'material'
  if (!input.material) {
    throw new Error("Colorado requires material");
  }

  return {
    state: state.toLowerCase(),
    material: input.material,
    weight_lbs,
  };
}

export async function calculateEPR(
  payload: CalculateRequest
): Promise<CalculateResponse> {
  // Transform input to correct backend format
  const apiPayload = buildCalculatePayload(payload);

  const res = await fetch(`${API_BASE_URL}/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apiPayload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}
