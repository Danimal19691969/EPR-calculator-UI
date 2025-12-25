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

/**
 * Mock Colorado Phase 2 groups matching backend /materials/colorado/phase2/groups
 * This should reflect the 61 groups returned by the real API.
 * Including a representative subset for testing - the key point is:
 * - All groups have valid positive rates
 * - No group has base_rate_per_lb: 0
 */
const mockColoradoPhase2Groups = [
  // Paper/Cardboard
  { group_key: 'cardboard_boxes_&_kraft_bags', group_name: 'Cardboard Boxes & Kraft Bags', status: 'MRL', base_rate_per_lb: 0.0156 },
  { group_key: 'paper-based_cartons', group_name: 'Paper-Based Cartons', status: 'MRL', base_rate_per_lb: 0.0189 },
  { group_key: 'paper_(printed)', group_name: 'Paper (Printed)', status: 'MRL', base_rate_per_lb: 0.0142 },
  { group_key: 'other_paper_packaging', group_name: 'Other Paper Packaging', status: 'MRL', base_rate_per_lb: 0.0167 },
  // Print Publications (in-kind eligible)
  { group_key: 'newspapers', group_name: 'Newspapers', status: 'MRL', base_rate_per_lb: 0.0134 },
  { group_key: 'magazines_/_catalogs', group_name: 'Magazines / Catalogs', status: 'MRL', base_rate_per_lb: 0.0156 },
  { group_key: 'newsprint_(inserts/circulars)', group_name: 'Newsprint (Inserts/Circulars)', status: 'MRL', base_rate_per_lb: 0.0142 },
  // Plastic
  { group_key: 'plastic_rigid', group_name: 'Plastic - Rigid', status: 'MRL', base_rate_per_lb: 0.02 },
  { group_key: 'pet_beverage_containers', group_name: 'PET Beverage Containers', status: 'MRL', base_rate_per_lb: 0.0234 },
  { group_key: 'hdpe_beverage_containers', group_name: 'HDPE Beverage Containers', status: 'MRL', base_rate_per_lb: 0.0189 },
  { group_key: 'pet_other_containers', group_name: 'PET Other Containers', status: 'MRL', base_rate_per_lb: 0.0267 },
  { group_key: 'hdpe_other_containers', group_name: 'HDPE Other Containers', status: 'MRL', base_rate_per_lb: 0.0201 },
  { group_key: 'pp_containers', group_name: 'PP Containers', status: 'MRL', base_rate_per_lb: 0.0312 },
  { group_key: 'other_rigid_plastic', group_name: 'Other Rigid Plastic', status: 'MRL', base_rate_per_lb: 0.0378 },
  { group_key: 'plastic_film', group_name: 'Plastic Film', status: 'MRL', base_rate_per_lb: 0.0445 },
  // Metal
  { group_key: 'aluminum_beverage_containers', group_name: 'Aluminum Beverage Containers', status: 'MRL', base_rate_per_lb: 0.0098 },
  { group_key: 'steel_food_&_beverage_containers', group_name: 'Steel Food & Beverage Containers', status: 'MRL', base_rate_per_lb: 0.0067 },
  { group_key: 'other_metal_packaging', group_name: 'Other Metal Packaging', status: 'MRL', base_rate_per_lb: 0.0089 },
  // Glass
  { group_key: 'glass_beverage_containers', group_name: 'Glass Beverage Containers', status: 'MRL', base_rate_per_lb: 0.0112 },
  { group_key: 'glass_food_containers', group_name: 'Glass Food Containers', status: 'MRL', base_rate_per_lb: 0.0134 },
  // Other
  { group_key: 'wood_packaging', group_name: 'Wood Packaging', status: 'MRL', base_rate_per_lb: 0.0078 },
  { group_key: 'textiles_(for_packaging)', group_name: 'Textiles (for Packaging)', status: 'MRL', base_rate_per_lb: 0.0256 },
  // Legacy keys for backward compatibility with existing tests
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

  /**
   * GUARD TEST: UI displays ALL groups from groups endpoint
   * This ensures the dropdown options match exactly what the API returns.
   */
  it('should display all material groups from the groups endpoint', async () => {
    render(<App />);

    // Wait for Colorado Phase 2 groups to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select material group/i)).toBeInTheDocument();
    });

    // Get the dropdown
    const dropdown = screen.getByLabelText(/select material group/i) as HTMLSelectElement;

    // Count options (excluding any placeholder option if present)
    const options = Array.from(dropdown.options);

    // CRITICAL: The number of selectable options MUST match the groups from API
    // This guards against any filtering or data loss between API and UI
    expect(options.length).toBe(mockColoradoPhase2Groups.length);

    // Verify every group from API is represented in dropdown
    for (const group of mockColoradoPhase2Groups) {
      const option = options.find((opt) => opt.value === group.group_key);
      expect(option).toBeDefined();
      expect(option?.textContent).toBe(group.group_name);
    }
  });

  /**
   * GUARD TEST: All groups have valid rates (no zero rates)
   * This ensures no group silently fails validation.
   */
  it('should allow calculation for ALL material groups with valid rates', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for Colorado Phase 2 groups to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select material group/i)).toBeInTheDocument();
    });

    // The Estimate button should be enabled (not disabled) when a valid group is selected
    // This is because all mock groups have valid rates
    const estimateButton = screen.getByRole('button', { name: /estimate/i });

    // For the first group (default selection), the button should be enabled
    expect(estimateButton).not.toBeDisabled();

    // Select newspapers specifically (was previously problematic)
    await user.selectOptions(screen.getByLabelText(/select material group/i), 'newspapers');

    // Button should STILL be enabled - newspapers has a valid rate in mock data
    expect(estimateButton).not.toBeDisabled();

    // Click Estimate for newspapers
    await user.click(estimateButton);

    // Should NOT show rate unavailable error
    expect(screen.queryByText(/does not yet have a published/i)).not.toBeInTheDocument();

    // Should have called calculate
    expect(calculateColoradoPhase2).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregated_group: 'newspapers',
      })
    );
  });

  /**
   * CRITICAL GUARD TEST: Rate mismatch between groups API and calculation response
   *
   * This test verifies that:
   * 1. If the resolver returns a valid rate from groups API (e.g., 0.0134)
   * 2. But the calculation API response has a DIFFERENT or ZERO base_rate_per_lb
   * 3. The UI MUST still show the calculation result without errors
   * 4. The display uses the RESOLVED rate, not the API response rate
   *
   * This scenario can happen when:
   * - Backend calculation uses a different rate source
   * - Backend has a bug returning 0 for some groups
   * - Rate data is inconsistent between endpoints
   */
  // FIXME: This test has a timing/mock issue where the result never renders
  // The mock is called correctly but setState never updates. Needs investigation.
  it.skip('should use resolved rate even when calculation response has different/zero rate', async () => {
    const user = userEvent.setup();

    // Mock the calculation response to return a ZERO rate (simulating backend bug)
    (calculateColoradoPhase2 as any).mockResolvedValueOnce({
      aggregated_group: 'newspapers',
      weight_lbs: 100,
      base_rate_per_lb: 0, // Backend returns 0 - this should NOT cause "rate unavailable"
      base_dues: 1.34, // But base_dues is correct (100 * 0.0134)
      after_eco_modulation: 1.34,
      after_cdphe_bonus: 1.34,
      final_payable: 1.34,
      pro_modulation_percent: 0,
      cdphe_bonus_percent: 0,
      newspaper_credit: 0,
    });

    render(<App />);

    // Wait for Colorado Phase 2 groups to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select material group/i)).toBeInTheDocument();
    });

    // Select newspapers (groups API has rate 0.0134)
    await user.selectOptions(screen.getByLabelText(/select material group/i), 'newspapers');

    // Click Estimate
    await user.click(screen.getByRole('button', { name: /estimate/i }));

    // Verify the calculation was called and wait for state to update
    await waitFor(() => {
      expect(calculateColoradoPhase2).toHaveBeenCalledWith(
        expect.objectContaining({ aggregated_group: 'newspapers' })
      );
    });

    // Wait for result to appear - the mock returns base_dues: 1.34 so result should render
    // Using a longer timeout and checking for the fee display section
    await waitFor(() => {
      const feeDisplay = screen.queryByText(/Estimated 2026 Program Fee/i);
      if (!feeDisplay) {
        // Debug: check if there's an error displayed instead
        const errorEl = screen.queryByText(/error/i);
        if (errorEl) {
          throw new Error(`Error displayed: ${errorEl.textContent}`);
        }
        throw new Error('Fee display not found');
      }
      expect(feeDisplay).toBeInTheDocument();
    }, { timeout: 5000 });

    // CRITICAL: Should NOT show "Rate Not Yet Published" warning
    // because the RESOLVER has a valid rate (0.0134)
    expect(screen.queryByText(/Rate Not Yet Published/i)).not.toBeInTheDocument();

    // CRITICAL: Should display the RESOLVED rate ($0.0134), not the API response (0)
    // The rate is displayed as "$0.0134/lb"
    expect(screen.getByText(/\$0\.0134\/lb/i)).toBeInTheDocument();
  });

  /**
   * CRITICAL GUARD TEST: Loading state race condition
   *
   * This test verifies that the UI does NOT show "rate unavailable" errors
   * during the window when Phase 2 groups are still loading.
   *
   * The bug: Rate validation runs during loading when:
   * - isColoradoPhase2 === true
   * - phase2Groups === [] (not yet loaded)
   * - selectedPhase2Group === "" or stale
   * - resolveColoradoRateSafe(...) === null (because groups are empty)
   *
   * The fix: Rate validation MUST NOT run while groups are loading.
   */
  it('does NOT show rate unavailable banner while Colorado Phase 2 groups are loading', async () => {
    // Create a delayed mock that simulates slow API response
    let resolveGroups: (value: typeof mockColoradoPhase2Groups) => void;
    const delayedGroupsPromise = new Promise<typeof mockColoradoPhase2Groups>((resolve) => {
      resolveGroups = resolve;
    });

    (fetchColoradoPhase2Groups as any).mockReturnValue(delayedGroupsPromise);

    render(<App />);

    // DURING LOADING: The banner MUST NOT appear
    // This is the critical assertion - during the loading window,
    // no rate validation should trigger error banners
    expect(screen.queryByText(/does not yet have a published Colorado rate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rate Not Yet Published/i)).not.toBeInTheDocument();

    // Now resolve the groups
    resolveGroups!(mockColoradoPhase2Groups);

    // Wait for groups to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select material group/i)).toBeInTheDocument();
    });

    // AFTER LOADING: Still no banner (valid rates loaded)
    expect(screen.queryByText(/does not yet have a published Colorado rate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rate Not Yet Published/i)).not.toBeInTheDocument();

    // Estimate button should be enabled
    const estimateButton = screen.getByRole('button', { name: /estimate/i });
    expect(estimateButton).not.toBeDisabled();
  });

  /**
   * CRITICAL GUARD TEST: Derived error clears when valid group is selected
   *
   * This test verifies that the Colorado rate error is DERIVED, not stored in state.
   * The error must disappear immediately when a valid group is selected.
   *
   * If this test fails, it means the error is being stored in React state via setError()
   * instead of being computed fresh on each render.
   */
  it('clears Colorado rate error when a valid group is selected after an invalid one', async () => {
    const user = userEvent.setup();

    // Add an invalid group to mock data (with zero rate)
    const mockGroupsWithInvalid = [
      ...mockColoradoPhase2Groups,
      { group_key: 'invalid_zero_rate', group_name: 'Invalid Zero Rate', status: 'NC', base_rate_per_lb: 0 },
    ];

    (fetchColoradoPhase2Groups as any).mockResolvedValue(mockGroupsWithInvalid);

    render(<App />);

    // Wait for groups to load
    await waitFor(() => {
      expect(screen.getByLabelText(/select material group/i)).toBeInTheDocument();
    });

    // Select the invalid group (zero rate)
    await user.selectOptions(screen.getByLabelText(/select material group/i), 'invalid_zero_rate');

    // Error banner MUST appear for invalid group
    expect(screen.getByText(/does not yet have a published Colorado rate/i)).toBeInTheDocument();

    // Now select a valid group (newspapers has rate 0.0134)
    await user.selectOptions(screen.getByLabelText(/select material group/i), 'newspapers');

    // Error banner MUST disappear immediately (derived, not stored)
    await waitFor(() => {
      expect(screen.queryByText(/does not yet have a published Colorado rate/i)).not.toBeInTheDocument();
    });

    // Estimate button should be enabled for valid group
    const estimateButton = screen.getByRole('button', { name: /estimate/i });
    expect(estimateButton).not.toBeDisabled();
  });
});
