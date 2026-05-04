import { PersistenceService } from "@/services/persistence.service";
import type {
  McpPackageImport,
  McpPackageRuntimeInstall,
  McpPersistedState,
  McpServerConfig,
  McpState,
} from "@/types/llmchef/mcp";

export const DEFAULT_MCP_RETRY_ATTEMPTS = 3;
export const DEFAULT_MCP_RETRY_DELAY = 2000;
export const DEFAULT_MCP_CONNECTION_TIMEOUT = 10000;
export const DEFAULT_MCP_MAX_RESPONSE_SIZE = 128000;
export const DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL = "https://esm.sh";

const isLoopbackRegistryHost = (host: string): boolean =>
  host === "localhost" ||
  host.startsWith("localhost:") ||
  host === "127.0.0.1" ||
  host.startsWith("127.") ||
  host.startsWith("[::1]");

const toDate = (value: Date | string | undefined, fallback: Date): Date => {
  if (!value) return fallback;
  return value instanceof Date ? value : new Date(value);
};

export const normalizeMcpPackageRegistryUrl = (value: string): string => {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Registry URL must use HTTP(S).");
  }
  if (parsed.protocol === "http:" && !isLoopbackRegistryHost(parsed.host)) {
    throw new Error("HTTP package registries are only allowed on localhost.");
  }
  return `${parsed.protocol}//${parsed.host}`;
};

export const createDefaultMcpState = (): McpState => ({
  servers: [],
  packageImports: [],
  packageRuntimeInstalls: [],
  serverStatuses: {},
  loading: false,
  error: null,
  retryAttempts: DEFAULT_MCP_RETRY_ATTEMPTS,
  retryDelay: DEFAULT_MCP_RETRY_DELAY,
  connectionTimeout: DEFAULT_MCP_CONNECTION_TIMEOUT,
  packageRuntimeRegistryUrl: DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
  maxResponseSize: DEFAULT_MCP_MAX_RESPONSE_SIZE,
});

export class McpPersistenceService {
  static async saveServers(servers: McpServerConfig[]): Promise<void> {
    await PersistenceService.saveSetting("mcpServers", servers);
  }

  static async savePackageImports(packageImports: McpPackageImport[]): Promise<void> {
    await PersistenceService.saveSetting("mcpPackageImports", packageImports);
  }

  static async savePackageRuntimeInstalls(
    packageRuntimeInstalls: McpPackageRuntimeInstall[],
  ): Promise<void> {
    await PersistenceService.saveSetting(
      "mcpPackageRuntimeInstalls",
      packageRuntimeInstalls,
    );
  }

  static async saveRetryAttempts(retryAttempts: number): Promise<void> {
    await PersistenceService.saveSetting("mcpRetryAttempts", retryAttempts);
  }

  static async saveRetryDelay(retryDelay: number): Promise<void> {
    await PersistenceService.saveSetting("mcpRetryDelay", retryDelay);
  }

  static async saveConnectionTimeout(connectionTimeout: number): Promise<void> {
    await PersistenceService.saveSetting(
      "mcpConnectionTimeout",
      connectionTimeout,
    );
  }

  static async savePackageRuntimeRegistryUrl(url: string): Promise<void> {
    await PersistenceService.saveSetting("mcpPackageRuntimeRegistryUrl", url);
  }

  static async saveMaxResponseSize(maxResponseSize: number): Promise<void> {
    await PersistenceService.saveSetting("mcpMaxResponseSize", maxResponseSize);
  }

  static async savePersistedState(state: McpPersistedState): Promise<void> {
    await Promise.all([
      this.saveServers(state.servers),
      this.savePackageImports(state.packageImports),
      this.savePackageRuntimeInstalls(state.packageRuntimeInstalls),
      this.saveRetryAttempts(state.retryAttempts),
      this.saveRetryDelay(state.retryDelay),
      this.saveConnectionTimeout(state.connectionTimeout),
      this.savePackageRuntimeRegistryUrl(state.packageRuntimeRegistryUrl),
      this.saveMaxResponseSize(state.maxResponseSize),
    ]);
  }

  static async loadPersistedState(): Promise<McpPersistedState> {
    const [
      servers,
      packageImports,
      packageRuntimeInstalls,
      retryAttempts,
      retryDelay,
      connectionTimeout,
      packageRuntimeRegistryUrl,
      maxResponseSize,
    ] = await Promise.all([
      PersistenceService.loadSetting<McpServerConfig[]>("mcpServers", []),
      PersistenceService.loadSetting<McpPackageImport[]>("mcpPackageImports", []),
      PersistenceService.loadSetting<McpPackageRuntimeInstall[]>(
        "mcpPackageRuntimeInstalls",
        [],
      ),
      PersistenceService.loadSetting<number>(
        "mcpRetryAttempts",
        DEFAULT_MCP_RETRY_ATTEMPTS,
      ),
      PersistenceService.loadSetting<number>(
        "mcpRetryDelay",
        DEFAULT_MCP_RETRY_DELAY,
      ),
      PersistenceService.loadSetting<number>(
        "mcpConnectionTimeout",
        DEFAULT_MCP_CONNECTION_TIMEOUT,
      ),
      PersistenceService.loadSetting<string>(
        "mcpPackageRuntimeRegistryUrl",
        DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
      ),
      PersistenceService.loadSetting<number>(
        "mcpMaxResponseSize",
        DEFAULT_MCP_MAX_RESPONSE_SIZE,
      ),
    ]);

    return {
      servers: servers ?? [],
      packageImports: (packageImports ?? []).map((item) => ({
        ...item,
        createdAt: toDate(item.createdAt, new Date()),
      })),
      packageRuntimeInstalls: (packageRuntimeInstalls ?? []).map((item) => ({
        ...item,
        moduleUrls: item.moduleUrls ?? [],
        moduleHashes: item.moduleHashes ?? {},
        installedAt: toDate(item.installedAt, new Date()),
        lastProbeAt: item.lastProbeAt
          ? toDate(item.lastProbeAt, new Date())
          : undefined,
      })),
      retryAttempts,
      retryDelay,
      connectionTimeout,
      packageRuntimeRegistryUrl:
        packageRuntimeRegistryUrl || DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
      maxResponseSize,
    };
  }

  static async resetPersistedState(): Promise<McpPersistedState> {
    const resetState: McpPersistedState = {
      servers: [],
      packageImports: [],
      packageRuntimeInstalls: [],
      retryAttempts: DEFAULT_MCP_RETRY_ATTEMPTS,
      retryDelay: DEFAULT_MCP_RETRY_DELAY,
      connectionTimeout: DEFAULT_MCP_CONNECTION_TIMEOUT,
      packageRuntimeRegistryUrl: DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
      maxResponseSize: DEFAULT_MCP_MAX_RESPONSE_SIZE,
    };

    await this.savePersistedState(resetState);
    return resetState;
  }
}
