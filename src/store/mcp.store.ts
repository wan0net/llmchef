import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";
import { emitter } from "@/lib/llmchef/event-emitter";
import { mcpEvent } from "@/types/llmchef/events/mcp.events";
import type { RegisteredActionHandler } from "@/types/llmchef/control";

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
  description?: string;
}

export interface McpPackageImport {
  id: string;
  name: string;
  packageName: string;
  command: "npx" | "npm exec";
  args: string[];
  envKeys: string[];
  source: "command" | "json";
  sourceLabel?: string;
  endpointUrl?: string;
  warnings: string[];
  createdAt: Date;
}

export interface McpPackageRuntimeInstall {
  id: string;
  packageImportId: string;
  packageName: string;
  entryUrl: string;
  registryBaseUrl: string;
  vfsRoot: string;
  moduleCount: number;
  moduleUrls: string[];
  moduleHashes: Record<string, string>;
  installedAt: Date;
  runnable: boolean;
  detectedTools?: string[];
  lastProbeAt?: Date;
  lastProbeOk?: boolean;
  lastProbeMessage?: string;
  warnings: string[];
}

export interface McpServerStatus {
  serverId: string;
  connected: boolean;
  error?: string;
  lastConnected?: Date;
  toolCount: number;
  tools: string[];
}

export interface McpState {
  servers: McpServerConfig[];
  packageImports: McpPackageImport[];
  packageRuntimeInstalls: McpPackageRuntimeInstall[];
  serverStatuses: Record<string, McpServerStatus>;
  loading: boolean;
  error: string | null;
  // Connection settings
  retryAttempts: number;
  retryDelay: number;
  connectionTimeout: number;
  packageRuntimeRegistryUrl: string;
  // Tool response settings
  maxResponseSize: number;
}

export interface McpActions {
  // Server Management
  setServers: (servers: McpServerConfig[]) => void;
  addServer: (server: Omit<McpServerConfig, 'id'>) => void;
  updateServer: (id: string, updates: Partial<McpServerConfig>) => void;
  deleteServer: (id: string) => void;
  addPackageImports: (imports: Array<Omit<McpPackageImport, 'id' | 'createdAt'>>) => void;
  deletePackageImport: (id: string) => void;
  upsertPackageRuntimeInstall: (install: McpPackageRuntimeInstall) => void;
  
  // Connection Management
  setServerStatus: (status: McpServerStatus) => void;
  clearServerStatus: (serverId: string) => void;
  
  // Connection Settings
  setRetryAttempts: (attempts: number) => void;
  setRetryDelay: (delay: number) => void;
  setConnectionTimeout: (timeout: number) => void;
  setPackageRuntimeRegistryUrl: (url: string) => void;
  
  // Tool Response Settings
  setMaxResponseSize: (size: number) => void;
  
  // State Management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadMcpState: () => Promise<void>;
  resetMcpState: () => void;
  
  // Event Integration
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
  
  // Proxy Configuration Export
  exportProxyConfig: () => void;
}

// Default constants
const DEFAULT_MCP_RETRY_ATTEMPTS = 3;
const DEFAULT_MCP_RETRY_DELAY = 2000; // 2 seconds
const DEFAULT_MCP_CONNECTION_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MCP_MAX_RESPONSE_SIZE = 128000; // 128KB - much more generous default
const DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL = "https://esm.sh";

const defaultMcpState: McpState = {
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
};

