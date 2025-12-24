import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock the API module
vi.mock('./services/api', () => ({
  fetchMaterials: vi.fn(),
  fetchOregonGroupedMaterials: vi.fn(),
  fetchColoradoPhase2Groups: vi.fn(),
  calculateEPR: vi.fn(),
  calculateColoradoPhase2: vi.fn(),
}));

// Import mocked functions for assertions
import { fetchMaterials, fetchOregonGroupedMaterials, fetchColoradoPhase2Groups, calculateEPR, calculateColoradoPhase2 } from './services/api';

const mockOregonCategories = {
  state: 'Oregon',
  categories: [
    {
      category_id: 'glass_and_ceramics',
      category_name: 'Glass and Ceramics',
      subcategories: [
        { id: 'ceramic_all_forms', display_name: 'Ceramic (all forms)', rate: 0.05 },
        { id: 'glass_clear', display_name: 'Glass (clear)', rate: 0.03 },
      ],
    },
    {
      category_id: 'paper',
      category_name: 'Paper',
      subcategories: [
        { id: 'paper_cardboard', display_name: 'Cardboard', rate: 0.02 },
      ],
    },
  ],
};

const mockColoradoMaterials = [
  { material_code: 'HDPE', material_name: 'HDPE Plastic', material_class: 'Plastic', net_effective_rate_lbs: 0.04, covered: true, recyclable: true, compostable: false },
  { material_code: 'PET', material_name: 'PET Plastic', material_class: 'Plastic', net_effective_rate_lbs: 0.03, covered: true, recyclable: true, compostable: false },
];

const mockColoradoPhase2Groups = [
  { group_key: 'plastic_rigid', group_name: 'Plastic - Rigid', status: 'MRL', base_rate_per_lb: 0.02 },
  { group_key: 'paper_cardboard', group_name: 'Paper - Cardboard', status: 'MRL', base_rate_per_lb: 0.015 },
];

const mockCalculateResponse = {
  state: 'oregon',
  weight_lbs: 100,
  initial_fee: 5.00,
  lca_bonus: { type: 'none', amount: 0 },
  total_fee: 5.00,
  status: 'active',
  program_start: '2025-07-01',
};

const mockPhase2CalculateResponse = {
  aggregated_group: 'plastic_rigid',
  weight_lbs: 100,
  base_rate_per_lb: 0.02,
  base_dues: 2.00,
  after_eco_modulation: 2.00,
  after_cdphe_bonus: 2.00,
  final_payable: 2.00,
  pro_modulation_percent: 0,
  cdphe_bonus_percent: 0,
  newspaper_credit: 0,
};

beforeEach(() => {
  vi.clearAllMocks();

  // Default: Colorado materials load (Phase 1 - now hidden but still mocked)
  (fetchMaterials as any).mockResolvedValue(mockColoradoMaterials);
  // Default: Colorado Phase 2 groups load (now the default)
  (fetchColoradoPhase2Groups as any).mockResolvedValue(mockColoradoPhase2Groups);
  (fetchOregonGroupedMaterials as any).mockResolvedValue(mockOregonCategories);
  (calculateEPR as any).mockResolvedValue(mockCalculateResponse);
  (calculateColoradoPhase2 as any).mockResolvedValue(mockPhase2CalculateResponse);
});

