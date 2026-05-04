import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSetting: vi.fn(),
  saveSetting: vi.fn(),
}));

vi.mock("./persistence.service", () => ({
  PersistenceService: {
    loadSetting: mocks.loadSetting,
    saveSetting: mocks.saveSetting,
  },
}));

import {
  createDefaultMcpState,
  DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
  McpPersistenceService,
  normalizeMcpPackageRegistryUrl,
} from "./mcp-persistence.service";

describe("mcp persistence service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the expected default MCP state", () => {
    const state = createDefaultMcpState();

    expect(state).toMatchObject({
      servers: [],
      packageImports: [],
      packageRuntimeInstalls: [],
      serverStatuses: {},
      loading: false,
      error: null,
      packageRuntimeRegistryUrl: DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
    });
  });

  it("normalizes registry urls and rejects insecure remote http registries", () => {
    expect(normalizeMcpPackageRegistryUrl("https://esm.sh/some/path")).toBe(
      "https://esm.sh",
    );
    expect(normalizeMcpPackageRegistryUrl("http://127.0.0.1:8080/pkg")).toBe(
      "http://127.0.0.1:8080",
    );
    expect(() => normalizeMcpPackageRegistryUrl("http://example.com/pkg")).toThrow(
      /localhost/i,
    );
  });

  it("hydrates persisted state and restores Date fields", async () => {
    mocks.loadSetting
      .mockResolvedValueOnce([
        { id: "srv-1", name: "srv", url: "https://srv", enabled: true },
      ])
      .mockResolvedValueOnce([
        {
          id: "pkg-1",
          name: "Example",
          packageName: "@demo/example",
          command: "npx",
          args: [],
          envKeys: [],
          source: "json",
          warnings: [],
          createdAt: "2026-01-02T03:04:05.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "install-1",
          packageImportId: "pkg-1",
          packageName: "@demo/example",
          entryUrl: "https://esm.sh/mod.js",
          registryBaseUrl: "https://esm.sh",
          vfsRoot: "/mcp/example",
          moduleCount: 1,
          installedAt: "2026-01-02T03:04:05.000Z",
          runnable: true,
          lastProbeAt: "2026-01-03T03:04:05.000Z",
          warnings: [],
        },
      ])
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2500)
      .mockResolvedValueOnce(9000)
      .mockResolvedValueOnce("https://cdn.example.com/path")
      .mockResolvedValueOnce(64000);

    const state = await McpPersistenceService.loadPersistedState();

    expect(state.retryAttempts).toBe(7);
    expect(state.retryDelay).toBe(2500);
    expect(state.connectionTimeout).toBe(9000);
    expect(state.packageRuntimeRegistryUrl).toBe("https://cdn.example.com/path");
    expect(state.maxResponseSize).toBe(64000);
    expect(state.packageImports[0]?.createdAt).toBeInstanceOf(Date);
    expect(state.packageRuntimeInstalls[0]?.installedAt).toBeInstanceOf(Date);
    expect(state.packageRuntimeInstalls[0]?.lastProbeAt).toBeInstanceOf(Date);
    expect(state.packageRuntimeInstalls[0]?.moduleUrls).toEqual([]);
    expect(state.packageRuntimeInstalls[0]?.moduleHashes).toEqual({});
  });

  it("resets persisted state back to defaults", async () => {
    mocks.saveSetting.mockResolvedValue(undefined);

    const state = await McpPersistenceService.resetPersistedState();

    expect(mocks.saveSetting).toHaveBeenCalledTimes(8);
    expect(state).toMatchObject({
      servers: [],
      packageImports: [],
      packageRuntimeInstalls: [],
      packageRuntimeRegistryUrl: DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
    });
  });
});
