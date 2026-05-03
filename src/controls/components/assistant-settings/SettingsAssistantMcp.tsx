import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMcpStore, type McpServerConfig } from "@/store/mcp.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, EditIcon, TrashIcon, ServerIcon, CheckCircleIcon, XCircleIcon, RotateCcwIcon, PackagePlusIcon, DownloadIcon, Loader2Icon, EyeIcon, SearchIcon, ShieldCheckIcon, LockKeyholeIcon, AlertTriangleIcon, CopyIcon } from "lucide-react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { parseMcpImportInput } from "@/lib/llmchef/mcp-package-import";
import { buildEsmPackageEntryUrl, installMcpJsRuntimePackage, probeMcpJsRuntimeTools } from "@/lib/llmchef/mcp-js-runtime";

import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LLMChef/common/TabbedLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// Schemas for form validation - single source of truth
const mcpServerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL").refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "MCP servers must use http:// or https://",
  ),
  description: z.string(),
  headers: z.string(), // JSON string in form, will be parsed to Record<string, string>
  enabled: z.boolean(),
});

const connectionConfigFormSchema = z.object({
  retryAttempts: z.number().min(0, "Min 0 attempts").max(10, "Max 10 attempts"),
  retryDelay: z.number().min(500, "Min 500ms").max(30000, "Max 30000ms"),
  connectionTimeout: z.number().min(1000, "Min 1000ms").max(60000, "Max 60000ms"),
  maxResponseSize: z.number().min(1000, "Min 1KB").max(10000000, "Max 10MB"),
});

// Type inference from schemas
type McpServerFormData = z.infer<typeof mcpServerFormSchema>;

// Utility component for field validation messages
function FieldMetaMessages({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <em className="text-xs text-destructive mt-1 block">
          {field.state.meta.errors.join(", ")}
        </em>
      ) : null}
    </>
  );
}

