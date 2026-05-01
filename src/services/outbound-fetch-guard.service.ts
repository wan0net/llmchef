import { useConversationStore } from "@/store/conversation.store";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useMcpStore } from "@/store/mcp.store";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import {
  getOutboundHost,
  isOutboundHostAllowed,
  recordOutboundRequest,
} from "@/lib/litechat/outbound-policy";
import type { DbProviderType } from "@/types/litechat/provider";

const DEFAULT_PROVIDER_HOSTS: Partial<Record<DbProviderType, string[]>> = {
  openai: ["api.openai.com"],
  openrouter: ["openrouter.ai"],
  google: ["generativelanguage.googleapis.com"],
  mistral: ["api.mistral.ai"],
  anthropic: ["api.anthropic.com"],
  xai: ["api.x.ai"],
  fal: ["fal.run"],
  replicate: ["api.replicate.com"],
  luma: ["api.lumalabs.ai"],
  deepinfra: ["api.deepinfra.com"],
  fireworks: ["api.fireworks.ai"],
};

const installedGuardMarker = Symbol.for("llmchef.outboundFetchGuardInstalled");

const addUrlHost = (hosts: Set<string>, url: string | null | undefined): void => {
  if (!url) return;
  try {
    hosts.add(getOutboundHost(url));
  } catch {
    const sshGitMatch = url.match(/^git@([^:]+):/);
    if (sshGitMatch?.[1]) {
      hosts.add(sshGitMatch[1]);
    }
  }
};

const isLocalOrSameOriginHost = (host: string): boolean => {
  const currentHost = globalThis.location?.host;
  if (currentHost && host === currentHost) return true;
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.") ||
    host.startsWith("127.0.0.1:") ||
    host === "[::1]" ||
    host.startsWith("[::1]:")
  );
};

export const getRuntimeAllowedOutboundHosts = (): string[] => {
  const hosts = new Set<string>();

  for (const provider of useProviderStore.getState().dbProviderConfigs) {
    for (const host of DEFAULT_PROVIDER_HOSTS[provider.type] ?? []) {
      hosts.add(host);
    }
    addUrlHost(hosts, provider.baseURL);
  }

  const settings = useSettingsStore.getState();
  addUrlHost(hosts, settings.corsProxyUrl);
  addUrlHost(hosts, settings.markdownServiceUrl);

  const mcpState = useMcpStore.getState();
  for (const server of mcpState.servers) {
    addUrlHost(hosts, server.url);
  }
  addUrlHost(hosts, mcpState.bridgeConfig.url);
  if (mcpState.bridgeConfig.host) {
    hosts.add(`${mcpState.bridgeConfig.host}:${mcpState.bridgeConfig.port ?? 3001}`);
  }

  for (const source of useMarketplaceStore.getState().marketplaceSources) {
    addUrlHost(hosts, source.url);
  }
  for (const index of Object.values(useMarketplaceStore.getState().marketplaceIndexes)) {
    for (const item of index.items) {
      addUrlHost(hosts, item.downloadUrl);
      addUrlHost(hosts, item.previewUrl);
    }
  }

  for (const mod of useModStore.getState().dbMods) {
    addUrlHost(hosts, mod.sourceUrl);
  }

  for (const repo of useConversationStore.getState().syncRepos) {
    addUrlHost(hosts, repo.remoteUrl);
  }

  return [...hosts];
};

const inputToUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

export const installOutboundFetchGuard = (): void => {
  const globalWithMarker = globalThis as typeof globalThis & {
    [installedGuardMarker]?: boolean;
  };
  if (globalWithMarker[installedGuardMarker]) return;
  globalWithMarker[installedGuardMarker] = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = inputToUrl(input);
    let parsed: URL;
    try {
      parsed = new URL(url, globalThis.location?.origin ?? "http://localhost");
    } catch {
      throw new Error(`Blocked outbound request with invalid URL: ${url}`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Blocked non-HTTP fetch request: ${parsed.protocol}`);
    }

    if (!isLocalOrSameOriginHost(parsed.host)) {
      const allowedHosts = getRuntimeAllowedOutboundHosts();
      if (!isOutboundHostAllowed(parsed.host, allowedHosts)) {
        throw new Error(
          `Blocked outbound fetch to ${parsed.host}. Configure this host before LLMChef can contact it.`,
        );
      }
      recordOutboundRequest(parsed.toString(), `fetch:${init?.method ?? "GET"}`);
    }

    return originalFetch(input, init);
  };
};