describe('Oregon subcategory selection flow', () => {
  it('should NOT show validation error when valid subcategory is selected', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initial Colorado materials to load
    await waitFor(() => {
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    });

    // Switch to Oregon
    await user.selectOptions(screen.getByLabelText(/state/i), 'Oregon');

    // Wait for Oregon categories to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select category/i)).toBeInTheDocument();
    });

    // Select a category
    await user.selectOptions(screen.getByLabelText(/select category/i), 'glass_and_ceramics');

    // Wait for subcategory dropdown to appear
    await waitFor(() => {
      expect(screen.getByLabelText(/select subcategory/i)).toBeInTheDocument();
    });

    // Select a subcategory
    await user.selectOptions(screen.getByLabelText(/select subcategory/i), 'ceramic_all_forms');

    // Click Estimate
    await user.click(screen.getByRole('button', { name: /estimate/i }));

    // CRITICAL ASSERTION: No validation error should appear
    expect(screen.queryByText(/please select a subcategory/i)).not.toBeInTheDocument();

    // calculateEPR should have been called
    expect(calculateEPR).toHaveBeenCalledTimes(1);

    // Verify the payload has correct fields
    expect(calculateEPR).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'Oregon',
        material_category: 'glass_and_ceramics',
        sub_category: 'ceramic_all_forms',
        weight_lbs: expect.any(Number),
      })
    );
  });

  it('should show validation error when subcategory is NOT selected', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    });

    // Switch to Oregon
    await user.selectOptions(screen.getByLabelText(/state/i), 'Oregon');

    // Wait for Oregon categories to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select category/i)).toBeInTheDocument();
    });

    // Select a category (but NOT a subcategory)
    await user.selectOptions(screen.getByLabelText(/select category/i), 'glass_and_ceramics');

    // Wait for subcategory dropdown to appear
    await waitFor(() => {
      expect(screen.getByLabelText(/select subcategory/i)).toBeInTheDocument();
    });

    // Do NOT select a subcategory - leave it at default "Select a subcategory"

    // Click Estimate
    await user.click(screen.getByRole('button', { name: /estimate/i }));

    // Validation error SHOULD appear
    await waitFor(() => {
      expect(screen.getByText(/please select a subcategory/i)).toBeInTheDocument();
    });

    // calculateEPR should NOT have been called
    expect(calculateEPR).not.toHaveBeenCalled();
  });

  it('should show validation error when category is NOT selected', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    });

    // Switch to Oregon
    await user.selectOptions(screen.getByLabelText(/state/i), 'Oregon');

    // Wait for Oregon categories to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select category/i)).toBeInTheDocument();
    });

    // Do NOT select a category - leave it at default

    // Click Estimate
    await user.click(screen.getByRole('button', { name: /estimate/i }));

    // Validation error for category SHOULD appear
    await waitFor(() => {
      expect(screen.getByText(/please select a category/i)).toBeInTheDocument();
    });

    // calculateEPR should NOT have been called
    expect(calculateEPR).not.toHaveBeenCalled();
  });

  it('should reset subcategory when category changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    });

    // Switch to Oregon
    await user.selectOptions(screen.getByLabelText(/state/i), 'Oregon');

    // Wait for Oregon categories to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select category/i)).toBeInTheDocument();
    });

    // Select a category
    await user.selectOptions(screen.getByLabelText(/select category/i), 'glass_and_ceramics');

    // Wait for subcategory dropdown and select one
    await waitFor(() => {
      expect(screen.getByLabelText(/select subcategory/i)).toBeInTheDocument();
    });
    await user.selectOptions(screen.getByLabelText(/select subcategory/i), 'ceramic_all_forms');

    // Verify subcategory is selected
    expect((screen.getByLabelText(/select subcategory/i) as HTMLSelectElement).value).toBe('ceramic_all_forms');

    // Now change the category
    await user.selectOptions(screen.getByLabelText(/select category/i), 'paper');

    // Wait for new subcategory dropdown
    await waitFor(() => {
      expect(screen.getByLabelText(/select subcategory/i)).toBeInTheDocument();
    });

    // Subcategory should be reset to empty
    expect((screen.getByLabelText(/select subcategory/i) as HTMLSelectElement).value).toBe('');
  });
});

describe('Colorado Phase 2 material group selection flow', () => {
  it('should work correctly with Colorado Phase 2 material group selection', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for Colorado Phase 2 groups to load (now the default)
    await waitFor(() => {
      expect(screen.getByLabelText(/select material group/i)).toBeInTheDocument();
    });

    // Verify the locked phase selector shows 2026 Program
    expect(screen.getByText('2026 Program (HB22-1355)')).toBeInTheDocument();

    // Select a material group
    await user.selectOptions(screen.getByLabelText(/select material group/i), 'plastic_rigid');

    // Click Estimate
    await user.click(screen.getByRole('button', { name: /estimate/i }));

    // calculateColoradoPhase2 should have been called with Phase 2 payload
    await waitFor(() => {
      expect(calculateColoradoPhase2).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregated_group: 'plastic_rigid',
          weight_lbs: expect.any(Number),
          pro_modulation_percent: 0,
          cdphe_bonus_percent: 0,
          newspaper_credit: 0,
        })
      );
    });

    // Phase 1 calculateEPR should NOT have been called
    expect(calculateEPR).not.toHaveBeenCalled();
  });
});