export const useMcpStore = create(
  immer<McpState & McpActions>((set, get) => ({
    ...defaultMcpState,

    // Server Management Actions
    setServers: (servers: McpServerConfig[]) => {
      set((state) => {
        state.servers = servers;
        state.error = null;
      });
      
      // Persist to storage
      PersistenceService.saveSetting("mcpServers", servers).catch((error: any) => {
        console.error("Failed to persist MCP servers:", error);
      });
      
      // Emit change event
      emitter.emit(mcpEvent.serversChanged, { servers });
    },

    addServer: (serverData: Omit<McpServerConfig, 'id'>) => {
      const server: McpServerConfig = {
        ...serverData,
        id: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      
      set((state) => {
        state.servers.push(server);
        state.error = null;
      });
      
      const updatedServers = get().servers;
      
      // Persist to storage
      PersistenceService.saveSetting("mcpServers", updatedServers).catch((error: any) => {
        console.error("Failed to persist MCP servers:", error);
      });
      
      // Emit events
      emitter.emit(mcpEvent.serverAdded, { server });
      emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
    },

    updateServer: (id: string, updates: Partial<McpServerConfig>) => {
      let updatedServer: McpServerConfig | null = null;
      
      set((state) => {
        const serverIndex = state.servers.findIndex(s => s.id === id);
        if (serverIndex !== -1) {
          state.servers[serverIndex] = { ...state.servers[serverIndex], ...updates };
          updatedServer = state.servers[serverIndex];
          state.error = null;
        }
      });
      
      if (updatedServer) {
        const updatedServers = get().servers;
        
        // Persist to storage
        PersistenceService.saveSetting("mcpServers", updatedServers).catch((error: any) => {
          console.error("Failed to persist MCP servers:", error);
        });
        
        // Emit events
        emitter.emit(mcpEvent.serverUpdated, { server: updatedServer });
        emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
      }
    },

    deleteServer: (id: string) => {
      set((state) => {
        state.servers = state.servers.filter(s => s.id !== id);
        delete state.serverStatuses[id];
        state.error = null;
      });
      
      const updatedServers = get().servers;
      
      // Persist to storage
      PersistenceService.saveSetting("mcpServers", updatedServers).catch((error: any) => {
        console.error("Failed to persist MCP servers:", error);
      });
      
      // Emit events
      emitter.emit(mcpEvent.serverDeleted, { serverId: id });
      emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
    },

    addPackageImports: (imports) => {
      const createdAt = new Date();
      const newImports: McpPackageImport[] = imports.map((item) => ({
        ...item,
        id: `mcp_pkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt,
      }));

      set((state) => {
        state.packageImports.push(...newImports);
        state.error = null;
      });

      PersistenceService.saveSetting("mcpPackageImports", get().packageImports).catch((error: any) => {
        console.error("Failed to persist MCP package imports:", error);
      });

      emitter.emit(mcpEvent.packageImportsChanged, { imports: get().packageImports });
    },

    deletePackageImport: (id) => {
      set((state) => {
        state.packageImports = state.packageImports.filter((item) => item.id !== id);
        state.packageRuntimeInstalls = state.packageRuntimeInstalls.filter((item) => item.packageImportId !== id);
      });

      Promise.all([
        PersistenceService.saveSetting("mcpPackageImports", get().packageImports),
        PersistenceService.saveSetting("mcpPackageRuntimeInstalls", get().packageRuntimeInstalls),
      ]).catch((error: any) => {
        console.error("Failed to persist MCP package import state:", error);
      });

      emitter.emit(mcpEvent.packageImportsChanged, { imports: get().packageImports });
    },

    upsertPackageRuntimeInstall: (install) => {
      const normalizedInstall = {
        ...install,
        installedAt: install.installedAt ? new Date(install.installedAt) : new Date(),
      };

      set((state) => {
        const index = state.packageRuntimeInstalls.findIndex((item) => item.id === normalizedInstall.id);
        if (index === -1) {
          state.packageRuntimeInstalls.push(normalizedInstall);
        } else {
          state.packageRuntimeInstalls[index] = normalizedInstall;
        }
        state.error = null;
      });

      PersistenceService.saveSetting("mcpPackageRuntimeInstalls", get().packageRuntimeInstalls).catch((error: any) => {
        console.error("Failed to persist MCP package runtime installs:", error);
      });
      emitter.emit(mcpEvent.packageRuntimeInstallsChanged, { installs: get().packageRuntimeInstalls });
    },

    // Connection Management Actions
    setServerStatus: (status: McpServerStatus) => {
      set((state) => {
        state.serverStatuses[status.serverId] = status;
      });
      
      // Emit events
      emitter.emit(mcpEvent.serverConnectionChanged, {
        serverId: status.serverId,
        connected: status.connected,
        error: status.error,
      });
      
      if (status.tools.length > 0) {
        emitter.emit(mcpEvent.toolsChanged, {
          serverId: status.serverId,
          tools: status.tools,
        });
      }
    },

    clearServerStatus: (serverId: string) => {
      set((state) => {
        delete state.serverStatuses[serverId];
      });
      
      emitter.emit(mcpEvent.serverConnectionChanged, {
        serverId,
        connected: false,
      });
    },

    // Connection Settings Actions
    setRetryAttempts: (attempts: number) => {
      const clampedAttempts = Math.max(0, Math.min(10, attempts));
      set((state) => {
        state.retryAttempts = clampedAttempts;
      });
      
      PersistenceService.saveSetting("mcpRetryAttempts", clampedAttempts).catch((error: any) => {
        console.error("Failed to persist MCP retry attempts:", error);
      });
      
      emitter.emit(mcpEvent.retryAttemptsChanged, { attempts: clampedAttempts });
    },

    setRetryDelay: (delay: number) => {
      const clampedDelay = Math.max(500, Math.min(30000, delay));
      set((state) => {
        state.retryDelay = clampedDelay;
      });
      
      PersistenceService.saveSetting("mcpRetryDelay", clampedDelay).catch((error: any) => {
        console.error("Failed to persist MCP retry delay:", error);
      });
      
      emitter.emit(mcpEvent.retryDelayChanged, { delay: clampedDelay });
    },

    setConnectionTimeout: (timeout: number) => {
      const clampedTimeout = Math.max(1000, Math.min(60000, timeout));
      set((state) => {
        state.connectionTimeout = clampedTimeout;
      });
      
      PersistenceService.saveSetting("mcpConnectionTimeout", clampedTimeout).catch((error: any) => {
        console.error("Failed to persist MCP connection timeout:", error);
      });
      
      emitter.emit(mcpEvent.connectionTimeoutChanged, { timeout: clampedTimeout });
    },

    setPackageRuntimeRegistryUrl: (url: string) => {
      let normalized: string;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error("Registry URL must use HTTP(S).");
        }
        normalized = `${parsed.protocol}//${parsed.host}`;
      } catch {
        set((state) => {
          state.error = "MCP package registry URL must be a valid HTTP(S) URL.";
        });
        return;
      }

      set((state) => {
        state.packageRuntimeRegistryUrl = normalized;
        state.error = null;
      });

      PersistenceService.saveSetting("mcpPackageRuntimeRegistryUrl", normalized).catch((error: any) => {
        console.error("Failed to persist MCP package runtime registry URL:", error);
      });
      emitter.emit(mcpEvent.packageRuntimeRegistryUrlChanged, { url: normalized });
    },

    setMaxResponseSize: (size: number) => {
      const clampedSize = Math.max(1000, Math.min(10000000, size)); // 1KB to 10MB range
      set((state) => {
        state.maxResponseSize = clampedSize;
      });
      
      PersistenceService.saveSetting("mcpMaxResponseSize", clampedSize).catch((error: any) => {
        console.error("Failed to persist MCP max response size:", error);
      });
      
      emitter.emit(mcpEvent.maxResponseSizeChanged, { size: clampedSize });
    },

    // State Management Actions
    setLoading: (loading: boolean) => {
      set((state) => {
        state.loading = loading;
      });
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error;
      });
    },

    loadMcpState: async () => {
      try {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        // Load all MCP settings from persistence
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
          PersistenceService.loadSetting<McpPackageRuntimeInstall[]>("mcpPackageRuntimeInstalls", []),
          PersistenceService.loadSetting<number>("mcpRetryAttempts", DEFAULT_MCP_RETRY_ATTEMPTS),
          PersistenceService.loadSetting<number>("mcpRetryDelay", DEFAULT_MCP_RETRY_DELAY),
          PersistenceService.loadSetting<number>("mcpConnectionTimeout", DEFAULT_MCP_CONNECTION_TIMEOUT),
          PersistenceService.loadSetting<string>("mcpPackageRuntimeRegistryUrl", DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL),
          PersistenceService.loadSetting<number>("mcpMaxResponseSize", DEFAULT_MCP_MAX_RESPONSE_SIZE),
        ]);
        
        set((state) => {
          state.servers = servers || [];
          state.packageImports = (packageImports || []).map((item) => ({
            ...item,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          }));
          state.packageRuntimeInstalls = (packageRuntimeInstalls || []).map((item) => ({
            ...item,
            moduleUrls: item.moduleUrls ?? [],
            moduleHashes: item.moduleHashes ?? {},
            installedAt: item.installedAt ? new Date(item.installedAt) : new Date(),
            lastProbeAt: item.lastProbeAt ? new Date(item.lastProbeAt) : undefined,
          }));
          state.retryAttempts = retryAttempts;
          state.retryDelay = retryDelay;
          state.connectionTimeout = connectionTimeout;
          state.packageRuntimeRegistryUrl = packageRuntimeRegistryUrl || DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL;
          state.maxResponseSize = maxResponseSize;
          state.loading = false;
        });

        // Emit change events
        emitter.emit(mcpEvent.serversChanged, { servers: servers || [] });
        emitter.emit(mcpEvent.packageImportsChanged, { imports: get().packageImports });
        emitter.emit(mcpEvent.packageRuntimeInstallsChanged, { installs: get().packageRuntimeInstalls });
        emitter.emit(mcpEvent.retryAttemptsChanged, { attempts: retryAttempts });
        emitter.emit(mcpEvent.retryDelayChanged, { delay: retryDelay });
        emitter.emit(mcpEvent.connectionTimeoutChanged, { timeout: connectionTimeout });
        emitter.emit(mcpEvent.packageRuntimeRegistryUrlChanged, { url: get().packageRuntimeRegistryUrl });
        emitter.emit(mcpEvent.maxResponseSizeChanged, { size: maxResponseSize });
        
      } catch (error: any) {
        console.error("Failed to load MCP state:", error);
        set((state) => {
          state.error = error.message || "Failed to load MCP state";
          state.loading = false;
        });
      }
    },

    resetMcpState: () => {
      set((state) => {
        state.servers = [];
        state.packageImports = [];
        state.packageRuntimeInstalls = [];
        state.serverStatuses = {};
        state.retryAttempts = DEFAULT_MCP_RETRY_ATTEMPTS;
        state.retryDelay = DEFAULT_MCP_RETRY_DELAY;
        state.connectionTimeout = DEFAULT_MCP_CONNECTION_TIMEOUT;
        state.packageRuntimeRegistryUrl = DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL;
        state.maxResponseSize = DEFAULT_MCP_MAX_RESPONSE_SIZE;
        state.loading = false;
        state.error = null;
      });
      
      // Clear persistence
      Promise.all([
        PersistenceService.saveSetting("mcpServers", []),
        PersistenceService.saveSetting("mcpPackageImports", []),
        PersistenceService.saveSetting("mcpPackageRuntimeInstalls", []),
        PersistenceService.saveSetting("mcpRetryAttempts", DEFAULT_MCP_RETRY_ATTEMPTS),
        PersistenceService.saveSetting("mcpRetryDelay", DEFAULT_MCP_RETRY_DELAY),
        PersistenceService.saveSetting("mcpConnectionTimeout", DEFAULT_MCP_CONNECTION_TIMEOUT),
        PersistenceService.saveSetting("mcpPackageRuntimeRegistryUrl", DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL),
        PersistenceService.saveSetting("mcpMaxResponseSize", DEFAULT_MCP_MAX_RESPONSE_SIZE),
      ]).catch((error: any) => {
        console.error("Failed to clear MCP settings from storage:", error);
      });
      
      // Emit change events
      emitter.emit(mcpEvent.serversChanged, { servers: [] });
      emitter.emit(mcpEvent.packageImportsChanged, { imports: [] });
      emitter.emit(mcpEvent.packageRuntimeInstallsChanged, { installs: [] });
      emitter.emit(mcpEvent.retryAttemptsChanged, { attempts: DEFAULT_MCP_RETRY_ATTEMPTS });
      emitter.emit(mcpEvent.retryDelayChanged, { delay: DEFAULT_MCP_RETRY_DELAY });
      emitter.emit(mcpEvent.connectionTimeoutChanged, { timeout: DEFAULT_MCP_CONNECTION_TIMEOUT });
      emitter.emit(mcpEvent.packageRuntimeRegistryUrlChanged, { url: DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL });
      emitter.emit(mcpEvent.maxResponseSizeChanged, { size: DEFAULT_MCP_MAX_RESPONSE_SIZE });
    },

    // Event Integration
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const actions = get();
      return [
        {
          eventName: mcpEvent.setServersRequest,
          handler: (payload: { servers: McpServerConfig[] }) => 
            actions.setServers(payload.servers),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.addServerRequest,
          handler: (payload: { server: Omit<McpServerConfig, 'id'> }) => 
            actions.addServer(payload.server),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.updateServerRequest,
          handler: (payload: { id: string; updates: Partial<McpServerConfig> }) => 
            actions.updateServer(payload.id, payload.updates),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.deleteServerRequest,
          handler: (payload: { id: string }) => 
            actions.deleteServer(payload.id),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setRetryAttemptsRequest,
          handler: (payload: { attempts: number }) => 
            actions.setRetryAttempts(payload.attempts),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setRetryDelayRequest,
          handler: (payload: { delay: number }) => 
            actions.setRetryDelay(payload.delay),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setConnectionTimeoutRequest,
          handler: (payload: { timeout: number }) => 
            actions.setConnectionTimeout(payload.timeout),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.setMaxResponseSizeRequest,
          handler: (payload: { size: number }) => 
            actions.setMaxResponseSize(payload.size),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.loadMcpStateRequest,
          handler: () => actions.loadMcpState(),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.resetMcpStateRequest,
          handler: () => actions.resetMcpState(),
          storeId: "mcpStore",
        },
      ];
    },

    // Proxy Configuration Export
    exportProxyConfig: () => {
      const servers = get().servers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        enabled: server.enabled,
      }));
      return servers;
    },
  }))
);
