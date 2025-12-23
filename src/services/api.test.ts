import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test for Oregon vs Colorado payload construction.
 *
 * BACKEND CONTRACT:
 *
 * Oregon payload:
 * {
 *   state: "oregon",
 *   material_category: string,
 *   sub_category: string,
 *   weight_lbs: number,
 *   lca_bonus?: string,
 *   lca_tier?: string
 * }
 *
 * Colorado payload:
 * {
 *   state: "colorado",
 *   material: string,
 *   weight_lbs: number
 * }
 */

// Mock fetch to capture the payload
let capturedPayload: Record<string, unknown> | null = null;

beforeEach(() => {
  capturedPayload = null;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
    if (options?.body) {
      capturedPayload = JSON.parse(options.body as string);
    }
    return {
      ok: true,
      json: async () => ({
        state: 'oregon',
        weight_lbs: 100,
        initial_fee: 10.00,
        lca_bonus: { type: 'none', amount: 0 },
        total_fee: 10.00,
        status: 'active',
        program_start: '2025-07-01',
      }),
    };
  }));
});

describe('Oregon payload construction', () => {
  it('should send material_category and sub_category for Oregon, NOT material', async () => {
    // Import the module after mocking
    const { calculateEPR } = await import('./api');

    // Simulate Oregon request with the CORRECT field names
    await calculateEPR({
      state: 'Oregon',
      material_category: 'glass_and_ceramics',
      sub_category: 'ceramic_all_forms',
      weight_lbs: 100,
      lca_bonus: 'none',
    });

    // Oregon should send material_category, NOT material
    expect(capturedPayload).toHaveProperty('material_category');
    expect(capturedPayload).toHaveProperty('sub_category');
    expect(capturedPayload).not.toHaveProperty('material');
    expect(capturedPayload).not.toHaveProperty('subcategory_id');

    // Verify exact field values
    expect(capturedPayload?.material_category).toBe('glass_and_ceramics');
    expect(capturedPayload?.sub_category).toBe('ceramic_all_forms');
    expect(capturedPayload?.state).toBe('oregon'); // lowercase
  });

  it('should send material for Colorado, NOT material_category', async () => {
    const { calculateEPR } = await import('./api');

    // Simulate Colorado request
    await calculateEPR({
      state: 'colorado',
      material: 'HDPE',
      weight_lbs: 100,
    });

    // Colorado should send material, NOT material_category
    expect(capturedPayload).toHaveProperty('material');
    expect(capturedPayload).not.toHaveProperty('material_category');
    expect(capturedPayload).not.toHaveProperty('sub_category');

    expect(capturedPayload?.material).toBe('HDPE');
  });

  it('should throw error if Oregon is missing material_category', async () => {
    const { calculateEPR } = await import('./api');

    await expect(calculateEPR({
      state: 'Oregon',
      sub_category: 'ceramic_all_forms',
      weight_lbs: 100,
    })).rejects.toThrow('Oregon requires material_category');
  });

  it('should throw error if Oregon is missing sub_category', async () => {
    const { calculateEPR } = await import('./api');

    await expect(calculateEPR({
      state: 'Oregon',
      material_category: 'glass_and_ceramics',
      weight_lbs: 100,
    })).rejects.toThrow('Oregon requires sub_category');
  });

  it('should throw error if Colorado is missing material', async () => {
    const { calculateEPR } = await import('./api');

    await expect(calculateEPR({
      state: 'Colorado',
      weight_lbs: 100,
    })).rejects.toThrow('Colorado requires material');
  });
});
