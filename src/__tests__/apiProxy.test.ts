/**
 * API Proxy Configuration Tests
 *
 * These tests verify that API calls use RELATIVE URLs only:
 * - In development: Relative URLs are proxied by Vite to localhost:8000
 * - In production: Relative URLs are proxied by Vercel rewrites to the backend
 *
 * CRITICAL: All API calls MUST use relative paths (starting with "/").
 * Absolute URLs are FORBIDDEN because:
 * 1. They bypass Vercel rewrites in production
 * 2. They cause mixed-content errors in HTTPS iframes (Squarespace)
 *
 * The Vite dev server proxy rules are defined in vite.config.ts:
 * - /materials/** → http://localhost:8000
 * - /calculate/** → http://localhost:8000
 *
 * The Vercel production rewrites are defined in vercel.json:
 * - /materials/* → https://epr-calculator-edge-probe.onrender.com/materials/*
 * - /calculate/* → https://epr-calculator-edge-probe.onrender.com/calculate/*
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchColoradoPhase2Groups,
  calculateColoradoPhase2,
  fetchOregonGroupedMaterials,
} from "../services/api";

describe("API URL configuration", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let capturedUrls: string[] = [];

  beforeEach(() => {
    capturedUrls = [];
    // Spy on global fetch to capture URLs
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      capturedUrls.push(url);
      // Return mock response
      return Promise.resolve(
        new Response(JSON.stringify([{ group_key: "test", group_name: "Test", status: "MRL", base_rate_per_lb: 0.01 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("Colorado Phase 2 groups endpoint", () => {
    it("uses relative URL (for Vite proxy) in dev mode", async () => {
      await fetchColoradoPhase2Groups();

      expect(capturedUrls.length).toBe(1);
      const calledUrl = capturedUrls[0];

      // CRITICAL: URL must be relative (starts with /) for Vite proxy to work
      expect(calledUrl).toBe("/materials/colorado/phase2/groups");

      // Must NOT contain localhost:5173 (would indicate proxy bypass)
      expect(calledUrl).not.toContain("localhost:5173");

      // Must NOT contain http:// when using empty API_BASE_URL
      expect(calledUrl).not.toMatch(/^http:\/\/localhost:5173/);
    });

    it("constructs URL correctly with path /materials/colorado/phase2/groups", async () => {
      await fetchColoradoPhase2Groups();

      expect(capturedUrls[0]).toContain("/materials/colorado/phase2/groups");
    });
  });

  describe("Colorado Phase 2 calculate endpoint", () => {
    it("uses relative URL /calculate/colorado/phase2", async () => {
      // Reset the spy to return a calculate response
      fetchSpy.mockReset();
      capturedUrls = [];
      fetchSpy.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        capturedUrls.push(url);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              aggregated_group: "test_group",
              weight_lbs: 100,
              base_rate_per_lb: 0.01,
              base_dues: 1.0,
              after_eco_modulation: 1.0,
              after_cdphe_bonus: 1.0,
              final_payable: 1.0,
              pro_modulation_percent: 0,
              cdphe_bonus_percent: 0,
              newspaper_credit: 0,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      });

      await calculateColoradoPhase2({
        aggregated_group: "test_group",
        weight_lbs: 100,
        pro_modulation_percent: 0,
        cdphe_bonus_percent: 0,
        newspaper_credit: 0,
      });

      expect(capturedUrls.length).toBe(1);
      expect(capturedUrls[0]).toBe("/calculate/colorado/phase2");
    });
  });

  describe("Oregon endpoints", () => {
    it("uses relative URL /materials/oregon/grouped", async () => {
      // Reset the spy for Oregon response
      fetchSpy.mockReset();
      capturedUrls = [];
      fetchSpy.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        capturedUrls.push(url);
        return Promise.resolve(
          new Response(
            JSON.stringify({ state: "Oregon", categories: [] }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      });

      await fetchOregonGroupedMaterials();

      expect(capturedUrls.length).toBe(1);
      expect(capturedUrls[0]).toBe("/materials/oregon/grouped");
    });
  });
});

/**
 * Vite Proxy Configuration Validation
 *
 * These tests read and validate the vite.config.ts file.
 * If someone accidentally removes or modifies the proxy config, these tests will fail.
 */
