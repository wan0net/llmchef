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
  retryAttempts: number;
  retryDelay: number;
  connectionTimeout: number;
  packageRuntimeRegistryUrl: string;
  maxResponseSize: number;
}

export type McpPersistedState = Pick<
  McpState,
  | "servers"
  | "packageImports"
  | "packageRuntimeInstalls"
  | "retryAttempts"
  | "retryDelay"
  | "connectionTimeout"
  | "packageRuntimeRegistryUrl"
  | "maxResponseSize"
>;
