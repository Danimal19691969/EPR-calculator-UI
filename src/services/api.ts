import { normalizeStateCode } from "../utils/stateCode";

// API base URL - empty string in dev (uses Vite proxy), full URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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

// ============================================
// COLORADO PHASE 2 TYPES
// ============================================

/**
 * Colorado Phase 2 aggregated group from /materials/colorado/phase2/groups
 */
export interface ColoradoPhase2Group {
  group_key: string;
  group_name: string;
  status: string; // e.g., "MRL", "NC", "C"
  base_rate_per_lb: number;
}

export interface ColoradoPhase2GroupsResponse {
  state: string;
  phase: string;
  groups: ColoradoPhase2Group[];
}

/**
 * Colorado Phase 2 calculate request payload
 */
export interface ColoradoPhase2CalculateRequest {
  aggregated_group: string;
  weight_lbs: number;
  pro_modulation_percent: number;
  cdphe_bonus_percent: number;
  newspaper_credit: number;
}

/**
 * Colorado Phase 2 calculate response
 */
export interface ColoradoPhase2CalculateResponse {
  aggregated_group: string;
  weight_lbs: number;
  base_rate_per_lb: number;
  base_dues: number;
  after_eco_modulation: number;
  after_cdphe_bonus: number;
  final_payable: number;
  pro_modulation_percent: number;
  cdphe_bonus_percent: number;
  newspaper_credit: number;
}

/**
 * Fetch materials for a given state.
 *
 * CRITICAL: Each state has a DIFFERENT endpoint structure:
 * - Oregon: /materials/oregon/grouped (returns OregonGroupedMaterialsResponse)
 * - Colorado: /materials/colorado/phase2/groups (returns ColoradoPhase2Group[])
 *
 * This function routes to the correct state-specific endpoint.
 * For unsupported states, it throws an explicit error.
 *
 * NOTE: This function returns Material[] for backward compatibility,
 * but callers should use state-specific fetch functions for proper typing:
 * - fetchOregonGroupedMaterials() for Oregon
 * - fetchColoradoPhase2Groups() for Colorado Phase 2
 */
