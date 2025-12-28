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
 *
 * CRITICAL: All state codes MUST be lowercase in API calls.
 * The backend API is case-sensitive and will return 404 for uppercase states.
 */

// Mock fetch to capture the payload and URL
let capturedPayload: Record<string, unknown> | null = null;
let capturedUrl: string | null = null;

beforeEach(() => {
  capturedPayload = null;
  capturedUrl = null;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
    capturedUrl = url;
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

/**
 * State Code Normalization and Endpoint Routing Tests
 *
 * CRITICAL BUG FIX: The backend API has STATE-SPECIFIC endpoints:
 * - Oregon: /materials/oregon/grouped
 * - Colorado: /materials/colorado/phase2/groups
 *
 * The generic /materials/{state} endpoint does NOT exist and causes 404 errors.
 * These tests ensure fetchMaterials routes to the correct state-specific endpoint.
 */
describe('State code normalization and endpoint routing', () => {
  describe('fetchMaterials state-specific endpoint routing', () => {
    it('should call /materials/oregon/grouped for Oregon', async () => {
      const { fetchMaterials } = await import('./api');

      await fetchMaterials('Oregon');

      // Must use the Oregon-specific endpoint
      expect(capturedUrl).toContain('/materials/oregon/grouped');
      // Must NOT use generic /materials/oregon (which doesn't exist)
      expect(capturedUrl).not.toMatch(/\/materials\/oregon$/);
    });

    it('should call /materials/colorado/phase2/groups for Colorado', async () => {
      const { fetchMaterials } = await import('./api');

      await fetchMaterials('Colorado');

      // Must use the Colorado Phase 2 specific endpoint
      expect(capturedUrl).toContain('/materials/colorado/phase2/groups');
      // Must NOT use generic /materials/colorado (which doesn't exist)
      expect(capturedUrl).not.toMatch(/\/materials\/colorado$/);
    });

    it('should call correct Oregon endpoint for "OREGON" (uppercase)', async () => {
      const { fetchMaterials } = await import('./api');

      await fetchMaterials('OREGON');

      expect(capturedUrl).toContain('/materials/oregon/grouped');
      expect(capturedUrl).not.toContain('OREGON');
    });

    it('should call correct Colorado endpoint for " Colorado " (with whitespace)', async () => {
      const { fetchMaterials } = await import('./api');

      await fetchMaterials(' Colorado ');

      expect(capturedUrl).toContain('/materials/colorado/phase2/groups');
    });

    it('should throw error for unsupported state "Texas"', async () => {
      const { fetchMaterials } = await import('./api');

      await expect(fetchMaterials('Texas')).rejects.toThrow(
        'Unsupported state: "Texas". Supported states are: Oregon, Colorado'
      );
    });

    it('should throw error for unsupported state "california"', async () => {
      const { fetchMaterials } = await import('./api');

      await expect(fetchMaterials('california')).rejects.toThrow(
        'Unsupported state: "california". Supported states are: Oregon, Colorado'
      );
    });
  });

  describe('calculateEPR payload normalization', () => {
    it('should send lowercase state in payload for "Colorado"', async () => {
      const { calculateEPR } = await import('./api');

      await calculateEPR({
        state: 'Colorado',
        material: 'HDPE',
        weight_lbs: 100,
      });

      expect(capturedPayload?.state).toBe('colorado');
      expect(capturedPayload?.state).not.toBe('Colorado');
    });

    it('should send lowercase state in payload for "OREGON"', async () => {
      const { calculateEPR } = await import('./api');

      await calculateEPR({
        state: 'OREGON',
        material_category: 'glass_and_ceramics',
        sub_category: 'ceramic_all_forms',
        weight_lbs: 100,
      });

      expect(capturedPayload?.state).toBe('oregon');
      expect(capturedPayload?.state).not.toBe('OREGON');
    });

    it('should send lowercase state in payload for " Oregon " (with whitespace)', async () => {
      const { calculateEPR } = await import('./api');

      await calculateEPR({
        state: ' Oregon ',
        material_category: 'glass_and_ceramics',
        sub_category: 'ceramic_all_forms',
        weight_lbs: 100,
      });

      expect(capturedPayload?.state).toBe('oregon');
    });
  });
});
