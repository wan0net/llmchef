import React, { useCallback, useMemo, useSyncExternalStore } from "react";
import { ClipboardIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearOutboundRequestLog,
  getOutboundRequestLog,
  subscribeOutboundRequestLog,
} from "@/lib/llmchef/outbound-policy";
import { getRuntimeAllowedOutboundHosts } from "@/services/outbound-fetch-guard.service";
import { useConversationStore } from "@/store/conversation.store";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useMcpStore } from "@/store/mcp.store";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

const emptySnapshot: ReturnType<typeof getOutboundRequestLog> = [];

const formatTime = (timestamp: string): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
};

interface NetworkSurface {
  category: string;
  label: string;
  host: string;
  url: string;
  mode: string;
}

const addSurface = (
  surfaces: NetworkSurface[],
  category: string,
  label: string,
  url: string | null | undefined,
  mode: string,
): void => {
  if (!url) return;
  try {
    surfaces.push({
      category,
      label,
      host: new URL(url, globalThis.location?.origin ?? "http://localhost").host,
      url,
      mode,
    });
  } catch {
    const sshGitMatch = url.match(/^git@([^:]+):/);
    surfaces.push({
      category,
      label,
      host: sshGitMatch?.[1] ?? "unparsed",
      url,
      mode,
    });
  }
};

const SettingsNetworkLedgerComponent: React.FC = () => {
  const records = useSyncExternalStore(
    subscribeOutboundRequestLog,
    getOutboundRequestLog,
    () => emptySnapshot,
  );
  const providerConfigs = useProviderStore((state) => state.dbProviderConfigs);
  const mcpState = useMcpStore(
    useShallow((state) => ({
      servers: state.servers,
      packageRuntimeRegistryUrl: state.packageRuntimeRegistryUrl,
      packageRuntimeInstalls: state.packageRuntimeInstalls,
    })),
  );
  const settings = useSettingsStore(
    useShallow((state) => ({
      corsProxyUrl: state.corsProxyUrl,
      markdownServiceUrl: state.markdownServiceUrl,
    })),
  );
  const marketplaceState = useMarketplaceStore(
    useShallow((state) => ({
      marketplaceSources: state.marketplaceSources,
      marketplaceIndexes: state.marketplaceIndexes,
    })),
  );
  const modSources = useModStore((state) => state.dbMods);
  const syncRepos = useConversationStore((state) => state.syncRepos);

  const allowedHosts = getRuntimeAllowedOutboundHosts();

  const surfaces = useMemo(() => {
    const nextSurfaces: NetworkSurface[] = [];
    for (const provider of providerConfigs) {
      addSurface(nextSurfaces, "LLM provider", provider.name || provider.type, provider.baseURL, provider.isEnabled ? "enabled" : "disabled");
    }
    addSurface(nextSurfaces, "Service", "CORS proxy", settings.corsProxyUrl, "configured");
    addSurface(nextSurfaces, "Service", "Markdown extraction", settings.markdownServiceUrl, "configured");
    for (const server of mcpState.servers) {
      addSurface(nextSurfaces, "MCP HTTP", server.name, server.url, server.enabled ? "enabled" : "disabled");
    }
    addSurface(nextSurfaces, "MCP package", "ESM registry/bundler", mcpState.packageRuntimeRegistryUrl, "explicit install only");
    for (const install of mcpState.packageRuntimeInstalls) {
      addSurface(nextSurfaces, "MCP package", install.packageName, install.entryUrl, "cached locally");
    }
    for (const source of marketplaceState.marketplaceSources) {
      addSurface(nextSurfaces, "Marketplace", source.name, source.url, source.enabled ? "enabled" : "disabled");
    }
    for (const index of Object.values(marketplaceState.marketplaceIndexes)) {
      for (const item of index.items) {
        addSurface(nextSurfaces, "Marketplace item", item.name, item.downloadUrl, "on demand");
        addSurface(nextSurfaces, "Marketplace item", `${item.name} preview`, item.previewUrl, "on demand");
      }
    }
    for (const mod of modSources) {
      addSurface(nextSurfaces, "Mod", mod.name, mod.sourceUrl, mod.enabled ? "enabled" : "disabled");
    }
    for (const repo of syncRepos) {
      addSurface(nextSurfaces, "Git", repo.name, repo.remoteUrl, "configured");
    }
    return nextSurfaces;
  }, [providerConfigs, settings, mcpState, marketplaceState, modSources, syncRepos]);

  const handleClear = useCallback(() => {
    clearOutboundRequestLog();
  }, []);

  const handleCopyAudit = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      allowedHosts: getRuntimeAllowedOutboundHosts(),
      configuredSurfaces: surfaces,
      recentRequests: records,
    };
    void navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast.success("Network audit copied");
  }, [records, surfaces]);

  return (
    <div className="p-1 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">Network Ledger</h3>
          <p className="text-sm text-muted-foreground">
            Recent outbound destinations recorded during this app session.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={records.length === 0}
        >
          <Trash2Icon className="mr-2 h-4 w-4" />
          Clear
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyAudit}
        >
          <ClipboardIcon className="mr-2 h-4 w-4" />
          Copy Audit
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Outbound guard active</h4>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Browser `fetch` calls are checked against configured hosts before data leaves this app.
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{allowedHosts.length} configured hosts</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Same-origin and localhost are allowed for local-first operation; remote hosts must come from configured integrations.
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{records.length} recorded requests</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use Copy Audit to capture surfaces, allowed hosts, and recent outbound requests for review.
          </p>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="border-b bg-muted/50 px-3 py-2">
          <h4 className="text-sm font-medium">Configured Network Surfaces</h4>
          <p className="text-xs text-muted-foreground">
            Every configured remote-capable surface LLMChef knows about. Package registries are used only during explicit installs.
          </p>
        </div>
        {surfaces.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No configured remote surfaces yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Host</th>
                  <th className="px-3 py-2 text-left font-medium">Mode</th>
                  <th className="px-3 py-2 text-left font-medium">URL</th>
                </tr>
              </thead>
              <tbody>
                {surfaces.map((surface, index) => (
                  <tr key={`${surface.category}-${surface.url}-${index}`} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{surface.category}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{surface.label}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{surface.host}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{surface.mode}</td>
                    <td className="px-3 py-2 min-w-[20rem] max-w-[36rem] truncate font-mono text-xs text-muted-foreground">
                      {surface.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-md border overflow-hidden">
        {records.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No outbound requests recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Host</th>
                  <th className="px-3 py-2 text-left font-medium">Purpose</th>
                  <th className="px-3 py-2 text-left font-medium">URL</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={`${record.timestamp}-${record.url}-${index}`} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatTime(record.timestamp)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {record.host}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {record.purpose}
                    </td>
                    <td className="px-3 py-2 min-w-[20rem] max-w-[36rem] truncate font-mono text-xs text-muted-foreground">
                      {record.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div>
          <h4 className="text-sm font-medium">Configured Remote Hosts</h4>
          <p className="text-xs text-muted-foreground">
            Same-origin assets and localhost are always allowed. Other remote hosts come from configured providers and integrations.
          </p>
        </div>
        {allowedHosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No configured remote hosts yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowedHosts.map((host) => (
              <span
                key={host}
                className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs"
              >
                {host}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const SettingsNetworkLedger = React.memo(SettingsNetworkLedgerComponent);
export default SettingsNetworkLedger;
