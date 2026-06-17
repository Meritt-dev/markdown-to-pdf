import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Pool } from "pg";

vi.mock("pg", () => {
  const Pool = vi.fn();
  Pool.prototype.query = vi.fn();
  Pool.prototype.connect = vi.fn();
  Pool.prototype.end = vi.fn();
  return { Pool };
});

/**
 * Note: This test file provides basic smoke tests for the pool module.
 * The pool module manages a singleton connection that requires a real database
 * for full integration testing. These tests verify the module structure without
 * requiring a live Postgres instance.
 *
 * For integration tests with real database, see separate integration test suite.
 */
describe("db pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should export getPool function", async () => {
    const poolModule = await import("./pool");
    expect(typeof poolModule.getPool).toBe("function");
  });

  it("should throw error when DATABASE_URL is missing", async () => {
    const originalEnv = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    vi.resetModules();
    const { getPool } = await import("./pool");

    await expect(getPool()).rejects.toThrow();

    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    }
  });

  it("should use DATABASE_URL from environment", async () => {
    const originalEnv = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";

    vi.resetModules();

    const { Pool } = await import("pg");
    const { getPool } = await import("./pool");

    try {
      await getPool();
    } catch {
      // Expected to fail without real DB, but Pool should be called
    }

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgresql://test:test@localhost:5432/testdb",
      })
    );

    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("should create pool instance", async () => {
    const originalEnv = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";

    vi.resetModules();

    const { Pool } = await import("pg");
    const { getPool } = await import("./pool");

    try {
      await getPool();
    } catch {
      // Expected to fail without real DB
    }

    expect(Pool).toHaveBeenCalled();

    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });
});