describe("Vite proxy configuration", () => {
  it("vite.config.ts contains required proxy rules", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const configPath = path.join(process.cwd(), "vite.config.ts");
    const configContent = fs.readFileSync(configPath, "utf-8");

    // Validate /materials proxy rule exists
    expect(configContent).toContain("'/materials'");
    expect(configContent).toContain("target:");
    expect(configContent).toContain("http://localhost:8000");

    // Validate /calculate proxy rule exists
    expect(configContent).toContain("'/calculate'");

    // Validate changeOrigin is set
    expect(configContent).toContain("changeOrigin: true");
  });

  it("proxy targets the correct backend port (8000, not 5173)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const configPath = path.join(process.cwd(), "vite.config.ts");
    const configContent = fs.readFileSync(configPath, "utf-8");

    // Must target 8000 (FastAPI backend)
    expect(configContent).toContain("localhost:8000");

    // Must NOT target 5173 (Vite dev server) - that would be a loop
    expect(configContent).not.toMatch(/target:\s*['"]http:\/\/localhost:5173['"]/);
  });

  it("proxy rules cover all required API paths", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const configPath = path.join(process.cwd(), "vite.config.ts");
    const configContent = fs.readFileSync(configPath, "utf-8");

    // These paths MUST be proxied:
    // - /materials (for all material fetching)
    // - /calculate (for all fee calculations)
    const requiredProxyPaths = ["/materials", "/calculate"];

    for (const proxyPath of requiredProxyPaths) {
      expect(configContent).toContain(`'${proxyPath}'`);
    }
  });
});

/**
 * Relative URL Enforcement
 *
 * CRITICAL: The API module must NEVER use absolute URLs.
 * All API calls must use relative paths so that:
 * 1. Vercel rewrites can proxy them to the backend in production
 * 2. No mixed-content errors occur when embedded in HTTPS iframes (Squarespace)
 * 3. Vite proxy works correctly in development
 *
 * Environment variables for API URLs are FORBIDDEN.
 */
describe("Relative URL enforcement", () => {
  it("API module does NOT use VITE_API_BASE_URL (hardcoded relative paths only)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const apiPath = path.join(process.cwd(), "src/services/api.ts");
    const apiContent = fs.readFileSync(apiPath, "utf-8");

    // Must NOT use any environment variable for API base URL
    expect(apiContent).not.toContain("VITE_API_BASE_URL");
    expect(apiContent).not.toContain("import.meta.env");

    // Must NOT contain any absolute URLs to the backend
    expect(apiContent).not.toContain("onrender.com");
    expect(apiContent).not.toContain("epr-calculator-edge-probe");
  });

  it("API module uses relative paths for all fetch calls", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const apiPath = path.join(process.cwd(), "src/services/api.ts");
    const apiContent = fs.readFileSync(apiPath, "utf-8");

    // All fetch calls should use relative paths starting with "/"
    // Check that we have the expected relative endpoints
    expect(apiContent).toContain('fetch("/materials/oregon/grouped")');
    expect(apiContent).toContain('fetch("/materials/colorado/phase2/groups")');
    expect(apiContent).toContain('fetch("/calculate"');
    expect(apiContent).toContain('fetch("/calculate/colorado/phase2"');
  });

  it(".env file has VITE_API_BASE_URL empty for dev mode", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const envPath = path.join(process.cwd(), ".env");

    // .env file should exist
    expect(fs.existsSync(envPath)).toBe(true);

    const envContent = fs.readFileSync(envPath, "utf-8");

    // VITE_API_BASE_URL should be set to empty (just the key with no value or =)
    // This ensures dev mode uses the Vite proxy
    expect(envContent).toMatch(/VITE_API_BASE_URL\s*=\s*$/m);
  });
});