function PackageImportsTab() {
  const { t } = useTranslation('assistantSettings');
  const [importText, setImportText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeInstallId, setActiveInstallId] = useState<string | null>(null);
  const [activeProbeId, setActiveProbeId] = useState<string | null>(null);
  const [reviewImportId, setReviewImportId] = useState<string | null>(null);
  const [registryInput, setRegistryInput] = useState("");
  const {
    packageImports,
    packageRuntimeInstalls,
    packageRuntimeRegistryUrl,
    addPackageImports,
    deletePackageImport,
    upsertPackageRuntimeInstall,
    setPackageRuntimeRegistryUrl,
    addServer,
  } = useMcpStore(
    useShallow((state) => ({
      packageImports: state.packageImports,
      packageRuntimeInstalls: state.packageRuntimeInstalls,
      packageRuntimeRegistryUrl: state.packageRuntimeRegistryUrl,
      addPackageImports: state.addPackageImports,
      deletePackageImport: state.deletePackageImport,
      upsertPackageRuntimeInstall: state.upsertPackageRuntimeInstall,
      setPackageRuntimeRegistryUrl: state.setPackageRuntimeRegistryUrl,
      addServer: state.addServer,
    }))
  );

  const installsByImportId = new Map(packageRuntimeInstalls.map((item) => [item.packageImportId, item]));

  useEffect(() => {
    setRegistryInput(packageRuntimeRegistryUrl);
  }, [packageRuntimeRegistryUrl]);

  const handleImport = () => {
    try {
      const result = parseMcpImportInput(importText);
      setParseError(null);

      if (result.packageImports.length > 0) {
        addPackageImports(result.packageImports);
      }
      for (const draft of result.serverDrafts) {
        addServer({
          name: draft.name,
          url: draft.url,
          description: draft.description,
          headers: draft.headers,
          enabled: false,
        });
      }

      toast.success(t('mcp.import.success'), {
        description: t('mcp.import.successDescription', {
          packages: result.packageImports.length,
          servers: result.serverDrafts.length,
        }),
      });
      setImportText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setParseError(message);
      toast.error(t('mcp.import.error'), { description: message });
    }
  };

  const handleInstallPackage = async (packageImportId: string) => {
    const packageImport = packageImports.find((item) => item.id === packageImportId);
    if (!packageImport) return;

    setActiveInstallId(packageImportId);
    try {
      toast.loading(t('mcp.import.installing'), { id: `mcp-install-${packageImportId}` });
      const install = await installMcpJsRuntimePackage({
        packageImport,
        registryBaseUrl: packageRuntimeRegistryUrl,
      });
      upsertPackageRuntimeInstall(install);

      toast.success(t('mcp.import.installSuccess'), {
        id: `mcp-install-${packageImportId}`,
        description: t('mcp.import.installSuccessDescription', {
          modules: install.moduleCount,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t('mcp.import.installError'), {
        id: `mcp-install-${packageImportId}`,
        description: message,
      });
    } finally {
      setActiveInstallId(null);
    }
  };

  const handleProbeTools = async (packageImportId: string) => {
    const install = installsByImportId.get(packageImportId);
    if (!install) return;

    setActiveProbeId(packageImportId);
    try {
      toast.loading(t('mcp.import.probing'), { id: `mcp-probe-${packageImportId}` });
      const result = await probeMcpJsRuntimeTools(install);
      const updatedInstall = {
        ...install,
        detectedTools: result.tools,
        lastProbeAt: new Date(),
        lastProbeOk: result.ok,
        lastProbeMessage: result.messages.slice(-3).join("\n"),
      };
      upsertPackageRuntimeInstall(updatedInstall);

      if (!result.ok) {
        toast.warning(t('mcp.import.probeWarning'), {
          id: `mcp-probe-${packageImportId}`,
          description: updatedInstall.lastProbeMessage || t('mcp.import.probeWarningDescription'),
        });
        return;
      }

      toast.success(t('mcp.import.probeSuccess'), {
        id: `mcp-probe-${packageImportId}`,
        description: t('mcp.import.probeSuccessDescription', { tools: result.tools.length }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updatedInstall = {
        ...install,
        lastProbeAt: new Date(),
        lastProbeOk: false,
        lastProbeMessage: message,
      };
      upsertPackageRuntimeInstall(updatedInstall);
      toast.error(t('mcp.import.probeError'), {
        id: `mcp-probe-${packageImportId}`,
        description: message,
      });
    } finally {
      setActiveProbeId(null);
    }
  };

  const getReviewFlags = (item: typeof packageImports[number]) => {
    const flags: string[] = [
      t('mcp.import.reviewNoProcess'),
      t('mcp.import.reviewNoEnvValues'),
    ];
    if (item.packageName.startsWith("github:") || item.packageName.startsWith("gh:")) {
      flags.push(t('mcp.import.reviewGithubSpec'));
    }
    if (item.args.some((arg) => /\b(fs|filesystem|docker|shell|exec|spawn|socket)\b/i.test(arg))) {
      flags.push(t('mcp.import.reviewNodeRisk'));
    }
    if (item.endpointUrl) {
      flags.push(t('mcp.import.reviewEndpointDraft'));
    }
    return flags;
  };

  const installedCount = packageRuntimeInstalls.length;
  const probedCount = packageRuntimeInstalls.filter((install) => install.lastProbeAt).length;
  const lockHashCount = packageRuntimeInstalls.reduce(
    (total, install) => total + Object.keys(install.moduleHashes ?? {}).length,
    0,
  );

  const getLockFingerprint = (install: typeof packageRuntimeInstalls[number] | undefined) => {
    const hashes = Object.values(install?.moduleHashes ?? {}).sort();
    if (hashes.length === 0) return "—";
    return hashes[0].slice(0, 12);
  };

  const handleCopyLockSummary = async (install: typeof packageRuntimeInstalls[number]) => {
    const lockSummary = {
      packageName: install.packageName,
      entryUrl: install.entryUrl,
      registryBaseUrl: install.registryBaseUrl,
      vfsRoot: install.vfsRoot,
      moduleCount: install.moduleCount,
      moduleHashes: install.moduleHashes,
      detectedTools: install.detectedTools ?? [],
      lastProbeOk: install.lastProbeOk ?? null,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(lockSummary, null, 2));
      toast.success("MCP package lock copied");
    } catch (error) {
      toast.error("Could not copy MCP package lock", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const registryIsLoopbackHttp = (() => {
    try {
      const parsed = new URL(packageRuntimeRegistryUrl);
      return parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    } catch {
      return false;
    }
  })();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">{t('mcp.import.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('mcp.import.description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <PackagePlusIcon className="mr-2 h-4 w-4" />
            {t('mcp.import.pasteTitle')}
          </CardTitle>
          <CardDescription>
            {t('mcp.import.pasteDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('mcp.import.placeholder')}
            rows={8}
            className="font-mono text-xs"
          />
          {parseError ? (
            <p className="text-xs text-destructive">{parseError}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t('mcp.import.safetyNote')}
          </p>
        </CardContent>
        <CardFooter>
          <Button type="button" onClick={handleImport} disabled={!importText.trim()}>
            <PackagePlusIcon className="mr-2 h-4 w-4" />
            {t('mcp.import.importButton')}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mcp.import.runtimeTitle')}</CardTitle>
          <CardDescription>{t('mcp.import.runtimeDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="mcp-package-registry">{t('mcp.import.registryLabel')}</Label>
          <Input
            id="mcp-package-registry"
            value={registryInput}
            onChange={(event) => setRegistryInput(event.target.value)}
            onBlur={() => setPackageRuntimeRegistryUrl(registryInput)}
            placeholder="https://esm.sh"
          />
          <p className="text-xs text-muted-foreground">{t('mcp.import.runtimeSafetyNote')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheckIcon className="h-3 w-3" />
              {registryIsLoopbackHttp ? "Loopback HTTP only" : "HTTPS registry"}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <LockKeyholeIcon className="h-3 w-3" />
              Install builds a local hash lock
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <SearchIcon className="h-3 w-3" />
              Probe is explicit
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <ShieldCheckIcon className="mr-2 h-4 w-4" />
            MCP JavaScript Safety Gates
          </CardTitle>
          <CardDescription>
            Package imports are reviewed in three steps: parse the command, resolve and hash the browser module graph, then explicitly probe tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">1. Import</p>
            <p className="text-xs text-muted-foreground">Only npx/npm-style JavaScript package specs are accepted. Local stdio process launch is not used.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">2. Resolve lock</p>
            <p className="text-xs text-muted-foreground">The registry must be HTTPS unless it is loopback, and resolved modules are shown with hashes.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">3. Probe</p>
            <p className="text-xs text-muted-foreground">Tool discovery runs only after install, so the package graph can be reviewed first.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mcp.import.importedTitle')}</CardTitle>
          <CardDescription>{t('mcp.import.importedDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-xs md:grid-cols-4">
            <div>
              <p className="font-medium">Imported packages</p>
              <p className="mt-1 text-muted-foreground">{packageImports.length}</p>
            </div>
            <div>
              <p className="font-medium">Installed locks</p>
              <p className="mt-1 text-muted-foreground">{installedCount}</p>
            </div>
            <div>
              <p className="font-medium">Resolved modules</p>
              <p className="mt-1 text-muted-foreground">{lockHashCount}</p>
            </div>
            <div>
              <p className="font-medium">Tool probes</p>
              <p className="mt-1 text-muted-foreground">{probedCount}</p>
            </div>
          </div>
          {packageImports.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('mcp.import.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('mcp.import.nameColumn')}</TableHead>
                  <TableHead>{t('mcp.import.packageColumn')}</TableHead>
                  <TableHead>{t('mcp.import.envColumn')}</TableHead>
                  <TableHead>{t('mcp.import.runtimeColumn')}</TableHead>
                  <TableHead className="text-right">{t('mcp.servers.actionsColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packageImports.map((item) => {
                  const install = installsByImportId.get(item.id);
                  const moduleHashEntries = Object.entries(install?.moduleHashes ?? {});
                  return (
                    <React.Fragment key={item.id}>
                      <TableRow>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-xs">{item.packageName}</TableCell>
                        <TableCell className="text-xs">
                          {item.envKeys.length > 0 ? item.envKeys.join(", ") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-1">
                            <span>
                              {install
                                ? t('mcp.import.installedStatus', {
                                    modules: install.moduleCount,
                                  })
                                : t('mcp.import.notInstalledStatus')}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {install ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  lock {getLockFingerprint(install)}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  lock pending
                                </Badge>
                              )}
                              {install?.lastProbeAt ? (
                                <Badge variant={install.lastProbeOk ? "secondary" : "destructive"} className="text-[10px]">
                                  {install.lastProbeOk ? "probe ok" : "probe warning"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  probe pending
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReviewImportId(reviewImportId === item.id ? null : item.id)}
                            title={t('mcp.import.reviewButton')}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInstallPackage(item.id)}
                            disabled={activeInstallId !== null}
                            title={install ? "Refresh resolved lock" : t('mcp.import.installButton')}
                          >
                            {activeInstallId === item.id ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                              <DownloadIcon className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleProbeTools(item.id)}
                            disabled={!install || activeProbeId !== null}
                            title={t('mcp.import.probeButton')}
                          >
                            {activeProbeId === item.id ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                              <SearchIcon className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePackageImport(item.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {reviewImportId === item.id ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20">
                            <div className="grid gap-3 text-xs md:grid-cols-2">
                              <div className="space-y-1">
                                <p className="font-medium">{t('mcp.import.reviewTitle')}</p>
                                <div className="flex flex-wrap gap-1">
                                  <Badge variant={install ? "secondary" : "outline"}>{install ? "Resolved" : "Install required"}</Badge>
                                  <Badge variant={install?.lastProbeAt ? "secondary" : "outline"}>{install?.lastProbeAt ? "Probe recorded" : "Probe pending"}</Badge>
                                  {item.envKeys.length > 0 ? (
                                    <Badge variant="outline"><AlertTriangleIcon className="mr-1 h-3 w-3" />env required</Badge>
                                  ) : null}
                                </div>
                                <p><span className="text-muted-foreground">{t('mcp.import.entryUrlLabel')}:</span> <span className="font-mono">{buildEsmPackageEntryUrl(packageRuntimeRegistryUrl, item.packageName)}</span></p>
                                <p><span className="text-muted-foreground">{t('mcp.import.argsLabel')}:</span> <span className="font-mono">{item.args.length > 0 ? item.args.join(" ") : "—"}</span></p>
                                <p><span className="text-muted-foreground">{t('mcp.import.vfsRootLabel')}:</span> <span className="font-mono">{install?.vfsRoot ?? "—"}</span></p>
                                {install ? (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1 text-xs"
                                      onClick={() => handleInstallPackage(item.id)}
                                      disabled={activeInstallId !== null}
                                    >
                                      {activeInstallId === item.id ? (
                                        <Loader2Icon className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RotateCcwIcon className="h-3 w-3" />
                                      )}
                                      Refresh lock
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1 text-xs"
                                      onClick={() => void handleCopyLockSummary(install)}
                                    >
                                      <CopyIcon className="h-3 w-3" />
                                      Copy lock
                                    </Button>
                                  </div>
                                ) : null}
                                {install ? (
                                  <div>
                                    <p className="text-muted-foreground">{t('mcp.import.lockLabel', 'Resolved lock')}:</p>
                                    <ul className="mt-1 space-y-1 font-mono">
                                      {moduleHashEntries.slice(0, 6).map(([url, hash]) => (
                                        <li key={url} className="break-all">
                                          {url} · {hash.slice(0, 12)}
                                        </li>
                                      ))}
                                      {moduleHashEntries.length > 6 ? (
                                        <li>{t('mcp.import.lockMore', '+ {{count}} more modules', { count: moduleHashEntries.length - 6 })}</li>
                                      ) : null}
                                    </ul>
                                  </div>
                                ) : null}
                              </div>
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                  {getReviewFlags(item).map((flag) => (
                                    <Badge key={flag} variant="secondary">{flag}</Badge>
                                  ))}
                                </div>
                                {install?.detectedTools?.length ? (
                                  <p>
                                    <span className="text-muted-foreground">{t('mcp.import.detectedToolsLabel')}:</span>{" "}
                                    {install.detectedTools.join(", ")}
                                  </p>
                                ) : null}
                                {install?.lastProbeMessage ? (
                                  <p className={install.lastProbeOk ? "text-muted-foreground" : "text-destructive"}>
                                    {install.lastProbeMessage}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Connection Settings Component
function ConnectionSettingsTab() {
  const { t } = useTranslation('assistantSettings');
  const {
    retryAttempts,
    retryDelay,
    connectionTimeout,
    maxResponseSize,
    setRetryAttempts,
    setRetryDelay,
    setConnectionTimeout,
    setMaxResponseSize,
  } = useMcpStore(
    useShallow((state) => ({
      retryAttempts: state.retryAttempts,
      retryDelay: state.retryDelay,
      connectionTimeout: state.connectionTimeout,
      maxResponseSize: state.maxResponseSize,
      setRetryAttempts: state.setRetryAttempts,
      setRetryDelay: state.setRetryDelay,
      setConnectionTimeout: state.setConnectionTimeout,
      setMaxResponseSize: state.setMaxResponseSize,
    }))
  );

  const form = useForm({
    defaultValues: {
      retryAttempts: retryAttempts,
      retryDelay: retryDelay,
      connectionTimeout: connectionTimeout,
      maxResponseSize: maxResponseSize,
    },
    validators: {
      onChangeAsync: connectionConfigFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      setRetryAttempts(value.retryAttempts);
      setRetryDelay(value.retryDelay);
      setConnectionTimeout(value.connectionTimeout);
      setMaxResponseSize(value.maxResponseSize);
    },
  });

  // Update form when store changes
  useEffect(() => {
    form.reset({
      retryAttempts: retryAttempts,
      retryDelay: retryDelay,
      connectionTimeout: connectionTimeout,
      maxResponseSize: maxResponseSize,
    });
  }, [retryAttempts, retryDelay, connectionTimeout, maxResponseSize, form]);

  const handleReset = () => {
    if (window.confirm(t('mcp.connection.resetConfirm'))) {
      setRetryAttempts(3);
      setRetryDelay(2000);
      setConnectionTimeout(10000);
      setMaxResponseSize(128000); // 128KB default
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-medium">{t('mcp.connection.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('mcp.connection.description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mcp.connection.retryConfiguration')}</CardTitle>
          <CardDescription>
            {t('mcp.connection.retryDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <form.Field name="retryAttempts">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.retryAttempts')}</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="0"
                    max="10"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                    onBlur={field.handleBlur}
                    placeholder="3"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    {t('mcp.connection.retryAttemptsHelp')}
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="retryDelay">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.retryDelay')}</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="500"
                    max="30000"
                    step="500"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 2000)}
                    onBlur={field.handleBlur}
                    placeholder="2000"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    {t('mcp.connection.retryDelayHelp')}
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="connectionTimeout">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.timeout')}</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="1000"
                    max="60000"
                    step="1000"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 10000)}
                    onBlur={field.handleBlur}
                    placeholder="10000"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    {t('mcp.connection.timeoutHelp')}
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="maxResponseSize">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.maxResponseSize')}</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="1000"
                    max="10000000"
                    step="1000"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 128000)}
                    onBlur={field.handleBlur}
                    placeholder="128000"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    {t('mcp.connection.maxResponseSizeHelp')}
                  </p>
                </div>
              )}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <ul className="list-disc list-inside space-y-1">
              <li>Failed connections will be retried automatically with exponential backoff</li>
              <li>Toast notifications will show connection status and retry progress</li>
              <li>Servers that fail all retry attempts will be marked as disconnected</li>
              <li>You can manually retry connections from the server cards in the Servers tab</li>
              <li><strong>Max Response Size:</strong> Tool responses larger than this limit will be automatically truncated to prevent API errors</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-3 border-t">
        <form.Subscribe>
          {(state) => (
            <div className="flex items-center space-x-2">
              <Button
                type="submit"
                size="sm"
                disabled={!state.canSubmit || state.isSubmitting || state.isValidating || !state.isValid}
              >
                {state.isSubmitting
                  ? t('common.saving')
                  : state.isValidating
                  ? t('common.validating')
                  : t('mcp.connection.saveSettings')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                type="button"
              >
                <RotateCcwIcon className="mr-2 h-4 w-4" />
                {t('common.reset')}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

// Server Form Component
function ServerForm({
  server,
  onSubmit,
  onCancel,
}: {
  server?: McpServerConfig;
  onSubmit: (data: McpServerFormData) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('assistantSettings');
  const form = useForm({
    defaultValues: {
      name: server?.name || "",
      url: server?.url || "",
      description: server?.description || "",
      headers: server?.headers ? JSON.stringify(server.headers, null, 2) : "",
      enabled: server?.enabled ?? true,
    },
    validators: {
      onChangeAsync: mcpServerFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });

  useEffect(() => {
    form.reset({
      name: server?.name || "",
      url: server?.url || "",
      description: server?.description || "",
      headers: server?.headers ? JSON.stringify(server.headers, null, 2) : "",
      enabled: server?.enabled ?? true,
    });
  }, [server, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-medium">
          {server ? t('mcp.server.editTitle') : t('mcp.server.addTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {server
            ? t('mcp.server.editDescription')
            : t('mcp.server.addDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <ServerIcon className="mr-2 h-4 w-4" />
            {t('mcp.server.details')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.nameLabel')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.namePlaceholder')}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="url">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.urlLabel')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.urlPlaceholder')}
                />
                <FieldMetaMessages field={field} />
                <p className="text-xs text-muted-foreground">
                  {t('mcp.server.urlHelp')}
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.descriptionLabel')}</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.descriptionPlaceholder')}
                  rows={2}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="headers">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.headersLabel')}</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.headersPlaceholder')}
                  rows={3}
                />
                <FieldMetaMessages field={field} />
                <p className="text-xs text-muted-foreground">
                  {t('mcp.server.headersHelp')}
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="enabled">
            {(field) => (
              <div className="flex items-center space-x-2">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
                <Label htmlFor={field.name}>{t('mcp.server.enableLabel')}</Label>
              </div>
            )}
          </form.Field>
        </CardContent>
        <CardFooter className="flex gap-2">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting
                  ? (server ? t('mcp.server.updating') : t('mcp.server.adding'))
                  : (server ? t('mcp.server.updateButton') : t('mcp.server.addButton'))}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

// Servers List Component
function ServersTab({
  onNewServer,
  onEditServer,
}: {
  onNewServer: () => void;
  onEditServer: (server: McpServerConfig) => void;
}) {
  const { t } = useTranslation('assistantSettings');
  const { servers, deleteServer, updateServer } = useMcpStore(
    useShallow((state) => ({
      servers: state.servers,
      deleteServer: state.deleteServer,
      updateServer: state.updateServer,
    }))
  );

  const handleDelete = (serverId: string) => {
    if (window.confirm(t('mcp.server.deleteConfirm'))) {
      deleteServer(serverId);
    }
  };

  const handleToggleEnabled = (server: McpServerConfig) => {
    updateServer(server.id, { enabled: !server.enabled });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('mcp.servers.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('mcp.servers.description')}
          </p>
        </div>
        <Button onClick={onNewServer}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {t('mcp.servers.addButton')}
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ServerIcon className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
          <h4 className="font-medium text-muted-foreground">{t('mcp.servers.noServers')}</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t('mcp.servers.noServersDescription')}
          </p>
          <Button onClick={onNewServer}>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('mcp.servers.addFirstButton')}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('mcp.servers.nameColumn')}</TableHead>
              <TableHead>{t('mcp.servers.urlColumn')}</TableHead>
              <TableHead>{t('mcp.servers.statusColumn')}</TableHead>
              <TableHead>{t('mcp.servers.descriptionColumn')}</TableHead>
              <TableHead className="text-right">{t('mcp.servers.actionsColumn')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map((server) => (
              <TableRow key={server.id}>
                <TableCell className="font-medium">{server.name}</TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  {server.url}
                </TableCell>
                <TableCell>
                  <Badge variant={server.enabled ? "default" : "secondary"}>
                    {server.enabled ? (
                      <>
                        <CheckCircleIcon className="mr-1 h-3 w-3" />
                        {t('mcp.servers.enabled')}
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="mr-1 h-3 w-3" />
                        {t('mcp.servers.disabled')}
                      </>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {server.description || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={() => handleToggleEnabled(server)}
                      className="scale-75"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditServer(server)}
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(server.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export const SettingsAssistantMcp: React.FC = () => {
  const { t } = useTranslation('assistantSettings');
  const [activeTab, setActiveTab] = useState("servers");
  const [editingServer, setEditingServer] = useState<McpServerConfig | undefined>();

  const { addServer, updateServer } = useMcpStore(
    useShallow((state) => ({
      addServer: state.addServer,
      updateServer: state.updateServer,
    }))
  );

  const handleCreateServer = async (data: McpServerFormData) => {
    try {
      const headers = data.headers ? JSON.parse(data.headers) : undefined;
      addServer({
        name: data.name,
        url: data.url,
        description: data.description,
        headers,
        enabled: data.enabled,
      });
      setActiveTab("servers");
    } catch (error) {
      console.error("Invalid headers JSON:", error);
      toast.error(t('mcp.server.invalidHeaders'));
    }
  };

  const handleUpdateServer = async (data: McpServerFormData) => {
    if (!editingServer) return;
    try {
      const headers = data.headers ? JSON.parse(data.headers) : undefined;
      updateServer(editingServer.id, {
        name: data.name,
        url: data.url,
        description: data.description,
        headers,
        enabled: data.enabled,
      });
      setActiveTab("servers");
      setEditingServer(undefined);
    } catch (error) {
      console.error("Invalid headers JSON:", error);
      toast.error(t('mcp.server.invalidHeaders'));
    }
  };

  const handleNewServer = () => {
    setEditingServer(undefined);
    setActiveTab("new");
  };

  const handleEditServer = (server: McpServerConfig) => {
    setEditingServer(server);
    setActiveTab("edit");
  };

  const handleFormCancel = () => {
    setActiveTab("servers");
    setEditingServer(undefined);
  };

  const tabs: TabDefinition[] = [
    {
      value: "servers",
      label: t('mcp.tabs.servers'),
      content: (
        <ServersTab
          onNewServer={handleNewServer}
          onEditServer={handleEditServer}
        />
      ),
    },
    {
      value: "imports",
      label: t('mcp.tabs.imports'),
      content: <PackageImportsTab />,
    },
    {
      value: "connection",
      label: t('mcp.tabs.connection'),
      content: <ConnectionSettingsTab />,
    },
    {
      value: "new",
      label: t('mcp.tabs.addServer'),
      content: (
        <ServerForm
          key="new-server-form"
          onSubmit={handleCreateServer}
          onCancel={handleFormCancel}
        />
      ),
    },
  ];

  // Add edit tab dynamically when editing
  if (editingServer) {
    tabs.push({
      value: "edit",
      label: t('mcp.tabs.editServer', { name: editingServer.name }),
      content: (
        <ServerForm
          key={`edit-server-form-${editingServer.id}`}
          server={editingServer}
          onSubmit={handleUpdateServer}
          onCancel={handleFormCancel}
        />
      ),
    });
  }

  return (
    <TabbedLayout
      tabs={tabs}
      initialValue={activeTab}
      onValueChange={setActiveTab}
      defaultValue="servers"
      scrollable={false}
    />
  );
};
