// src/components/LLMChef/settings/ProjectSettingsSync.tsx

import React, { useEffect } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SyncRepo } from "@/types/llmchef/sync";
import { FieldMetaMessages } from "@/components/LLMChef/common/form-fields/FieldMetaMessages";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, GitBranch, Loader2, SaveIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface ProjectWikiSyncMetadata {
  status?: "idle" | "syncing" | "synced" | "error";
  repoId?: string | null;
  repoName?: string | null;
  branch?: string | null;
  lastPushedAt?: string | null;
  lastPulledAt?: string | null;
  lastError?: string | null;
  initialized?: boolean;
  lastAction?: "pull" | "push" | "sync" | null;
}

interface ProjectSettingsSyncProps {
  initialSyncRepoId: string | null;
  onSave: (data: { syncRepoId: string | null }) => Promise<void> | void;
  onSyncProject?: () => Promise<void> | void;
  onPullProject?: () => Promise<void> | void;
  projectWikiSync?: ProjectWikiSyncMetadata | null;
  effectiveSyncRepoId: string | null;
  syncRepos: SyncRepo[];
  isParentSaving?: boolean;
  isProjectSyncing?: boolean;
  projectSyncAction?: "pull" | "push" | null;
}

const projectSettingsSyncSchema = z.object({
  syncRepoId: z.string().nullable(),
});

export const ProjectSettingsSync: React.FC<ProjectSettingsSyncProps> = ({
  initialSyncRepoId,
  onSave,
  onSyncProject,
  onPullProject,
  projectWikiSync,
  effectiveSyncRepoId,
  syncRepos,
  isParentSaving = false,
  isProjectSyncing = false,
  projectSyncAction = null,
}) => {
  const effectiveRepoName =
    syncRepos.find((r) => r.id === effectiveSyncRepoId)?.name ?? "None";
  const status = isProjectSyncing ? "syncing" : projectWikiSync?.status ?? "idle";
  const statusConfig = {
    idle: { label: "Not pushed", icon: Clock, variant: "outline" as const },
    syncing: {
      label: projectSyncAction === "pull" ? "Pulling" : "Pushing",
      icon: Loader2,
      variant: "secondary" as const,
    },
    synced: { label: "Synced", icon: CheckCircle2, variant: "secondary" as const },
    error: { label: "Error", icon: AlertTriangle, variant: "destructive" as const },
  }[status];
  const StatusIcon = statusConfig.icon;
  const pushedAt = projectWikiSync?.lastPushedAt
    ? new Date(projectWikiSync.lastPushedAt)
    : null;
  const pulledAt = projectWikiSync?.lastPulledAt
    ? new Date(projectWikiSync.lastPulledAt)
    : null;
  const pushedAtLabel =
    pushedAt && !Number.isNaN(pushedAt.getTime())
      ? formatDistanceToNow(pushedAt, { addSuffix: true })
      : null;
  const pulledAtLabel =
    pulledAt && !Number.isNaN(pulledAt.getTime())
      ? formatDistanceToNow(pulledAt, { addSuffix: true })
      : null;

  const form = useForm({
    defaultValues: {
      syncRepoId: initialSyncRepoId ?? null,
    },
    validators: {
      onChangeAsync: projectSettingsSyncSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      await onSave(value);
    },
  });

  useEffect(() => {
    form.reset({
      syncRepoId: initialSyncRepoId ?? null,
    });
  }, [initialSyncRepoId, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <form.Field
        name="syncRepoId"
        validators={{
          onChange: projectSettingsSyncSchema.shape.syncRepoId,
        }}
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name}>
              Sync Repository (Overrides Parent/Global)
            </Label>
            <p className="text-xs text-muted-foreground mb-1">
              Link this project to a sync repository. All new conversations created
              within this project will automatically inherit this link.
            </p>
            <Select
              value={field.state.value ?? "none"}
              onValueChange={(value) => {
                field.handleChange(value === "none" ? null : value);
                field.handleBlur();
              }}
              disabled={form.state.isSubmitting || isParentSaving || syncRepos.length === 0}
            >
              <SelectTrigger id={field.name}>
                <SelectValue
                  placeholder={
                    syncRepos.length === 0
                      ? "No sync repos configured"
                      : `Inherited: ${effectiveRepoName}`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">
                    Use Inherited/Default ({effectiveRepoName})
                  </span>
                </SelectItem>
                {syncRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldMetaMessages field={field} />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 mt-1 text-muted-foreground"
              onClick={() => form.setFieldValue("syncRepoId", null)}
              disabled={form.state.isSubmitting || isParentSaving || field.state.value === null}
              type="button"
            >
              Use Inherited/Default
            </Button>
          </div>
        )}
      />
      <div className="rounded-sm border bg-card/60 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="font-medium">Project wiki push</div>
            <div className="text-xs text-muted-foreground">
              Pushes this project folder, including wiki pages and files, to the linked Git repository.
            </div>
          </div>
          <Badge variant={statusConfig.variant}>
            <StatusIcon className={isProjectSyncing ? "animate-spin" : undefined} />
            {statusConfig.label}
          </Badge>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <span className="font-medium text-foreground">Repository:</span>{" "}
            {projectWikiSync?.repoName ?? effectiveRepoName}
          </div>
          <div className="flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">Branch:</span>{" "}
            {projectWikiSync?.branch ?? "Inherited repository default"}
          </div>
          <div>
            <span className="font-medium text-foreground">Last pushed:</span>{" "}
            {pushedAtLabel ?? "Never"}
          </div>
          <div>
            <span className="font-medium text-foreground">Last pulled:</span>{" "}
            {pulledAtLabel ?? "Never"}
          </div>
          <div>
            <span className="font-medium text-foreground">Last action:</span>{" "}
            {projectWikiSync?.lastAction ?? "None"}
          </div>
          <div>
            <span className="font-medium text-foreground">Working tree:</span>{" "}
            {projectWikiSync?.initialized ? "Initialized during last sync" : "Existing or not yet initialized"}
          </div>
        </div>
        {projectWikiSync?.lastError && (
          <div className="mt-3 rounded-sm border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {projectWikiSync.lastError}
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onPullProject?.()}
          disabled={
            isParentSaving ||
            form.state.isSubmitting ||
            !effectiveSyncRepoId ||
            !onPullProject ||
            isProjectSyncing
          }
        >
          {isProjectSyncing && projectSyncAction === "pull" && (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          )}
          {isProjectSyncing && projectSyncAction === "pull"
            ? "Pulling..."
            : "Pull Project Wiki"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onSyncProject?.()}
          disabled={
            isParentSaving ||
            form.state.isSubmitting ||
            !effectiveSyncRepoId ||
            !onSyncProject ||
            isProjectSyncing
          }
        >
          {isProjectSyncing && projectSyncAction === "push" && (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          )}
          {isProjectSyncing && projectSyncAction === "push"
            ? "Pushing..."
            : "Push Project Wiki"}
        </Button>
        <form.Subscribe
          selector={(state) =>
            [
              state.canSubmit,
              state.isSubmitting,
              state.isValidating,
              state.isValid,
            ] as const
          }
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              type="submit"
              size="sm"
              disabled={
                isParentSaving ||
                !canSubmit ||
                isSubmitting ||
                isValidating ||
                !isValid ||
                syncRepos.length === 0
              }
            >
              {(isSubmitting || isValidating) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <SaveIcon className="h-4 w-4 mr-1" />
              {isSubmitting || isValidating
                ? "Saving..."
                : "Save Sync Settings"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
