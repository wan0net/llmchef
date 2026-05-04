import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/llmchef/event-emitter";
import {
  createDefaultMcpState,
  DEFAULT_MCP_CONNECTION_TIMEOUT,
  DEFAULT_MCP_MAX_RESPONSE_SIZE,
  DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
  DEFAULT_MCP_RETRY_ATTEMPTS,
  DEFAULT_MCP_RETRY_DELAY,
  McpPersistenceService,
  normalizeMcpPackageRegistryUrl,
} from "@/services/mcp-persistence.service";
import type { RegisteredActionHandler } from "@/types/llmchef/control";
import { mcpEvent } from "@/types/llmchef/events/mcp.events";
import type {
  McpPackageImport,
  McpPackageRuntimeInstall,
  McpServerConfig,
  McpServerStatus,
  McpState,
} from "@/types/llmchef/mcp";

export type {
  McpPackageImport,
  McpPackageRuntimeInstall,
  McpServerConfig,
  McpServerStatus,
  McpState,
} from "@/types/llmchef/mcp";

export interface McpActions {
  setServers: (servers: McpServerConfig[]) => void;
  addServer: (server: Omit<McpServerConfig, "id">) => void;
  updateServer: (id: string, updates: Partial<McpServerConfig>) => void;
  deleteServer: (id: string) => void;
  addPackageImports: (
    imports: Array<Omit<McpPackageImport, "id" | "createdAt">>,
  ) => void;
  deletePackageImport: (id: string) => void;
  upsertPackageRuntimeInstall: (install: McpPackageRuntimeInstall) => void;
  setServerStatus: (status: McpServerStatus) => void;
  clearServerStatus: (serverId: string) => void;
  setRetryAttempts: (attempts: number) => void;
  setRetryDelay: (delay: number) => void;
  setConnectionTimeout: (timeout: number) => void;
  setPackageRuntimeRegistryUrl: (url: string) => void;
  setMaxResponseSize: (size: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadMcpState: () => Promise<void>;
  resetMcpState: () => void;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
  exportProxyConfig: () => Array<
    Pick<McpServerConfig, "id" | "name" | "url" | "enabled">
  >;
}

const defaultMcpState: McpState = createDefaultMcpState();

const persistServers = (servers: McpServerConfig[]) => {
  McpPersistenceService.saveServers(servers).catch((error: unknown) => {
    console.error("Failed to persist MCP servers:", error);
  });
};

const persistPackageImports = (imports: McpPackageImport[]) => {
  McpPersistenceService.savePackageImports(imports).catch((error: unknown) => {
    console.error("Failed to persist MCP package imports:", error);
  });
};

const persistPackageRuntimeInstalls = (
  installs: McpPackageRuntimeInstall[],
) => {
  McpPersistenceService.savePackageRuntimeInstalls(installs).catch(
    (error: unknown) => {
      console.error("Failed to persist MCP package runtime installs:", error);
    },
  );
};

export const useMcpStore = create(
  immer<McpState & McpActions>((set, get) => ({
    ...defaultMcpState,

    setServers: (servers) => {
      set((state) => {
        state.servers = servers;
        state.error = null;
      });

      persistServers(servers);
      emitter.emit(mcpEvent.serversChanged, { servers });
    },

    addServer: (serverData) => {
      const server: McpServerConfig = {
        ...serverData,
        id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };

      set((state) => {
        state.servers.push(server);
        state.error = null;
      });

      const updatedServers = get().servers;
      persistServers(updatedServers);
      emitter.emit(mcpEvent.serverAdded, { server });
      emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
    },

    updateServer: (id, updates) => {
      let updatedServer: McpServerConfig | null = null;

      set((state) => {
        const serverIndex = state.servers.findIndex((server) => server.id === id);
        if (serverIndex !== -1) {
          state.servers[serverIndex] = {
            ...state.servers[serverIndex],
            ...updates,
          };
          updatedServer = state.servers[serverIndex];
          state.error = null;
        }
      });

      if (updatedServer) {
        const updatedServers = get().servers;
        persistServers(updatedServers);
        emitter.emit(mcpEvent.serverUpdated, { server: updatedServer });
        emitter.emit(mcpEvent.serversChanged, { servers: updatedServers });
      }
    },

    deleteServer: (id) => {
      set((state) => {
        state.servers = state.servers.filter((server) => server.id !== id);
        delete state.serverStatuses[id];
        state.error = null;
      });

      const updatedServers = get().servers;
      persistServers(updatedServers);
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

      const updatedImports = get().packageImports;
      persistPackageImports(updatedImports);
      emitter.emit(mcpEvent.packageImportsChanged, { imports: updatedImports });
    },

    deletePackageImport: (id) => {
      set((state) => {
        state.packageImports = state.packageImports.filter((item) => item.id !== id);
        state.packageRuntimeInstalls = state.packageRuntimeInstalls.filter(
          (item) => item.packageImportId !== id,
        );
      });

      const updatedImports = get().packageImports;
      const updatedInstalls = get().packageRuntimeInstalls;
      Promise.all([
        McpPersistenceService.savePackageImports(updatedImports),
        McpPersistenceService.savePackageRuntimeInstalls(updatedInstalls),
      ]).catch((error: unknown) => {
        console.error("Failed to persist MCP package import state:", error);
      });

      emitter.emit(mcpEvent.packageImportsChanged, { imports: updatedImports });
      emitter.emit(mcpEvent.packageRuntimeInstallsChanged, {
        installs: updatedInstalls,
      });
    },

    upsertPackageRuntimeInstall: (install) => {
      const normalizedInstall: McpPackageRuntimeInstall = {
        ...install,
        installedAt: install.installedAt
          ? new Date(install.installedAt)
          : new Date(),
        lastProbeAt: install.lastProbeAt
          ? new Date(install.lastProbeAt)
          : undefined,
      };

      set((state) => {
        const index = state.packageRuntimeInstalls.findIndex(
          (item) => item.id === normalizedInstall.id,
        );
        if (index === -1) {
          state.packageRuntimeInstalls.push(normalizedInstall);
        } else {
          state.packageRuntimeInstalls[index] = normalizedInstall;
        }
        state.error = null;
      });

      const updatedInstalls = get().packageRuntimeInstalls;
      persistPackageRuntimeInstalls(updatedInstalls);
      emitter.emit(mcpEvent.packageRuntimeInstallsChanged, {
        installs: updatedInstalls,
      });
    },

    setServerStatus: (status) => {
      set((state) => {
        state.serverStatuses[status.serverId] = status;
      });

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

    clearServerStatus: (serverId) => {
      set((state) => {
        delete state.serverStatuses[serverId];
      });

      emitter.emit(mcpEvent.serverConnectionChanged, {
        serverId,
        connected: false,
      });
    },

    setRetryAttempts: (attempts) => {
      const clampedAttempts = Math.max(0, Math.min(10, attempts));
      set((state) => {
        state.retryAttempts = clampedAttempts;
      });

      McpPersistenceService.saveRetryAttempts(clampedAttempts).catch(
        (error: unknown) => {
          console.error("Failed to persist MCP retry attempts:", error);
        },
      );

      emitter.emit(mcpEvent.retryAttemptsChanged, { attempts: clampedAttempts });
    },

    setRetryDelay: (delay) => {
      const clampedDelay = Math.max(500, Math.min(30000, delay));
      set((state) => {
        state.retryDelay = clampedDelay;
      });

      McpPersistenceService.saveRetryDelay(clampedDelay).catch(
        (error: unknown) => {
          console.error("Failed to persist MCP retry delay:", error);
        },
      );

      emitter.emit(mcpEvent.retryDelayChanged, { delay: clampedDelay });
    },

    setConnectionTimeout: (timeout) => {
      const clampedTimeout = Math.max(1000, Math.min(60000, timeout));
      set((state) => {
        state.connectionTimeout = clampedTimeout;
      });

      McpPersistenceService.saveConnectionTimeout(clampedTimeout).catch(
        (error: unknown) => {
          console.error("Failed to persist MCP connection timeout:", error);
        },
      );

      emitter.emit(mcpEvent.connectionTimeoutChanged, {
        timeout: clampedTimeout,
      });
    },

    setPackageRuntimeRegistryUrl: (url) => {
      let normalized: string;
      try {
        normalized = normalizeMcpPackageRegistryUrl(url);
      } catch {
        set((state) => {
          state.error =
            "MCP package registry URL must be HTTPS, or HTTP on localhost.";
        });
        return;
      }

      set((state) => {
        state.packageRuntimeRegistryUrl = normalized;
        state.error = null;
      });

      McpPersistenceService.savePackageRuntimeRegistryUrl(normalized).catch(
        (error: unknown) => {
          console.error(
            "Failed to persist MCP package runtime registry URL:",
            error,
          );
        },
      );
      emitter.emit(mcpEvent.packageRuntimeRegistryUrlChanged, { url: normalized });
    },

    setMaxResponseSize: (size) => {
      const clampedSize = Math.max(1000, Math.min(10000000, size));
      set((state) => {
        state.maxResponseSize = clampedSize;
      });

      McpPersistenceService.saveMaxResponseSize(clampedSize).catch(
        (error: unknown) => {
          console.error("Failed to persist MCP max response size:", error);
        },
      );

      emitter.emit(mcpEvent.maxResponseSizeChanged, { size: clampedSize });
    },

    setLoading: (loading) => {
      set((state) => {
        state.loading = loading;
      });
    },

    setError: (error) => {
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

        const persisted = await McpPersistenceService.loadPersistedState();

        set((state) => {
          state.servers = persisted.servers;
          state.packageImports = persisted.packageImports;
          state.packageRuntimeInstalls = persisted.packageRuntimeInstalls;
          state.retryAttempts = persisted.retryAttempts;
          state.retryDelay = persisted.retryDelay;
          state.connectionTimeout = persisted.connectionTimeout;
          state.packageRuntimeRegistryUrl = persisted.packageRuntimeRegistryUrl;
          state.maxResponseSize = persisted.maxResponseSize;
          state.loading = false;
        });

        emitter.emit(mcpEvent.serversChanged, { servers: persisted.servers });
        emitter.emit(mcpEvent.packageImportsChanged, {
          imports: persisted.packageImports,
        });
        emitter.emit(mcpEvent.packageRuntimeInstallsChanged, {
          installs: persisted.packageRuntimeInstalls,
        });
        emitter.emit(mcpEvent.retryAttemptsChanged, {
          attempts: persisted.retryAttempts,
        });
        emitter.emit(mcpEvent.retryDelayChanged, { delay: persisted.retryDelay });
        emitter.emit(mcpEvent.connectionTimeoutChanged, {
          timeout: persisted.connectionTimeout,
        });
        emitter.emit(mcpEvent.packageRuntimeRegistryUrlChanged, {
          url: persisted.packageRuntimeRegistryUrl,
        });
        emitter.emit(mcpEvent.maxResponseSizeChanged, {
          size: persisted.maxResponseSize,
        });
      } catch (error) {
        console.error("Failed to load MCP state:", error);
        set((state) => {
          state.error =
            error instanceof Error ? error.message : "Failed to load MCP state";
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
        state.packageRuntimeRegistryUrl =
          DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL;
        state.maxResponseSize = DEFAULT_MCP_MAX_RESPONSE_SIZE;
        state.loading = false;
        state.error = null;
      });

      McpPersistenceService.resetPersistedState().catch((error: unknown) => {
        console.error("Failed to clear MCP settings from storage:", error);
      });

      emitter.emit(mcpEvent.serversChanged, { servers: [] });
      emitter.emit(mcpEvent.packageImportsChanged, { imports: [] });
      emitter.emit(mcpEvent.packageRuntimeInstallsChanged, { installs: [] });
      emitter.emit(mcpEvent.retryAttemptsChanged, {
        attempts: DEFAULT_MCP_RETRY_ATTEMPTS,
      });
      emitter.emit(mcpEvent.retryDelayChanged, { delay: DEFAULT_MCP_RETRY_DELAY });
      emitter.emit(mcpEvent.connectionTimeoutChanged, {
        timeout: DEFAULT_MCP_CONNECTION_TIMEOUT,
      });
      emitter.emit(mcpEvent.packageRuntimeRegistryUrlChanged, {
        url: DEFAULT_MCP_PACKAGE_RUNTIME_REGISTRY_URL,
      });
      emitter.emit(mcpEvent.maxResponseSizeChanged, {
        size: DEFAULT_MCP_MAX_RESPONSE_SIZE,
      });
    },

    getRegisteredActionHandlers: () => {
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
          handler: (payload: { server: Omit<McpServerConfig, "id"> }) =>
            actions.addServer(payload.server),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.updateServerRequest,
          handler: (payload: {
            id: string;
            updates: Partial<McpServerConfig>;
          }) => actions.updateServer(payload.id, payload.updates),
          storeId: "mcpStore",
        },
        {
          eventName: mcpEvent.deleteServerRequest,
          handler: (payload: { id: string }) => actions.deleteServer(payload.id),
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

    exportProxyConfig: () =>
      get().servers.map((server) => ({
        id: server.id,
        name: server.name,
        url: server.url,
        enabled: server.enabled,
      })),
  })),
);
