// src/components/LLMChef/file-manager/FileManager.tsx
// FULL FILE
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
} from "react";
import { useVfsStore } from "@/store/vfs.store";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useShallow } from "zustand/react/shallow";
import { VfsFile, VfsNode } from "@/types/llmchef/vfs";
import {
  dirname,
  basename,
  buildPath,
} from "@/lib/llmchef/file-manager-utils";
import { FileManagerTable } from "./FileManagerTable";
import { FileManagerToolbar } from "./FileManagerToolbar";
import { CloneDialog } from "./CloneDialog";
import { CommitDialog } from "./CommitDialog";
import * as VfsOps from "@/lib/llmchef/vfs-operations";
import {
  describeRealFsSyncResult,
  getProjectDirectoryHandleInfo,
  isRealFsSyncSupported,
  pickProjectDirectory,
  syncProjectDirectoryTwoWay,
  syncRealDirectoryTwoWay,
} from "@/lib/llmchef/real-fs-sync";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileManagerList } from "./FileManagerList";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePromptDialog } from "@/hooks/usePromptDialog";
import { emitter } from "@/lib/llmchef/event-emitter";
import { vfsEvent } from "@/types/llmchef/events/vfs.events";
import type { ModEventPayloadMap } from "@/types/llmchef/modding";
import { useTranslation } from "react-i18next";
import {
  inferFilePreviewDescriptor,
  type FilePreviewDescriptor,
} from "@/lib/llmchef/file-preview";

interface ActiveFilePreview {
  entry: VfsFile;
  descriptor: FilePreviewDescriptor;
  data: Uint8Array;
}

