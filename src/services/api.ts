const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

export interface Material {
  material_code: string;
  material_name: string;
  material_class: string;
  net_effective_rate_lbs: number;
  covered: boolean;
  recyclable: boolean;
  compostable: boolean;
}

export interface CalculateRequest {
  state: string;
  material: string;
  weight_lbs: number;
}


export interface CalculateResponse {
  state: string;
  base_fee: number;
  total_fee: number;
  adjustments?: {
    name: string;
    amount: number;
  }[];
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
