import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSkillStore } from "@/store/skill.store";
import type { Skill, SkillPackageFile } from "@/types/llmchef/skill";
import { normalizeSkillSlug } from "@/lib/llmchef/skill-package";
import { reviewSkillForInstall } from "@/lib/llmchef/skill-install-review";
import { findSkillPackagesInVfs } from "@/lib/llmchef/skill-vfs-import";
import { useVfsStore } from "@/store/vfs.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DownloadIcon,
  AlertTriangleIcon,
  Loader2Icon,
  PackagePlusIcon,
  SaveIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UploadIcon,
  HardDriveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialogService } from "@/services/confirm-dialog.service";

interface DraftSkill {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string;
  entryPrompt: string;
}

const EMPTY_DRAFT: DraftSkill = {
  slug: "",
  name: "",
  description: "",
  version: "0.1.0",
  author: "",
  tags: "",
  entryPrompt: "",
};

export const SettingsSkills: React.FC = () => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<DraftSkill>(EMPTY_DRAFT);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [vfsImportPath, setVfsImportPath] = useState("/.llmchef/skills");
  const [isImportingFromVfs, setIsImportingFromVfs] = useState(false);

  const {
    skills,
    loading,
    error,
    loadSkills,
    createSkill,
    importSkillPackage,
    exportSkillPackage,
    setSkillInstallState,
    deleteSkill,
  } = useSkillStore();
  const fsInstance = useVfsStore((state) => state.fs);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => a.name.localeCompare(b.name)),
    [skills]
  );

  const updateDraft = (field: keyof DraftSkill, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: field === "slug" ? normalizeSkillSlug(value) : value,
    }));
  };

  const handleCreate = useCallback(async () => {
    const slug = normalizeSkillSlug(draft.slug || draft.name);
    if (!slug || !draft.name.trim() || !draft.description.trim()) {
      toast.error("Skills need a name, slug, and description.");
      return;
    }

    setIsCreating(true);
    try {
      await createSkill({
        schemaVersion: 1,
        slug,
        name: draft.name.trim(),
        description: draft.description.trim(),
        version: draft.version.trim() || "0.1.0",
        author: draft.author.trim() || undefined,
        tags: splitCsv(draft.tags),
        entryPrompt: draft.entryPrompt.trim() || undefined,
      });
      setDraft(EMPTY_DRAFT);
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Failed to create skill."
      );
    } finally {
      setIsCreating(false);
    }
  }, [createSkill, draft]);

  const handleExport = useCallback(
    (skill: Skill) => {
      const files = exportSkillPackage(skill.id);
      const blob = new Blob([`${JSON.stringify(files, null, 2)}\n`], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${skill.slug}.llmchef-skill.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [exportSkillPackage]
  );

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw) as unknown;
        const files = extractSkillPackageFiles(parsed);
        await importSkillPackage(files, { type: "local", uri: file.name });
      } catch (importError) {
        toast.error(
          importError instanceof Error
            ? importError.message
            : "Failed to import skill package."
        );
      } finally {
        setIsImporting(false);
        event.target.value = "";
      }
    },
    [importSkillPackage]
  );

  const handleImportFromVfs = useCallback(async () => {
    if (!fsInstance) {
      toast.error("VFS is not ready.");
      return;
    }

    setIsImportingFromVfs(true);
    try {
      const packages = await findSkillPackagesInVfs(vfsImportPath, {
        fsInstance,
      });

      if (packages.length === 0) {
        toast.info("No skill packages found at that VFS path.");
        return;
      }

      for (const pkg of packages) {
        await importSkillPackage(pkg.files, {
          type: "vfs",
          path: pkg.rootPath,
          uri: pkg.rootPath,
        });
      }

      toast.success(`Imported ${packages.length} skill package(s) from VFS.`);
    } catch (vfsImportError) {
      toast.error(
        vfsImportError instanceof Error
          ? vfsImportError.message
          : "Failed to import skills from VFS."
      );
    } finally {
      setIsImportingFromVfs(false);
    }
  }, [fsInstance, importSkillPackage, vfsImportPath]);

  const handleDelete = useCallback(
    async (skill: Skill) => {
      const confirmed = await ConfirmDialogService.confirm({
        title: "Delete skill",
        description: `Delete skill "${skill.name}"?`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        destructive: true,
      });
      if (!confirmed) return;
      await deleteSkill(skill.id);
    },
    [deleteSkill]
  );

  const handleToggleInstall = useCallback(
    async (skill: Skill) => {
      if (skill.installState === "installed") {
        await setSkillInstallState(skill.id, "disabled");
        return;
      }

      const review = reviewSkillForInstall(skill);
      if (review.requiresConfirmation) {
        const summary = review.findings
          .map((finding) => `- ${finding.title}: ${finding.detail}`)
          .join("\n");
        const confirmed = await ConfirmDialogService.confirm({
          title: `Install "${skill.name}"?`,
          description: `Security review:\n${summary}\n\nOnly install skills from sources you trust.`,
          confirmLabel: "Install",
          cancelLabel: "Cancel",
          destructive: true,
        });
        if (!confirmed) return;
      }

      await setSkillInstallState(skill.id, "installed");
    },
    [setSkillInstallState]
  );

  return (
    <div className="space-y-4 p-1">
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <section className="space-y-3 rounded-md border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Create Skill</h3>
            <PackagePlusIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              placeholder="Code reviewer"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-slug">Slug</Label>
            <Input
              id="skill-slug"
              value={draft.slug}
              onChange={(event) => updateDraft("slug", event.target.value)}
              placeholder={normalizeSkillSlug(draft.name) || "code-reviewer"}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-description">Description</Label>
            <Textarea
              id="skill-description"
              value={draft.description}
              onChange={(event) =>
                updateDraft("description", event.target.value)
              }
              className="min-h-20"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="skill-version">Version</Label>
              <Input
                id="skill-version"
                value={draft.version}
                onChange={(event) => updateDraft("version", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="skill-author">Author</Label>
              <Input
                id="skill-author"
                value={draft.author}
                onChange={(event) => updateDraft("author", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-tags">Tags</Label>
            <Input
              id="skill-tags"
              value={draft.tags}
              onChange={(event) => updateDraft("tags", event.target.value)}
              placeholder="review, security, frontend"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-entry-prompt">Entry Prompt</Label>
            <Textarea
              id="skill-entry-prompt"
              value={draft.entryPrompt}
              onChange={(event) =>
                updateDraft("entryPrompt", event.target.value)
              }
              className="min-h-28 font-mono text-xs"
            />
          </div>
          <Button onClick={handleCreate} disabled={isCreating || loading}>
            {isCreating ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon className="mr-2 h-4 w-4" />
            )}
            Save Skill
          </Button>

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Import From VFS</h3>
              <HardDriveIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Use a skill folder, a folder containing skill folders, or a cloned
              repo with `.llmchef/skills/&lt;slug&gt;/skill.json`.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="skill-vfs-path">VFS Path</Label>
              <Input
                id="skill-vfs-path"
                value={vfsImportPath}
                onChange={(event) => setVfsImportPath(event.target.value)}
                placeholder="/repo or /.llmchef/skills"
                className="font-mono text-xs"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleImportFromVfs}
              disabled={isImportingFromVfs || !fsInstance}
            >
              {isImportingFromVfs ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <HardDriveIcon className="mr-2 h-4 w-4" />
              )}
              Import VFS Skills
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Skills</h3>
              <p className="text-xs text-muted-foreground">
                {sortedSkills.length} saved
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadIcon className="mr-2 h-4 w-4" />
                )}
                Import
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading skills
            </div>
          )}
          {!loading && sortedSkills.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No skills yet.
            </div>
          )}
          <div className="grid gap-2">
            {sortedSkills.map((skill) => {
              const review = reviewSkillForInstall(skill);
              return (
              <article key={skill.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-semibold">
                        {skill.name}
                      </h4>
                      <Badge variant="outline">{skill.version}</Badge>
                      <Badge
                        variant="outline"
                        className={cn(riskClassName(skill.riskLevel))}
                      >
                        {skill.riskLevel}
                      </Badge>
                      <Badge variant="secondary">{skill.installState}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {skill.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {skill.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {skill.slug} | {skill.files.length} files
                    </p>
                    <div className="rounded-md border bg-muted/30 p-2 text-xs">
                      <div className="mb-1 flex items-center gap-2 font-medium">
                        {review.requiresConfirmation ? (
                          <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                          <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        Install review
                      </div>
                      <ul className="space-y-1 text-muted-foreground">
                        {review.findings.slice(0, 3).map((finding) => (
                          <li key={`${skill.id}-${finding.title}`}>
                            <span className={cn(findingClassName(finding.severity))}>
                              {finding.title}
                            </span>
                            {": "}
                            {finding.detail}
                          </li>
                        ))}
                        {review.findings.length > 3 && (
                          <li>{review.findings.length - 3} more finding(s)</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(skill)}
                    >
                      <DownloadIcon className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleInstall(skill)}
                    >
                      {skill.installState === "installed"
                        ? "Disable"
                        : "Install"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(skill)}
                      aria-label={`Delete ${skill.name}`}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const extractSkillPackageFiles = (value: unknown): SkillPackageFile[] => {
  const files =
    Array.isArray(value)
      ? value
      : value && typeof value === "object" && "files" in value
        ? (value as { files: unknown }).files
        : null;

  if (!Array.isArray(files)) {
    throw new Error("Skill import must be a package file list.");
  }

  return files.map((file) => {
    if (!file || typeof file !== "object") {
      throw new Error("Skill package files must be objects.");
    }
    const candidate = file as Partial<SkillPackageFile>;
    if (typeof candidate.path !== "string") {
      throw new Error("Skill package file is missing a path.");
    }
    if (typeof candidate.content !== "string") {
      throw new Error("Skill package file is missing content.");
    }
    return {
      path: candidate.path,
      content: candidate.content,
    };
  });
};

const riskClassName = (riskLevel: Skill["riskLevel"]): string => {
  if (riskLevel === "high") {
    return "border-destructive/40 text-destructive";
  }
  if (riskLevel === "medium") {
    return "border-amber-500/40 text-amber-600 dark:text-amber-400";
  }
  return "border-emerald-500/40 text-emerald-600 dark:text-emerald-400";
};

const findingClassName = (
  severity: "info" | "warning" | "danger"
): string => {
  if (severity === "danger") return "font-medium text-destructive";
  if (severity === "warning") {
    return "font-medium text-amber-600 dark:text-amber-400";
  }
  return "font-medium text-emerald-600 dark:text-emerald-400";
};