export const FileManager = memo(() => {
  const { t } = useTranslation("vfs");
  const { prompt: promptDialog, PromptDialog } = usePromptDialog();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirmDialog();
  const {
    nodes,
    childrenMap,
    currentParentId,
    loading,
    operationLoading: fsOperationLoading,
    error,
    rootId,
    selectedFileIds,
    vfsKey,
    configuredVfsKey,
    initializingKey,
  } = useVfsStore(
    useShallow((state) => ({
      nodes: state.nodes,
      childrenMap: state.childrenMap,
      currentParentId: state.currentParentId,
      selectedFileIds: state.selectedFileIds,
      loading: state.loading,
      operationLoading: state.operationLoading,
      error: state.error,
      rootId: state.rootId,
      vfsKey: state.vfsKey,
      configuredVfsKey: state.configuredVfsKey,
      initializingKey: state.initializingKey,
    }))
  );
  const { selectedItemId, selectedItemType, getConversationById } =
    useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        getConversationById: state.getConversationById,
      }))
    );
  const { getProjectById } = useProjectStore(
    useShallow((state) => ({
      getProjectById: state.getProjectById,
    }))
  );

  const [newName, setNewName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [gitRepoStatus, setGitRepoStatus] = useState<Record<string, boolean>>(
    {}
  );
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [cloneRepoUrl, setCloneRepoUrl] = useState("");
  const [cloneBranch, setCloneBranch] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitPath, setCommitPath] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGitOpLoading, setIsGitOpLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [activePreview, setActivePreview] = useState<ActiveFilePreview | null>(
    null
  );
  const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
  const [previewLoadingPath, setPreviewLoadingPath] = useState<string | null>(
    null
  );
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [localFolderStatus, setLocalFolderStatus] = useState<string | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);
  const projectFolderSyncingRef = useRef(false);
  const projectFolderSyncTimerRef = useRef<number | null>(null);

  const currentDirectory = currentParentId ? nodes[currentParentId] : null;
  const currentPath = currentDirectory ? currentDirectory.path : "/";
  const currentChildrenIds = childrenMap[currentParentId || rootId || ""] || [];
  const currentNodes: VfsNode[] = currentChildrenIds
    .map((id) => nodes[id])
    .filter((node): node is VfsNode => !!node)
    .sort((a, b) => {
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });

  const currentFolderPaths = useMemo(() => {
    return currentNodes.filter((n) => n.type === "folder").map((n) => n.path);
  }, [currentNodes]);

  const isVfsLoading =
    loading || initializingKey !== null || vfsKey !== configuredVfsKey;

  const isAnyOperationLoading =
    fsOperationLoading ||
    isCloning ||
    isCommitting ||
    Object.values(isGitOpLoading).some(Boolean);

  const projectIdForLocalFolder = useMemo(() => {
    if (selectedItemType === "project") return selectedItemId;
    if (selectedItemType === "conversation") {
      return getConversationById(selectedItemId)?.projectId ?? null;
    }
    return null;
  }, [getConversationById, selectedItemId, selectedItemType]);
  const projectFolderVfsPath =
    getProjectById(projectIdForLocalFolder)?.path ?? null;

  useEffect(() => {
    if (
      currentParentId !== null &&
      !childrenMap[currentParentId] &&
      !isVfsLoading &&
      configuredVfsKey === vfsKey
    ) {
      emitter.emit(vfsEvent.fetchNodesRequest, { parentId: currentParentId });
    } else if (
      currentParentId === null &&
      rootId &&
      !childrenMap[rootId] &&
      !isVfsLoading &&
      configuredVfsKey === vfsKey
    ) {
      emitter.emit(vfsEvent.fetchNodesRequest, { parentId: rootId });
    }
  }, [
    currentParentId,
    childrenMap,
    rootId,
    isVfsLoading,
    configuredVfsKey,
    vfsKey,
  ]);

  useEffect(() => {
    if (editingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingPath]);

  useEffect(() => {
    let cancelled = false;
    const loadLocalFolder = async () => {
      if (!projectIdForLocalFolder || !isRealFsSyncSupported()) {
        setLocalFolderName(null);
        setLocalFolderStatus(null);
        return;
      }
      const info = await getProjectDirectoryHandleInfo(projectIdForLocalFolder);
      if (cancelled) return;
      setLocalFolderName(info?.name ?? null);
      setLocalFolderStatus(
        info
          ? t("fileManager.localFolderAutoSyncReady", {
              folderName: info.name,
              defaultValue: `Local: ${info.name} · 1 min`,
            })
          : null
      );
    };
    void loadLocalFolder();
    return () => {
      cancelled = true;
    };
  }, [projectIdForLocalFolder, t]);

  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);

  useEffect(() => {
    const checkGitStatus = async () => {
      if (isVfsLoading || currentFolderPaths.length === 0) return;

      const statusUpdates: Record<string, boolean> = {};
      let changed = false;
      for (const path of currentFolderPaths) {
        try {
          const isRepo = await VfsOps.isGitRepoOp(path);
          if (gitRepoStatus[path] !== isRepo) {
            statusUpdates[path] = isRepo;
            changed = true;
          }
        } catch (e) {
          console.error("Error checking git status for ", path, ":", e);
          if (gitRepoStatus[path] !== false) {
            statusUpdates[path] = false;
            changed = true;
          }
        }
      }
      if (changed) {
        setGitRepoStatus((prev) => ({ ...prev, ...statusUpdates }));
      }
    };
    checkGitStatus();
  }, [currentFolderPaths, isVfsLoading, gitRepoStatus]);

  const runOperation = useCallback(
    async <E extends keyof ModEventPayloadMap>(
      requestEvent: E,
      payload: ModEventPayloadMap[E],
      setLoadingState?: boolean
    ) => {
      if (isAnyOperationLoading || isVfsLoading) return;
      if (setLoadingState !== false)
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: true,
          error: null,
        });

      try {
        emitter.emit(requestEvent, payload);
      } catch (err) {
        console.error("[FileManager Operation Error]:", err);
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: fsOperationLoading,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (setLoadingState !== false)
          emitter.emit(vfsEvent.loadingStateChanged, {
            isLoading: loading,
            operationLoading: false,
            error: error,
          });
      }
    },
    [isAnyOperationLoading, isVfsLoading, loading, fsOperationLoading, error]
  );

  const handleNavigate = useCallback(
    (entry: VfsNode) => {
      if (isAnyOperationLoading || isVfsLoading || editingPath) return;
      if (entry.type === "folder") {
        runOperation(
          vfsEvent.setCurrentPathRequest,
          { path: entry.path },
          false
        );
      }
    },
    [isAnyOperationLoading, isVfsLoading, editingPath, runOperation]
  );

  const handleNavigateUp = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || currentPath === "/") return;
    const parentPath = dirname(currentPath);
    runOperation(vfsEvent.setCurrentPathRequest, { path: parentPath }, false);
  }, [isAnyOperationLoading, isVfsLoading, currentPath, runOperation]);

  const handleNavigateHome = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || currentPath === "/") return;
    runOperation(vfsEvent.setCurrentPathRequest, { path: "/" }, false);
  }, [isAnyOperationLoading, isVfsLoading, currentPath, runOperation]);

  const handleRefresh = useCallback(() => {
    if (isVfsLoading) return;
    runOperation(
      vfsEvent.fetchNodesRequest,
      { parentId: currentParentId },
      false
    );
  }, [runOperation, currentParentId, isVfsLoading]);

  const handleCheckboxChange = useCallback(
    (checked: boolean, nodeId: string) => {
      const node = nodes[nodeId];
      if (node && node.type === "file") {
        if (checked) {
          emitter.emit(vfsEvent.selectFileRequest, { fileId: nodeId });
        } else {
          emitter.emit(vfsEvent.deselectFileRequest, { fileId: nodeId });
        }
      } else if (node && node.type === "folder") {
        toast.info(t("fileManager.foldersCannotBeAttached"));
      }
    },
    [nodes, t]
  );

  const startEditing = useCallback(
    (entry: VfsNode) => {
      if (isAnyOperationLoading || isVfsLoading || creatingFolder) return;
      setEditingPath(entry.path);
      setNewName(entry.name);
      setCreatingFolder(false);
    },
    [isAnyOperationLoading, isVfsLoading, creatingFolder]
  );

  const cancelEditing = useCallback(() => {
    setEditingPath(null);
    setNewName("");
  }, []);

  const handleRename = useCallback(async () => {
    if (!editingPath || !newName.trim()) {
      cancelEditing();
      return;
    }
    const node = Object.values(nodes).find((n) => n.path === editingPath);
    if (node && node.name !== newName.trim()) {
      await runOperation(vfsEvent.renameNodeRequest, {
        id: node.id,
        newName: newName.trim(),
      });
    }
    cancelEditing();
  }, [editingPath, newName, nodes, cancelEditing, runOperation]);

  const startCreatingFolder = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || editingPath) return;
    setCreatingFolder(true);
    setNewFolderName("");
    setEditingPath(null);
  }, [isAnyOperationLoading, isVfsLoading, editingPath]);

  const cancelCreatingFolder = useCallback(() => {
    setCreatingFolder(false);
    setNewFolderName("");
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      cancelCreatingFolder();
      return;
    }
    await runOperation(vfsEvent.createDirectoryRequest, {
      parentId: currentParentId,
      name: newFolderName.trim(),
    });
    cancelCreatingFolder();
  }, [newFolderName, currentParentId, cancelCreatingFolder, runOperation]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFolderUploadClick = () => folderInputRef.current?.click();
  const handleArchiveUploadClick = () => archiveInputRef.current?.click();

  const runProjectFolderSync = useCallback(
    async (showToast = false) => {
      if (!projectIdForLocalFolder || isAnyOperationLoading || isVfsLoading) {
        return;
      }
      if (!projectFolderVfsPath) {
        if (showToast) {
          toast.error(t("fileManager.selectProjectBeforeLocalFolder", "Select a project first."));
        }
        return;
      }
      if (projectFolderSyncingRef.current) return;
      const fsInstance = useVfsStore.getState().fs;
      if (!fsInstance) {
        if (showToast) toast.error(t("fileManager.filesystemNotReady"));
        return;
      }

      try {
        projectFolderSyncingRef.current = true;
        setLocalFolderStatus(
          t("fileManager.localFolderSyncing", "Syncing local folder...")
        );
        const result = await syncProjectDirectoryTwoWay(
          projectIdForLocalFolder,
          fsInstance,
          projectFolderVfsPath
        );
        const message = describeRealFsSyncResult("two-way", result);
        setLocalFolderStatus(message);
        if (showToast) toast.success(message);
        emitter.emit(vfsEvent.fetchNodesRequest, {
          parentId: currentParentId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Project folder sync error:", err);
        setLocalFolderStatus(message);
        if (showToast) toast.error(message);
      } finally {
        projectFolderSyncingRef.current = false;
      }
    },
    [
      currentParentId,
      isAnyOperationLoading,
      isVfsLoading,
      projectFolderVfsPath,
      projectIdForLocalFolder,
      t,
    ]
  );

  useEffect(() => {
    if (!localFolderName || !projectIdForLocalFolder) return;
    const interval = window.setInterval(() => {
      void runProjectFolderSync(false);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [localFolderName, projectIdForLocalFolder, runProjectFolderSync]);

  useEffect(() => {
    if (!localFolderName || !projectFolderVfsPath) return;

    const isProjectPath = (path: string) =>
      path === projectFolderVfsPath || path.startsWith(`${projectFolderVfsPath}/`);
    const queueSync = ({ path }: { path: string }) => {
      if (!isProjectPath(path) || projectFolderSyncingRef.current) return;
      if (projectFolderSyncTimerRef.current !== null) {
        window.clearTimeout(projectFolderSyncTimerRef.current);
      }
      setLocalFolderStatus(
        t("fileManager.localFolderSyncQueued", "Local folder sync queued...")
      );
      projectFolderSyncTimerRef.current = window.setTimeout(() => {
        projectFolderSyncTimerRef.current = null;
        void runProjectFolderSync(false);
      }, 1500);
    };

    emitter.on(vfsEvent.fileWritten, queueSync);
    emitter.on(vfsEvent.fileDeleted, queueSync);
    return () => {
      emitter.off(vfsEvent.fileWritten, queueSync);
      emitter.off(vfsEvent.fileDeleted, queueSync);
      if (projectFolderSyncTimerRef.current !== null) {
        window.clearTimeout(projectFolderSyncTimerRef.current);
        projectFolderSyncTimerRef.current = null;
      }
    };
  }, [localFolderName, projectFolderVfsPath, runProjectFolderSync, t]);

  const handleConnectProjectFolder = useCallback(async () => {
    if (!projectIdForLocalFolder || !projectFolderVfsPath) {
      toast.error(t("fileManager.selectProjectBeforeLocalFolder", "Select a project first."));
      return;
    }
    if (isAnyOperationLoading || isVfsLoading) return;
    const fsInstance = useVfsStore.getState().fs;
    if (!fsInstance) {
      toast.error(t("fileManager.filesystemNotReady"));
      return;
    }

    try {
      const directoryHandle = await pickProjectDirectory(projectIdForLocalFolder);
      setLocalFolderName(directoryHandle.name);
      setLocalFolderStatus(
        t("fileManager.localFolderConnected", {
          folderName: directoryHandle.name,
          defaultValue: `Local: ${directoryHandle.name} connected`,
        })
      );
      const result = await syncRealDirectoryTwoWay({
        fsInstance,
        vfsPath: projectFolderVfsPath,
        directoryHandle,
      });
      const message = describeRealFsSyncResult("two-way", result);
      setLocalFolderStatus(message);
      toast.success(message);
      emitter.emit(vfsEvent.fetchNodesRequest, {
        parentId: currentParentId,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      console.error("Project folder connect error:", err);
      setLocalFolderStatus(message);
      toast.error(message);
    }
  }, [
    currentParentId,
    isAnyOperationLoading,
    isVfsLoading,
    projectFolderVfsPath,
    projectIdForLocalFolder,
    t,
  ]);

  const handleProjectFolderSyncNow = useCallback(() => {
    void runProjectFolderSync(true);
  }, [runProjectFolderSync]);

  const handleCreateFile = useCallback(async () => {
    if (isAnyOperationLoading || isVfsLoading || editingPath) return;
    const name = await promptDialog({
      title: t("fileManager.createFilePrompt", "New file name"),
      defaultValue: "notes.md",
      confirmLabel: t("common:create", "Create"),
      cancelLabel: t("common:cancel", "Cancel"),
    });
    if (!name?.trim()) return;
    void runOperation(vfsEvent.createFileRequest, {
      parentId: currentParentId,
      name: name.trim(),
    });
  }, [
    currentParentId,
    editingPath,
    isAnyOperationLoading,
    isVfsLoading,
    promptDialog,
    runOperation,
    t,
  ]);

  const handleMoveSelected = useCallback(async () => {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0 || isAnyOperationLoading || isVfsLoading) return;
    const targetPath = await promptDialog({
      title: t("fileManager.moveSelectedPrompt", "Move selected files to folder path"),
      defaultValue: currentPath,
      confirmLabel: t("common:ok", "OK"),
      cancelLabel: t("common:cancel", "Cancel"),
    });
    if (targetPath === null) return;
    void runOperation(vfsEvent.moveNodesRequest, {
      ids,
      targetPath: targetPath.trim() || "/",
    });
  }, [
    currentPath,
    isAnyOperationLoading,
    isVfsLoading,
    promptDialog,
    runOperation,
    selectedFileIds,
    t,
  ]);

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0 || isAnyOperationLoading || isVfsLoading) return;
    const confirmation = await confirmDialog({
      title: t("fileManager.deleteSelectedConfirmation", {
        count: ids.length,
        defaultValue: `Delete ${ids.length} selected file(s)?`,
      }),
      confirmLabel: t("common:delete", "Delete"),
      cancelLabel: t("common:cancel", "Cancel"),
      destructive: true,
    });
    if (!confirmation) return;
    void runOperation(vfsEvent.deleteNodesRequest, { ids });
  }, [confirmDialog, isAnyOperationLoading, isVfsLoading, runOperation, selectedFileIds, t]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await runOperation(vfsEvent.uploadFilesRequest, {
          parentId: currentParentId,
          files,
        });
        if (e.target) e.target.value = "";
      }
    },
    [currentParentId, runOperation]
  );

  const handleArchiveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: true,
          error: null,
        });
        try {
          await VfsOps.uploadAndExtractZipOp(file, currentPath);
          emitter.emit(vfsEvent.fetchNodesRequest, {
            parentId: currentParentId,
          });
        } catch (err) {
          console.error("Archive upload error:", err);
        } finally {
          emitter.emit(vfsEvent.loadingStateChanged, {
            isLoading: loading,
            operationLoading: false,
            error: error,
          });
          if (e.target) e.target.value = "";
        }
      }
    },
    [currentPath, currentParentId, loading, error]
  );

  const handleDelete = useCallback(
    async (entry: VfsNode) => {
      const description =
        t("fileManager.deleteConfirmation", { type: entry.type, name: entry.name }) +
        (entry.type === "folder"
          ? `\n\n` + t("fileManager.warningDeleteFolder")
          : "");
      const confirmation = await confirmDialog({
        title: t("fileManager.deleteConfirmationTitle", "Delete item"),
        description,
        confirmLabel: t("common:delete", "Delete"),
        cancelLabel: t("common:cancel", "Cancel"),
        destructive: true,
      });
      if (confirmation) {
        await runOperation(vfsEvent.deleteNodesRequest, { ids: [entry.id] });
      }
    },
    [confirmDialog, runOperation, t]
  );

  const handleDownload = useCallback(
    async (entry: VfsNode) => {
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: loading,
        operationLoading: true,
        error: null,
      });
      try {
        if (entry.type === "file") {
          await VfsOps.downloadFileOp(entry.path);
        } else {
          await VfsOps.downloadAllAsZipOp(`${entry.name}.zip`, entry.path);
        }
      } catch (err) {
        console.error("Download error:", err);
      } finally {
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: false,
          error: error,
        });
      }
    },
    [loading, error]
  );

  const handlePreview = useCallback(
    async (entry: VfsNode) => {
      if (entry.type !== "file" || previewLoadingPath) return;

      const descriptor = inferFilePreviewDescriptor({
        name: entry.name,
        path: entry.path,
        size: entry.size,
        mimeType: entry.mimeType,
      });

      if (!descriptor.canPreview) {
        toast.info(
          descriptor.reason ??
            t("fileManager.previewUnavailable", "Preview unavailable.")
        );
        return;
      }

      const fsInstance = useVfsStore.getState().fs;
      if (!fsInstance) {
        toast.error(t("fileManager.filesystemNotReady"));
        return;
      }

      setPreviewLoadingPath(entry.path);
      try {
        const data = await VfsOps.readFileOp(entry.path, {
          fsInstance,
          silent: true,
        });
        setActivePreview({ entry, descriptor, data });
        setIsFilePreviewOpen(true);
      } catch (err) {
        console.error("Preview error:", err);
        toast.error(
          err instanceof Error
            ? err.message
            : t("fileManager.previewFailed", "Could not preview file.")
        );
      } finally {
        setPreviewLoadingPath(null);
      }
    },
    [previewLoadingPath, t]
  );

  const handleDownloadAll = useCallback(async () => {
    if (currentNodes.length === 0) return;
    emitter.emit(vfsEvent.loadingStateChanged, {
      isLoading: loading,
      operationLoading: true,
      error: null,
    });
    try {
      const dirName = basename(currentPath) || "root";
      await VfsOps.downloadAllAsZipOp(`${dirName}_export.zip`, currentPath);
    } catch (err) {
      console.error("Download all error:", err);
    } finally {
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: loading,
        operationLoading: false,
        error: error,
      });
    }
  }, [currentPath, currentNodes.length, loading, error]);

  const runGitOperation = useCallback(
    async (path: string, op: () => Promise<any>) => {
      if (isGitOpLoading[path] || isVfsLoading || fsOperationLoading) return;
      setIsGitOpLoading((prev) => ({ ...prev, [path]: true }));
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: loading,
        operationLoading: fsOperationLoading,
        error: null,
      });
      try {
        await op();
      } catch (err) {
        console.error("[FileManager Git Op Error @ ", path, "]:", err);
      } finally {
        setIsGitOpLoading((prev) => ({ ...prev, [path]: false }));
      }
    },
    [isGitOpLoading, isVfsLoading, fsOperationLoading, loading]
  );

  const handleGitInit = useCallback(
    (path: string) => {
      runGitOperation(path, async () => {
        await VfsOps.gitInitOp(path);
        setGitRepoStatus((prev) => ({ ...prev, [path]: true }));
      });
    },
    [runGitOperation]
  );

  const handleGitPull = useCallback(
    (path: string) => {
      toast.info(t("fileManager.pullingDefaultBranch"));
      runGitOperation(path, () => VfsOps.gitPullOp(path, "main"));
    },
    [runGitOperation, t]
  );

  const handleGitCommit = useCallback((path: string) => {
    setCommitPath(path);
    setCommitMessage("");
    setIsCommitDialogOpen(true);
  }, []);

  const handleGitPush = useCallback(
    (path: string) => {
      toast.info(t("fileManager.pushingDefaultBranch"));
      runGitOperation(path, () => VfsOps.gitPushOp(path, "main"));
    },
    [runGitOperation, t]
  );

  const handleGitStatus = useCallback(
    (path: string) => {
      runGitOperation(path, () => VfsOps.gitStatusOp(path));
    },
    [runGitOperation]
  );

  const handleCloneClick = useCallback(() => {
    setCloneRepoUrl("");
    setCloneBranch("");
    setIsCloneDialogOpen(true);
  }, []);

  const onSubmitClone = useCallback(async () => {
    if (!cloneRepoUrl.trim()) {
      toast.error(t("fileManager.repositoryUrlEmpty"));
      return;
    }
    setIsCloning(true);
    emitter.emit(vfsEvent.loadingStateChanged, {
      isLoading: loading,
      operationLoading: fsOperationLoading,
      error: null,
    });
    try {
      const repoName =
        basename(cloneRepoUrl.trim().replace(/\.git$/, "")) || "cloned_repo";
      const cloneTargetPath = buildPath(currentPath, repoName);

      await VfsOps.gitCloneOp(
        cloneTargetPath,
        cloneRepoUrl.trim(),
        cloneBranch.trim() || undefined
      );
      setIsCloneDialogOpen(false);
      emitter.emit(vfsEvent.fetchNodesRequest, { parentId: currentParentId });
    } catch {
      // Error handled by gitCloneOp
    } finally {
      setIsCloning(false);
    }
  }, [
    cloneRepoUrl,
    cloneBranch,
    currentPath,
    currentParentId,
    loading,
    fsOperationLoading,
    t,
  ]);

  const onSubmitCommit = useCallback(async () => {
    if (!commitPath || !commitMessage.trim()) {
      toast.error(t("fileManager.commitMessageEmpty"));
      return;
    }
    setIsCommitting(true);
    emitter.emit(vfsEvent.loadingStateChanged, {
      isLoading: loading,
      operationLoading: fsOperationLoading,
      error: null,
    });
    try {
      await VfsOps.gitCommitOp(commitPath, commitMessage.trim());
      setIsCommitDialogOpen(false);
    } catch {
      // Error handled by gitCommitOp
    } finally {
      setIsCommitting(false);
    }
  }, [commitPath, commitMessage, loading, fsOperationLoading, t]);

  if (isVfsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card text-muted-foreground p-4">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p>
          {initializingKey
            ? t("fileManager.initializingFilesystem", { key: initializingKey })
            : t("fileManager.loadingFilesystem")}
        </p>
        {error && <p className="text-destructive mt-2">{t("fileManager.errorPrefix")}{error}</p>}
      </div>
    );
  }

  if (error && !isVfsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card text-destructive p-4">
        <p>{t("fileManager.errorLoadingFilesystem", { error: error })}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            emitter.emit(vfsEvent.initializeVFSRequest, {
              vfsKey: vfsKey || "default_fallback_key",
            })
          }
          className="mt-2"
        >
          {t("fileManager.retry")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <PromptDialog />
      <ConfirmDialog />
      <div className={cn("flex h-full flex-col bg-card text-card-foreground")}>
      <FileManagerToolbar
        currentPath={currentPath}
        isAnyLoading={isAnyOperationLoading || isVfsLoading}
        isOperationLoading={fsOperationLoading}
        entries={currentNodes}
        editingPath={editingPath}
        creatingFolder={creatingFolder}
        handleNavigateHome={handleNavigateHome}
        handleNavigateUp={handleNavigateUp}
        handleRefresh={handleRefresh}
        startCreatingFolder={startCreatingFolder}
        handleCreateFile={handleCreateFile}
        handleUploadClick={handleUploadClick}
        handleFolderUploadClick={handleFolderUploadClick}
        handleArchiveUploadClick={handleArchiveUploadClick}
        handleConnectProjectFolder={handleConnectProjectFolder}
        handleProjectFolderSyncNow={handleProjectFolderSyncNow}
        localFolderName={localFolderName}
        localFolderStatus={localFolderStatus}
        selectedCount={selectedFileIds.size}
        handleMoveSelected={handleMoveSelected}
        handleDeleteSelected={handleDeleteSelected}
        handleDownloadAll={handleDownloadAll}
        handleCloneClick={handleCloneClick}
        isRealFsSyncSupported={isRealFsSyncSupported()}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        archiveInputRef={archiveInputRef}
        handleFileChange={handleFileChange}
        handleArchiveChange={handleArchiveChange}
        gitRepoStatus={gitRepoStatus}
      />
      <div className="flex-grow overflow-auto hidden md:block">
        <FileManagerTable
          entries={currentNodes}
          editingPath={editingPath}
          newName={newName}
          creatingFolder={creatingFolder}
          newFolderName={newFolderName}
          selectedFileIds={selectedFileIds}
          isOperationLoading={isAnyOperationLoading}
          handleNavigate={handleNavigate}
          handleCheckboxChange={handleCheckboxChange}
          startEditing={startEditing}
          cancelEditing={cancelEditing}
          handleRename={handleRename}
          cancelCreatingFolder={cancelCreatingFolder}
          handleCreateFolder={handleCreateFolder}
          handleDownload={handleDownload}
          handlePreview={handlePreview}
          handleDelete={handleDelete}
          setNewName={setNewName}
          setNewFolderName={setNewFolderName}
          renameInputRef={renameInputRef}
          newFolderInputRef={newFolderInputRef}
          gitRepoStatus={gitRepoStatus}
          handleGitInit={handleGitInit}
          handleGitPull={handleGitPull}
          handleGitCommit={handleGitCommit}
          handleGitPush={handleGitPush}
          handleGitStatus={handleGitStatus}
          previewLoadingPath={previewLoadingPath}
        />
      </div>
      <div className="flex-grow overflow-auto block md:hidden">
        <FileManagerList
          entries={currentNodes}
          editingPath={editingPath}
          newName={newName}
          creatingFolder={creatingFolder}
          newFolderName={newFolderName}
          selectedFileIds={selectedFileIds}
          isOperationLoading={isAnyOperationLoading}
          handleNavigate={handleNavigate}
          handleCheckboxChange={handleCheckboxChange}
          startEditing={startEditing}
          cancelEditing={cancelEditing}
          handleRename={handleRename}
          cancelCreatingFolder={cancelCreatingFolder}
          handleCreateFolder={handleCreateFolder}
          handleDownload={handleDownload}
          handlePreview={handlePreview}
          handleDelete={handleDelete}
          setNewName={setNewName}
          setNewFolderName={setNewFolderName}
          renameInputRef={renameInputRef}
          newFolderInputRef={newFolderInputRef}
          gitRepoStatus={gitRepoStatus}
          handleGitInit={handleGitInit}
          handleGitPull={handleGitPull}
          handleGitCommit={handleGitCommit}
          handleGitPush={handleGitPush}
          handleGitStatus={handleGitStatus}
          previewLoadingPath={previewLoadingPath}
        />
      </div>
      <CloneDialog
        isOpen={isCloneDialogOpen}
        onOpenChange={setIsCloneDialogOpen}
        cloneRepoUrl={cloneRepoUrl}
        setCloneRepoUrl={setCloneRepoUrl}
        cloneBranch={cloneBranch}
        setCloneBranch={setCloneBranch}
        isCloning={isCloning}
        onSubmitClone={onSubmitClone}
        currentPath={currentPath}
      />
      <CommitDialog
        isOpen={isCommitDialogOpen}
        onOpenChange={setIsCommitDialogOpen}
        commitPath={commitPath}
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        isCommitting={isCommitting}
        onSubmitCommit={onSubmitCommit}
      />
      <FilePreviewDialog
        open={isFilePreviewOpen}
        onOpenChange={setIsFilePreviewOpen}
        descriptor={activePreview?.descriptor ?? null}
        data={activePreview?.data ?? null}
        onDownload={
          activePreview
            ? () => {
                void handleDownload(activePreview.entry);
              }
            : undefined
        }
      />
    </div>
    </>
  );
});
FileManager.displayName = "FileManager";