export async function fetchMaterials(state: string): Promise<Material[]> {
  // CRITICAL: Normalize state code to lowercase to prevent 404 errors
  // Backend API routes are case-sensitive and expect lowercase state codes
  const normalizedState = normalizeStateCode(state);

  // Route to the correct state-specific endpoint
  let endpoint: string;

  switch (normalizedState) {
    case "oregon":
      endpoint = `${API_BASE_URL}/materials/oregon/grouped`;
      break;
    case "colorado":
      endpoint = `${API_BASE_URL}/materials/colorado/phase2/groups`;
      break;
    default:
      throw new Error(`Unsupported state: "${state}". Supported states are: Oregon, Colorado`);
  }

  const res = await fetch(endpoint);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch materials for ${normalizedState}: ${text}`);
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
 *
 * CRITICAL: Uses normalizeStateCode to ensure lowercase state in all payloads.
 * The backend API is case-sensitive and requires lowercase state codes.
 */
function buildCalculatePayload(input: CalculateRequest): Record<string, unknown> {
  const { state, weight_lbs } = input;

  // CRITICAL: Normalize state code to lowercase to prevent API errors
  const normalizedState = normalizeStateCode(state);

  if (normalizedState === "oregon") {
    // HARD GUARD: Oregon requires material_category and sub_category
    if (!input.material_category) {
      throw new Error("Oregon requires material_category");
    }
    if (!input.sub_category) {
      throw new Error("Oregon requires sub_category");
    }

    // Oregon payload - NEVER include 'material'
    const payload: Record<string, unknown> = {
      state: normalizedState,
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
    state: normalizedState,
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

// ============================================
// COLORADO PHASE 2 API FUNCTIONS
// ============================================

/**
 * Normalize Colorado Phase 2 groups from various API response shapes.
 *
 * WHY THIS EXISTS:
 * The Colorado Phase 2 API response shape is not guaranteed to be stable.
 * Production has returned responses with camelCase keys (groupKey, groupName)
 * and string rate values ("0.0134" instead of 0.0134). Without normalization,
 * the resolver fails to find groups, causing false "rate unavailable" errors.
 *
 * DESIGN:
 * - Normalization occurs ONCE at the fetch boundary (here)
 * - Resolver and UI depend on deterministic ColoradoPhase2Group shape
 * - All downstream code assumes snake_case keys and numeric rates
 *
 * This handles:
 * - Wrapped response: { groups: [...] } or { data: [...] }
 * - Raw array response: [...]
 * - CamelCase keys: groupKey, groupName, baseRatePerLb
 * - Snake_case keys: group_key, group_name, base_rate_per_lb
 * - String rate values: "0.0134" → 0.0134
 *
 * SINGLE SOURCE OF TRUTH: All Phase 2 groups must go through this normalizer.
 */
export function normalizeColoradoPhase2Groups(raw: unknown): ColoradoPhase2Group[] {
  // Handle wrapped responses
  let items: unknown[];

  if (Array.isArray(raw)) {
    items = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Check common wrapper keys
    if (Array.isArray(obj.groups)) {
      items = obj.groups;
    } else if (Array.isArray(obj.data)) {
      items = obj.data;
    } else if (Array.isArray(obj.items)) {
      items = obj.items;
    } else {
      console.error("[normalizeColoradoPhase2Groups] Unknown response shape:", raw);
      return [];
    }
  } else {
    console.error("[normalizeColoradoPhase2Groups] Response is not an object or array:", raw);
    return [];
  }

  const normalized: ColoradoPhase2Group[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const obj = item as Record<string, unknown>;

    // Extract group_key (snake_case or camelCase)
    const groupKey = (obj.group_key ?? obj.groupKey) as string | undefined;
    if (!groupKey || typeof groupKey !== "string") {
      console.warn("[normalizeColoradoPhase2Groups] Skipping item without group_key:", obj);
      continue;
    }

    // Extract group_name (snake_case or camelCase)
    const groupName = (obj.group_name ?? obj.groupName) as string | undefined;
    if (!groupName || typeof groupName !== "string") {
      console.warn("[normalizeColoradoPhase2Groups] Skipping item without group_name:", obj);
      continue;
    }

    // Extract rate (multiple possible keys)
    const rawRate = obj.base_rate_per_lb ?? obj.baseRatePerLb ?? obj.rate ?? obj.base_rate;
    const rate = typeof rawRate === "string" ? parseFloat(rawRate) : Number(rawRate);

    // Skip if rate is invalid (NaN or not a number)
    if (typeof rate !== "number" || isNaN(rate)) {
      console.warn("[normalizeColoradoPhase2Groups] Skipping item with invalid rate:", obj);
      continue;
    }

    // Extract status (optional)
    const status = (obj.status as string) ?? "MRL";

    normalized.push({
      group_key: groupKey,
      group_name: groupName,
      status,
      base_rate_per_lb: rate,
    });
  }

  return normalized;
}

/**
 * Fetch Colorado Phase 2 aggregated groups.
 * Used when user selects Colorado + Phase 2 mode.
 *
 * IMPORTANT: Response is normalized to ensure consistent shape regardless of
 * backend format (wrapped, camelCase, string rates, etc.).
 */
export async function fetchColoradoPhase2Groups(): Promise<ColoradoPhase2Group[]> {
  const res = await fetch(`${API_BASE_URL}/materials/colorado/phase2/groups`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Colorado Phase 2 groups: ${text}`);
  }

  const json = await res.json();

  // CRITICAL: Normalize the response to handle any API shape variations
  const normalized = normalizeColoradoPhase2Groups(json);

  // Treat empty result as error - no groups means nothing to display
  if (normalized.length === 0) {
    throw new Error("No Phase 2 material groups available (after normalization)");
  }

  return normalized;
}

/**
 * Calculate Colorado Phase 2 fee.
 * Uses the dedicated Phase 2 endpoint with eco-modulation and CDPHE bonus.
 */
export async function calculateColoradoPhase2(
  payload: ColoradoPhase2CalculateRequest
): Promise<ColoradoPhase2CalculateResponse> {
  // HARD GUARD: Validate required fields
  if (!payload.aggregated_group) {
    throw new Error("Colorado Phase 2 requires aggregated_group");
  }
  if (payload.weight_lbs <= 0) {
    throw new Error("Weight must be greater than 0");
  }

  const res = await fetch(`${API_BASE_URL}/calculate/colorado/phase2`, {
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
