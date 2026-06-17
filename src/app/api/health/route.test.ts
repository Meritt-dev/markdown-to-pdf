import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, QueryResult } from "pg";
import { GET } from "./route";

vi.mock("@/lib/db/pool");
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("GET /api/health", () => {
  let mockPool: Partial<Pool>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockPool = {
      query: vi.fn(),
    };

    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const { getPool } = await import("@/lib/db/pool");
    vi.mocked(getPool).mockResolvedValue(mockPool as Pool);

    process.env.GOTENBERG_URL = "http://gotenberg:3000";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should return 200 with ok status when all services are healthy", async () => {
    const mockResult: QueryResult = {
      rows: [{ health: 1 }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    };

    (mockPool.query as any).mockResolvedValue(mockResult);
    mockFetch.mockResolvedValue({ ok: true });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: "ok",
      postgres: true,
      gotenberg: true,
    });
  });

  it("should return 503 when postgres fails", async () => {
    (mockPool.query as any).mockRejectedValue(new Error("Connection failed"));
    mockFetch.mockResolvedValue({ ok: true });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      status: "degraded",
      postgres: false,
      gotenberg: true,
    });
  });

  it("should return 503 when gotenberg fails", async () => {
    const mockResult: QueryResult = {
      rows: [{ health: 1 }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    };

    (mockPool.query as any).mockResolvedValue(mockResult);
    mockFetch.mockRejectedValue(new Error("Gotenberg unreachable"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      status: "degraded",
      postgres: true,
      gotenberg: false,
    });
  });

  it("should return 503 when both services fail", async () => {
    (mockPool.query as any).mockRejectedValue(new Error("Connection failed"));
    mockFetch.mockRejectedValue(new Error("Gotenberg unreachable"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      status: "degraded",
      postgres: false,
      gotenberg: false,
    });
  });

  it("should return false for gotenberg when GOTENBERG_URL not configured", async () => {
    delete process.env.GOTENBERG_URL;

    const mockResult: QueryResult = {
      rows: [{ health: 1 }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    };

    (mockPool.query as any).mockResolvedValue(mockResult);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      status: "degraded",
      postgres: true,
      gotenberg: false,
    });
  });

  it("should return false when postgres returns unexpected data", async () => {
    const mockResult: QueryResult = {
      rows: [{ health: 0 }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    };

    (mockPool.query as any).mockResolvedValue(mockResult);
    mockFetch.mockResolvedValue({ ok: true });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      status: "degraded",
      postgres: false,
      gotenberg: true,
    });
  });

  it("should timeout gotenberg check after 5 seconds", async () => {
    const mockResult: QueryResult = {
      rows: [{ health: 1 }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    };

    (mockPool.query as any).mockResolvedValue(mockResult);
    mockFetch.mockImplementation((_url, options) => {
      expect(options?.signal).toBeDefined();
      throw new Error("Timeout");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.gotenberg).toBe(false);
  });
});
