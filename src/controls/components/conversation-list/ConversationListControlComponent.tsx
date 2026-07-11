// src/controls/components/conversation-list/ConversationListControlComponent.tsx
// FULL FILE
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  useConversationStore,
  type SidebarItem,
} from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useVfsStore } from "@/store/vfs.store";
import { useUIStateStore } from "@/store/ui.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BookOpenTextIcon,
  DownloadIcon,
  FileTextIcon,
  FilesIcon,
  FolderIcon,
  FolderPlusIcon,
  GitBranchIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { SidebarItemType } from "@/types/llmchef/chat";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { Project } from "@/types/llmchef/project";
import type { Conversation } from "@/types/llmchef/chat";
import { ConversationItemRenderer } from "./ItemRenderer";
import { useItemEditing } from "@/hooks/llmchef/useItemEditing";
import { usePromptDialog } from "@/hooks/usePromptDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { ConversationListControlModule } from "@/controls/modules/ConversationListControlModule";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lnk } from "@/components/ui/lnk";
import { GithubIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { APP_VFS_KEY } from "@/lib/llmchef/constants";
import { createCrea8VfsConnector } from "@/lib/llmchef/crea8-vfs-connector";
import { parseCrea8MarkdownNote } from "@/lib/llmchef/crea8-memory";
import {
  joinPath,
  normalizePath,
} from "@/lib/llmchef/file-manager-utils";
import {
  createDirectoryOp,
  listFilesOp,
  readFileOp,
} from "@/lib/llmchef/vfs-operations";
import { cn } from "@/lib/utils";
import { emitter } from "@/lib/llmchef/event-emitter";
import { uiEvent } from "@/types/llmchef/events/ui.events";
import { vfsEvent } from "@/types/llmchef/events/vfs.events";
import {
  useDocumentWorkspaceStore,
  type DocumentNavDoc,
  type DocumentSyncState,
} from "@/store/document-workspace.store";

type ProjectSectionKind = "chats" | "wiki" | "files" | "git";

interface ProjectSectionItem {
  itemType: "project-section";
  project: Project;
  section: ProjectSectionKind;
  count?: number;
}

interface WikiFolderItem {
  itemType: "wiki-folder";
  project: Project;
  name: string;
  path: string;
}

interface WikiDocumentItem {
  itemType: "wiki-doc";
  project: Project;
  doc: DocumentNavDoc;
}

interface WikiSyncItem {
  itemType: "wiki-sync";
  project: Project;
  sync: DocumentSyncState | null;
}

type WikiTreeNode = {
  name: string;
  path: string;
  children: WikiTreeNode[];
  item?: DocumentNavDoc;
};

export interface VirtualListItem {
  id: string; // Unique ID for the virtual list item (e.g., `project-${projectId}` or `conversation-${conversationId}`)
  originalId: string; // The actual ID of the project or conversation
  type: SidebarItemType | "project-section" | "wiki-folder" | "wiki-doc" | "wiki-sync";
  level: number;
  data:
    | Project
    | Conversation
    | ProjectSectionItem
    | WikiFolderItem
    | WikiDocumentItem
    | WikiSyncItem; // The actual project, conversation, project section, or wiki row data
  updatedAt: Date; // For sorting
}

const itemMatchesFilterOrHasMatchingDescendant = (
  itemId: string,
  itemType: SidebarItemType,
  lowerCaseFilter: string,
  allProjects: Project[],
  allConversations: Conversation[],
  projectsById: Map<string, Project>,
  conversationsByProjectId: Map<string | null, Conversation[]>,
  projectsByParentId: Map<string | null, Project[]>,
  memo: Record<string, boolean>
): boolean => {
  if (!lowerCaseFilter) return true;
  const cacheKey = `${itemType}-${itemId}`;
  if (memo[cacheKey] !== undefined) return memo[cacheKey];
  let matches = false;
  if (itemType === "project") {
    const project = projectsById.get(itemId);
    if (project) {
      if (project.name.toLowerCase().includes(lowerCaseFilter)) {
        matches = true;
      } else {
        const childProjects = projectsByParentId.get(itemId) || [];
        const childConversations = conversationsByProjectId.get(itemId) || [];
        for (const child of childConversations) {
          if (child.title.toLowerCase().includes(lowerCaseFilter)) {
            matches = true;
            break;
          }
        }
        if (!matches) {
          for (const child of childProjects) {
            if (
              itemMatchesFilterOrHasMatchingDescendant(
                child.id,
                "project",
                lowerCaseFilter,
                allProjects,
                allConversations,
                projectsById,
                conversationsByProjectId,
                projectsByParentId,
                memo
              )
            ) {
              matches = true;
              break;
            }
          }
        }
      }
    }
  } else {
    const conversation = allConversations.find((c) => c.id === itemId);
    if (
      conversation &&
      conversation.title.toLowerCase().includes(lowerCaseFilter)
    ) {
      matches = true;
    }
  }
  memo[cacheKey] = matches;
  return matches;
};

const wikiPageSlug = (title: string): string =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "page";

const ensureAppVfs = async () => {
  const store = useVfsStore.getState();
  if (store.vfsKey !== APP_VFS_KEY) {
    store.setVfsKey(APP_VFS_KEY);
  }
  const current = useVfsStore.getState();
  if (current.configuredVfsKey === APP_VFS_KEY && current.fs) {
    return current.fs;
  }
  return current.initializeVFS(APP_VFS_KEY);
};

const RAIL_WIKI_IGNORED_NAMES = new Set([".git", ".llmchef"]);

const workspacePathParts = (path: string, rootPath: string): string[] => {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(rootPath);
  const relative =
    normalizedPath === normalizedRoot
      ? ""
      : normalizedPath.startsWith(`${normalizedRoot}/`)
        ? normalizedPath.slice(normalizedRoot.length + 1)
        : normalizedPath.replace(/^\/+/, "");
  return relative.split("/").filter(Boolean);
};

const wikiLabelFromName = (name: string): string =>
  name.replace(/\.(md|markdown|mdx)$/i, "");

const addWikiTreePath = (
  root: WikiTreeNode,
  parts: string[],
  item: DocumentNavDoc,
): void => {
  let current = root;
  let path = root.path;

  parts.forEach((part, index) => {
    path = joinPath(path, part);
    const isFile = index === parts.length - 1;
    let child = current.children.find((node) => node.name === part);

    if (!child) {
      child = { name: part, path, children: [] };
      current.children.push(child);
    }

    if (isFile) child.item = item;
    current = child;
  });
};

const sortWikiTree = (node: WikiTreeNode): WikiTreeNode => ({
  ...node,
  children: node.children
    .map(sortWikiTree)
    .sort((first, second) => {
      if (Boolean(first.item) !== Boolean(second.item)) {
        return first.item ? 1 : -1;
      }
      return first.name.localeCompare(second.name);
    }),
});

const buildWikiTree = (
  docs: DocumentNavDoc[],
  rootPath: string,
  rootName: string,
): WikiTreeNode => {
  const root: WikiTreeNode = { name: rootName, path: rootPath, children: [] };
  docs.forEach((doc) => {
    const parts = doc.relativePath
      ? doc.relativePath.split("/").filter(Boolean)
      : workspacePathParts(doc.path, rootPath);
    addWikiTreePath(root, parts, doc);
  });
  return sortWikiTree(root);
};

const listProjectWikiDocs = async (
  rootPath: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<DocumentNavDoc[]> => {
  const docs: DocumentNavDoc[] = [];

  const visit = async (path: string) => {
    const entries = await listFilesOp(path, { fsInstance });
    for (const entry of entries) {
      if (RAIL_WIKI_IGNORED_NAMES.has(entry.name)) continue;
      if (entry.isDirectory) {
        await visit(entry.path);
        continue;
      }
      if (!/\.(md|markdown|mdx)$/i.test(entry.name)) continue;

      let label = wikiLabelFromName(entry.name);
      let snippet = "";
      let kind: DocumentNavDoc["kind"] = "file";
      try {
        const data = await readFileOp(entry.path, {
          fsInstance,
          silent: true,
        });
        const text = new TextDecoder().decode(data.slice(0, 200_000)).trim();
        snippet = text.slice(0, 220);
        const note = parseCrea8MarkdownNote(text, entry.path);
        label = note.title || label;
        snippet = note.content.slice(0, 220);
        kind = "crea8";
      } catch {
        // Best-effort labels are enough for rail navigation.
      }

      docs.push({
        kind,
        name: entry.name,
        path: entry.path,
        type: "text/markdown",
        updatedAt: entry.lastModified,
        snippet,
        label,
        relativePath: workspacePathParts(entry.path, rootPath).join("/"),
        previewKind: "markdown",
        isWiki: true,
      });
    }
  };

  await visit(rootPath);
  return docs.sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath),
  );
};

const projectSectionConfig = {
  chats: {
    label: "Conversations",
    icon: FolderIcon,
    description: "Conversation history",
  },
  wiki: {
    label: "Wiki",
    icon: BookOpenTextIcon,
    description: "Notes and knowledge base",
  },
  files: {
    label: "Files",
    icon: FilesIcon,
    description: "Project filesystem",
  },
  git: {
    label: "Git",
    icon: GitBranchIcon,
    description: "Project sync",
  },
} satisfies Record<
  ProjectSectionKind,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
>;

interface ProjectSectionRowProps {
  item: ProjectSectionItem;
  level: number;
  isActive: boolean;
  onOpen: (project: Project, section: ProjectSectionKind) => void;
}

const ProjectSectionRow: React.FC<ProjectSectionRowProps> = ({
  item,
  level,
  isActive,
  onOpen,
}) => {
  const config = projectSectionConfig[item.section];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors",
              isActive
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            style={{ paddingLeft: `${level * 12 + 10}px` }}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item.project, item.section);
            }}
            aria-label={`${config.label} for ${item.project.name}`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 flex-1 truncate">{config.label}</span>
            {typeof item.count === "number" ? (
              <span className="rounded border border-border px-1 text-[10px] leading-4 text-muted-foreground">
                {item.count}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const WikiFolderRow: React.FC<{
  item: WikiFolderItem;
  level: number;
}> = ({ item, level }) => {
  const isLoading = item.name === "Loading wiki...";
  return (
    <div
      className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground"
      style={{ paddingLeft: `${level * 12 + 10}px` }}
    >
      {isLoading ? (
        <Loader2Icon className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <FolderIcon className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
    </div>
  );
};

const WikiDocumentRow: React.FC<{
  item: WikiDocumentItem;
  level: number;
  isActive: boolean;
  onOpen: (project: Project, doc: DocumentNavDoc) => void;
}> = ({ item, level, isActive, onOpen }) => (
  <button
    type="button"
    className={cn(
      "group flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    )}
    style={{ paddingLeft: `${level * 12 + 10}px` }}
    onClick={(event) => {
      event.stopPropagation();
      onOpen(item.project, item.doc);
    }}
    aria-label={`Open ${item.doc.label}`}
  >
    <FileTextIcon className="h-3.5 w-3.5 shrink-0" />
    <span className="min-w-0 flex-1 truncate">{item.doc.label}</span>
  </button>
);

const WikiSyncRow: React.FC<{
  item: WikiSyncItem;
  level: number;
}> = ({ item, level }) => {
  const sync = item.sync;
  const syncing = sync?.syncingLocalFolder ?? false;
  return (
    <div
      className="llmchef-rail-sync mx-1 rounded-md border border-border bg-background p-2 text-xs shadow-xs"
      style={{ marginLeft: `${level * 12 + 10}px` }}
    >
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <span className="font-medium text-muted-foreground">Sync</span>
        <Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 text-[10px]">
          {sync?.localFolderName ? "local linked" : "local only"}
        </Badge>
      </div>
      <p className="mb-2 line-clamp-2 text-muted-foreground">
        {sync?.localFolderStatus ??
          "Use Git from the project row, or connect a local folder for browser filesystem sync."}
      </p>
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            sync?.connectLocalFolder?.();
          }}
          disabled={!sync || syncing || !sync.localSyncSupported}
        >
          <FolderPlusIcon className={syncing ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
          Local
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            sync?.syncLocalFolderNow?.();
          }}
          disabled={!sync || !sync.localFolderName || syncing}
        >
          <RefreshCwIcon className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Sync
        </Button>
      </div>
    </div>
  );
};

interface ConversationListControlComponentProps {
  module: ConversationListControlModule;
}

export const ConversationListControlComponent: React.FC<
  ConversationListControlComponentProps
> = ({ module }) => {
  const { t } = useTranslation('controls');
  const { prompt, PromptDialog } = usePromptDialog();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const listRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportReady, setViewportReady] = useState(false);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    if (
      module.isLoading &&
      !useConversationStore.getState().isLoading &&
      !useProjectStore.getState().isLoading
    ) {
      module.setIsLoading(false);
    }
    return () => module.setNotifyCallback(null);
  }, [module]);

  useEffect(() => {
    const currentScrollArea = listRef.current;
    if (currentScrollArea) {
      const viewportElement = currentScrollArea.querySelector<HTMLDivElement>(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewportElement && viewportRef.current !== viewportElement) {
        viewportRef.current = viewportElement;
        if (!viewportReady) setViewportReady(true);
        forceUpdate({});
      } else if (!viewportElement && viewportRef.current) {
        viewportRef.current = null;
        setViewportReady(false);
      }
      if (!viewportRef.current) {
        const observer = new MutationObserver(() => {
          const vp = currentScrollArea.querySelector<HTMLDivElement>(
            "[data-radix-scroll-area-viewport]"
          );
          if (vp && viewportRef.current !== vp) {
            viewportRef.current = vp;
            setViewportReady(true);
            forceUpdate({});
            observer.disconnect();
          }
        });
        observer.observe(currentScrollArea, { childList: true, subtree: true });
        return () => observer.disconnect();
      }
    }
  }, [viewportReady]);

  const {
    selectedItemId,
    selectedItemType,
    conversations,
    syncRepos,
    conversationSyncStatus,
    selectItem,
    addConversation,
    updateConversation,
    deleteConversation,
    exportConversation,
    exportProject,
    getConversationById,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      conversations: state.conversations,
      syncRepos: state.syncRepos,
      conversationSyncStatus: state.conversationSyncStatus,
      selectItem: state.selectItem,
      addConversation: state.addConversation,
      updateConversation: state.updateConversation,
      deleteConversation: state.deleteConversation,
      exportConversation: state.exportConversation,
      exportProject: state.exportProject,
      getConversationById: state.getConversationById,
    }))
  );

  const { projects, addProject, updateProject, deleteProject, getProjectById } =
    useProjectStore(
      useShallow((state) => ({
        projects: state.projects,
        addProject: state.addProject,
        updateProject: state.updateProject,
        deleteProject: state.deleteProject,
        getProjectById: state.getProjectById,
      }))
    );
  const { workspaceMode, setWorkspaceMode } = useUIStateStore(
    useShallow((state) => ({
      workspaceMode: state.workspaceMode,
      setWorkspaceMode: state.setWorkspaceMode,
    })),
  );
  const documentProjects = useDocumentWorkspaceStore(
    (state) => state.projects,
  );
  const setProjectNavigation = useDocumentWorkspaceStore(
    (state) => state.setProjectNavigation,
  );
  const requestOpenDocument = useDocumentWorkspaceStore(
    (state) => state.requestOpenDocument,
  );

  const isLoading = module.isLoading;

  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set()
  );
  const [filterText, setFilterText] = useState("");

  const editingState = useItemEditing({
    updateProject,
    updateConversation,
    deleteProject,
  });

  const {
    editingItemId,
    editingItemType,
    isSavingEdit,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
    originalNameToCompare,
  } = editingState;

  const toggleProjectExpansion = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleDeleteItem = useCallback(async (item: SidebarItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemName = item.itemType === 'project' ? (item as Project).name : (item as Conversation).title;
    const confirmed = await confirm({
      title: t('conversationList.confirmDeleteTitle', 'Confirm deletion'),
      description: t('conversationList.confirmDeleteConversation', {
        defaultValue: `Are you sure you want to delete "{{itemName}}"?`,
        itemName,
      }),
      confirmLabel: t('conversationList.deleteConfirm', 'Delete'),
      cancelLabel: t('conversationList.deleteCancel', 'Cancel'),
      destructive: true,
    });
    if (confirmed) {
      if (item.itemType === "project") {
        deleteProject(item.id);
      } else {
        deleteConversation(item.id);
      }
    }
  }, [deleteProject, deleteConversation, t, confirm]);

  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      selectItem(id, type);
      if (type === "project") {
        setWorkspaceMode("documents");
      } else if (type === "conversation") {
        setWorkspaceMode("chat");
      }
    },
    [selectItem, setWorkspaceMode]
  );

  const getParentProjectId = useCallback(() => {
    if (selectedItemType === "project") {
      return selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = getConversationById(selectedItemId);
      return convo?.projectId ?? null;
    }
    return null;
  }, [selectedItemId, selectedItemType, getConversationById]);

  const ensureProjectForNewChat = useCallback(async () => {
    const parentProjectId = getParentProjectId();
    if (parentProjectId) return parentProjectId;

    const newProjectId = await addProject({
      name: t('conversationList.newProject'),
      parentId: null,
    });
    setExpandedProjects((prev) => new Set(prev).add(newProjectId));
    toast.success("Created a project for this chat.");
    return newProjectId;
  }, [addProject, getParentProjectId, t]);

  const handleNewChat = useCallback(async () => {
    if (editingItemId) return;
    try {
      const parentProjectId = await ensureProjectForNewChat();
      const newId = await addConversation({
        title: t('conversationList.newChat'),
        projectId: parentProjectId,
      });
      selectItem(newId, "conversation");
      setWorkspaceMode("chat");
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error(t('conversationList.newChatError'));
    }
  }, [editingItemId, ensureProjectForNewChat, addConversation, selectItem, setWorkspaceMode, t]);

  const handleNewProject = useCallback(async () => {
    if (editingItemId) return;
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addProject({
        name: t('conversationList.newProject'),
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      setWorkspaceMode("documents");
      if (parentProjectId) {
        setExpandedProjects((prev) => new Set(prev).add(parentProjectId));
      }
      setTimeout(() => {
        const newProjectData = getProjectById(newId);
        if (newProjectData) {
          handleStartEditing({ ...newProjectData, itemType: "project" });
        }
      }, 50);
    } catch (error) {
      console.error("Failed to create new project:", error);
      toast.error(t('conversationList.newProjectError'));
    }
  }, [
    editingItemId,
    getParentProjectId,
    addProject,
    selectItem,
    setWorkspaceMode,
    getProjectById,
    handleStartEditing,
    t,
  ]);

  const handleExportConversation = useCallback(
    async (id: string, format: "json" | "md", e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await exportConversation(id, format);
      } catch (error) {
        console.error("Failed to export conversation as ", format, ":", error);
      }
    },
    [exportConversation]
  );

  const handleExportProject = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await exportProject(id);
      } catch (error) {
        console.error("Failed to export project:", error);
      }
    },
    [exportProject]
  );

  const handleMoveConversation = useCallback(
    async (conversation: Conversation, e: React.MouseEvent) => {
      e.stopPropagation();
      const targetName = await prompt({
        title: t("conversationList.moveConversationPrompt", "Move to project"),
        description: t(
          "conversationList.moveConversationDescription",
          "Enter the exact name of the project to move this conversation to."
        ),
        inputPlaceholder: t(
          "conversationList.moveConversationPlaceholder",
          "Project name"
        ),
        confirmLabel: t("conversationList.move", "Move"),
        cancelLabel: t("conversationList.cancel", "Cancel"),
      });
      if (targetName === null) return;

      const trimmedTargetName = targetName.trim();
      if (!trimmedTargetName) {
        toast.error(t("conversationList.moveConversationEmpty", "Choose a project. Chats cannot live outside a project."));
        return;
      }

      const targetProject = projects.find(
        (project) =>
          project.name.toLowerCase() === trimmedTargetName.toLowerCase()
      );

      if (!targetProject) {
        toast.error(
          t("conversationList.moveConversationProjectNotFound", {
            projectName: trimmedTargetName,
            defaultValue: `Project "${trimmedTargetName}" was not found.`,
          })
        );
        return;
      }

      await updateConversation(conversation.id, {
        projectId: targetProject.id,
      });
      setExpandedProjects((prev) => new Set(prev).add(targetProject.id));
      toast.success(
        t("conversationList.moveConversationSuccess", {
          projectName: targetProject.name,
          defaultValue: `Moved to ${targetProject.name}.`,
        })
      );
    },
    [projects, t, updateConversation, prompt]
  );

  const handleCreateProjectPage = useCallback(
    async (project: Project, e: React.MouseEvent) => {
      e.stopPropagation();
      if (editingItemId) return;

      const title = await prompt({
        title: t("conversationList.newWikiPageTitle", "Wiki page title"),
        defaultValue: `${project.name} page`,
        inputPlaceholder: t("conversationList.newWikiPagePlaceholder", "Page title"),
        confirmLabel: t("conversationList.create", "Create"),
        cancelLabel: t("conversationList.cancel", "Cancel"),
      });
      const trimmedTitle = title?.trim();
      if (!trimmedTitle) return;

      try {
        const fsInstance = await ensureAppVfs();
        const connector = createCrea8VfsConnector({
          rootPath: project.path,
          fsInstance,
        });
        await connector.create({
          title: trimmedTitle,
          content: `# ${trimmedTitle}\n`,
          scope: "project",
          tags: [],
          projectId: project.id,
          path: joinPath(
            project.path,
            "Wiki",
            `${wikiPageSlug(trimmedTitle)}-${Date.now()}.md`,
          ),
        });
        selectItem(project.id, "project");
        setExpandedProjects((prev) => new Set(prev).add(project.id));
        toast.success(
          t("conversationList.newWikiPageSuccess", {
            defaultValue: `Created wiki page in {{projectName}}.`,
            projectName: project.name,
          })
        );
      } catch (error) {
        console.error("Failed to create wiki page:", error);
        toast.error(t("conversationList.newWikiPageError", "Failed to create wiki page."));
      }
    },
    [editingItemId, selectItem, prompt, t],
  );

  const handleCreateProjectFolder = useCallback(
    async (project: Project, e: React.MouseEvent) => {
      e.stopPropagation();
      if (editingItemId) return;

      const folderName = await prompt({
        title: t("conversationList.newFolderTitle", "Folder name"),
        defaultValue: t("conversationList.newFolderDefault", "New folder"),
        inputPlaceholder: t("conversationList.newFolderPlaceholder", "Folder name"),
        confirmLabel: t("conversationList.create", "Create"),
        cancelLabel: t("conversationList.cancel", "Cancel"),
      });
      const trimmedName = folderName?.trim();
      if (!trimmedName) return;

      try {
        const fsInstance = await ensureAppVfs();
        const targetPath = joinPath(project.path, trimmedName);
        await createDirectoryOp(targetPath, { fsInstance });
        selectItem(project.id, "project");
        setExpandedProjects((prev) => new Set(prev).add(project.id));
        toast.success(
          t("conversationList.newFolderSuccess", {
            defaultValue: `Created folder in {{projectName}}.`,
            projectName: project.name,
          })
        );
      } catch (error) {
        console.error("Failed to create project folder:", error);
        toast.error(t("conversationList.newFolderError", "Failed to create folder."));
      }
    },
    [editingItemId, selectItem, prompt, t],
  );

  const handleOpenProjectSection = useCallback(
    async (project: Project, section: ProjectSectionKind) => {
      await Promise.resolve(selectItem(project.id, "project"));
      setExpandedProjects((prev) => new Set(prev).add(project.id));

      if (section === "chats") {
        setWorkspaceMode("chat");
        return;
      }

      if (section === "wiki") {
        setWorkspaceMode("documents");
        return;
      }

      if (section === "git") {
        emitter.emit(uiEvent.openModalRequest, {
          modalId: "projectSettingsModal",
          targetId: project.id,
          initialTab: "sync",
        });
        return;
      }

      try {
        const vfsStore = useVfsStore.getState();
        if (vfsStore.vfsKey !== APP_VFS_KEY) {
          vfsStore.setVfsKey(APP_VFS_KEY);
        }
        await useVfsStore.getState().initializeVFS(APP_VFS_KEY);
        useVfsStore.getState().setCurrentPath(project.path);
        emitter.emit(vfsEvent.setVfsKeyRequest, { key: APP_VFS_KEY });
        emitter.emit(vfsEvent.setCurrentPathRequest, { path: project.path });
        emitter.emit(uiEvent.openModalRequest, {
          modalId: "core-vfs-modal-panel",
        });
      } catch (error) {
        console.error("Failed to open project files:", error);
        toast.error("Failed to open project files.");
      }
    },
    [selectItem, setWorkspaceMode],
  );

  const handleOpenWikiDocument = useCallback(
    async (project: Project, doc: DocumentNavDoc) => {
      await Promise.resolve(selectItem(project.id, "project"));
      setExpandedProjects((prev) => new Set(prev).add(project.id));
      setWorkspaceMode("documents");
      requestOpenDocument(project.id, doc.path);
    },
    [requestOpenDocument, selectItem, setWorkspaceMode],
  );

  const selectedProjectIdForRail = useMemo(() => {
    if (selectedItemType === "project") return selectedItemId;
    if (selectedItemType === "conversation" && selectedItemId) {
      return getConversationById(selectedItemId)?.projectId ?? null;
    }
    return null;
  }, [getConversationById, selectedItemId, selectedItemType]);

  useEffect(() => {
    if (expandedProjects.size === 0) return;
    let cancelled = false;

    void (async () => {
      const fsInstance = await ensureAppVfs();
      await Promise.all(
        projects
          .filter((project) => expandedProjects.has(project.id))
          .map(async (project) => {
            const rootPath = normalizePath(project.path);
            const current = useDocumentWorkspaceStore.getState().projects[project.id];
            if (current?.rootPath === rootPath) return;

            setProjectNavigation(project.id, {
              rootPath,
              rootLabel: project.name,
              docs: current?.docs ?? [],
              loading: true,
              activePath: current?.activePath ?? null,
              sync: current?.sync ?? null,
            });

            try {
              const docs = await listProjectWikiDocs(rootPath, fsInstance);
              if (cancelled) return;
              const latest = useDocumentWorkspaceStore.getState().projects[project.id];
              setProjectNavigation(project.id, {
                rootPath,
                rootLabel: project.name,
                docs,
                loading: false,
                activePath: latest?.activePath ?? null,
                sync: latest?.sync ?? null,
              });
            } catch (error) {
              console.warn("Failed to load project wiki tree:", error);
              if (cancelled) return;
              const latest = useDocumentWorkspaceStore.getState().projects[project.id];
              setProjectNavigation(project.id, {
                rootPath,
                rootLabel: project.name,
                docs: latest?.docs ?? [],
                loading: false,
                activePath: latest?.activePath ?? null,
                sync: latest?.sync ?? null,
              });
            }
          }),
      );
    })().catch((error) => {
      console.warn("Failed to prepare wiki tree navigation:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [expandedProjects, projects, setProjectNavigation]);

  const repoNameMap = useMemo(() => {
    return new Map((syncRepos || []).map((r) => [r.id, r.name]));
  }, [syncRepos]);

  const { projectsById, conversationsByProjectId, projectsByParentId } =
    useMemo(() => {
      const projById = new Map(projects.map((p) => [p.id, p]));
      const convosByProjId = new Map<string | null, Conversation[]>();
      conversations.forEach((c) => {
        const key = c.projectId ?? null;
        if (!convosByProjId.has(key)) convosByProjId.set(key, []);
        convosByProjId.get(key)!.push(c);
      });
      const projByParentId = new Map<string | null, Project[]>();
      projects.forEach((p) => {
        const key = p.parentId ?? null;
        if (!projByParentId.has(key)) projByParentId.set(key, []);
        projByParentId.get(key)!.push(p);
      });
      return {
        projectsById: projById,
        conversationsByProjectId: convosByProjId,
        projectsByParentId: projByParentId,
      };
    }, [projects, conversations]);

  const flattenedVisibleItems = useMemo((): VirtualListItem[] => {
    const flatList: VirtualListItem[] = [];
    const lowerCaseFilter = filterText.toLowerCase();
    const memoCache: Record<string, boolean> = {};

    const sortNewestFirst = <T extends { updatedAt: Date }>(items: T[]): T[] =>
      [...items].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    function addProjectSection(
      project: Project,
      section: ProjectSectionKind,
      level: number,
      count?: number,
    ) {
      flatList.push({
        id: `project-section-${project.id}-${section}`,
        originalId: project.id,
        type: "project-section",
        level,
        data: {
          itemType: "project-section",
          project,
          section,
          count,
        },
        updatedAt: project.updatedAt,
      });
    }

    function addWikiNode(project: Project, node: WikiTreeNode, level: number) {
      if (node.item) {
        flatList.push({
          id: `wiki-doc-${project.id}-${node.item.path}`,
          originalId: node.item.path,
          type: "wiki-doc",
          level,
          data: {
            itemType: "wiki-doc",
            project,
            doc: node.item,
          },
          updatedAt: node.item.updatedAt,
        });
        return;
      }

      if (node.path !== normalizePath(project.path)) {
        flatList.push({
          id: `wiki-folder-${project.id}-${node.path}`,
          originalId: node.path,
          type: "wiki-folder",
          level,
          data: {
            itemType: "wiki-folder",
            project,
            name: node.name,
            path: node.path,
          },
          updatedAt: project.updatedAt,
        });
      }

      node.children.forEach((child) => addWikiNode(project, child, level + 1));
    }

    function addProjectSync(project: Project, level: number) {
      const navigation = documentProjects[project.id];
      flatList.push({
        id: `wiki-sync-${project.id}`,
        originalId: project.id,
        type: "wiki-sync",
        level,
        data: {
          itemType: "wiki-sync",
          project,
          sync: navigation?.sync ?? null,
        },
        updatedAt: project.updatedAt,
      });
    }

    function addProject(project: Project, level: number) {
      flatList.push({
        id: `project-${project.id}`,
        originalId: project.id,
        type: "project",
        level,
        data: project,
        updatedAt: project.updatedAt,
      });

      if (!expandedProjects.has(project.id)) {
        return;
      }

      const projectConversations = sortNewestFirst(
        (conversationsByProjectId.get(project.id) || []).filter((c) =>
          c.title.toLowerCase().includes(lowerCaseFilter),
        ),
      );
      const childProjects = sortNewestFirst(
        (projectsByParentId.get(project.id) || []).filter(
          (p) =>
            itemMatchesFilterOrHasMatchingDescendant(
              p.id,
              "project",
              lowerCaseFilter,
              projects,
              conversations,
              projectsById,
              conversationsByProjectId,
              projectsByParentId,
              memoCache,
            ),
        ),
      );

      addProjectSection(project, "chats", level + 1, projectConversations.length);
      projectConversations.forEach((conversation) => {
        flatList.push({
          id: `conversation-${conversation.id}`,
          originalId: conversation.id,
          type: "conversation",
          level: level + 2,
          data: conversation,
          updatedAt: conversation.updatedAt,
        });
      });
      const navigation = documentProjects[project.id];
      const wikiDocs =
        navigation?.docs.filter((doc) => {
          if (!lowerCaseFilter) return true;
          return (
            doc.label.toLowerCase().includes(lowerCaseFilter) ||
            doc.relativePath.toLowerCase().includes(lowerCaseFilter)
          );
        }) ?? [];

      addProjectSection(project, "wiki", level + 1, navigation?.docs.length);
      if (navigation?.loading) {
        flatList.push({
          id: `wiki-folder-${project.id}-loading`,
          originalId: project.id,
          type: "wiki-folder",
          level: level + 2,
          data: {
            itemType: "wiki-folder",
            project,
            name: "Loading wiki...",
            path: `${project.path}/loading`,
          },
          updatedAt: project.updatedAt,
        });
      } else if (wikiDocs.length > 0) {
        const wikiTree = buildWikiTree(
          wikiDocs,
          navigation.rootPath,
          navigation.rootLabel,
        );
        wikiTree.children.forEach((child) =>
          addWikiNode(project, child, level + 2),
        );
      }
      addProjectSection(project, "files", level + 1);
      addProjectSection(project, "git", level + 1);
      if (selectedProjectIdForRail === project.id) {
        addProjectSync(project, level + 1);
      }

      childProjects.forEach((childProject) => addProject(childProject, level + 1));
    }

    function addRootChildren() {
      const childProjects = (projectsByParentId.get(null) || []).filter(
        (p) =>
          itemMatchesFilterOrHasMatchingDescendant(
            p.id,
            "project",
            lowerCaseFilter,
            projects,
            conversations,
            projectsById,
            conversationsByProjectId,
            projectsByParentId,
            memoCache
          )
      );

      childProjects.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      childProjects.forEach((project) => addProject(project, 0));
    }

    addRootChildren();
    return flatList;
  }, [
    projects,
    conversations,
    filterText,
    expandedProjects,
    projectsById,
    conversationsByProjectId,
    projectsByParentId,
    documentProjects,
    selectedProjectIdForRail,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: flattenedVisibleItems.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) =>
      flattenedVisibleItems[index]?.type === "wiki-sync" ? 112 : 32,
    overscan: 10,
  });

  return (
    <>
      <PromptDialog />
      <ConfirmDialog />
    <div className="p-2 border-r border-[--border] bg-card text-card-foreground h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 flex-shrink-0 px-1">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold tracking-[-0.02em]">{t('conversationList.title', 'LLMChef')}</h3>
          <Lnk
            href="https://github.com/wan0net/llmchef"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('conversationList.githubRepo')}
          >
            <Button size="sm" variant="ghost" className="h-4 w-4 p-0">
              <GithubIcon className="h-4 w-4" />
            </Button>
          </Lnk>
          <Lnk
            href="release/latest.zip"
            download="LLMChef.zip"
            aria-label={t('conversationList.downloadLLMChef')}
          >
            <Button size="sm" variant="ghost" className="h-4 w-4 p-0">
              <DownloadIcon className="h-4 w-4" />
            </Button>
          </Lnk>
        </div>
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNewChat}
                  disabled={!!editingItemId}
                  className="h-6 w-6 p-0"
                  aria-label={t('conversationList.newChat')}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('conversationList.newChatTooltip', 'New Chat')}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNewProject}
                  disabled={!!editingItemId}
                  className="h-6 w-6 p-0"
                  aria-label={t('conversationList.newProject')}
                >
                  <FolderPlusIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('conversationList.newProjectTooltip', 'New Project')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="relative mb-2 flex-shrink-0">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('conversationList.searchPlaceholder', 'Search...')}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="pl-8 h-8"
        />
      </div>

      <ScrollArea
        className="flex-grow -mx-2"
        ref={listRef}
        data-testid="conversation-list-scroll-area"
      >
        <div
          className="relative"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
          }}
        >
          {isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('conversationList.loading', 'Loading...')}
            </div>
          )}
          {!isLoading && flattenedVisibleItems.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {filterText ? (
                <p>{t('conversationList.noItemsMatchFilter', 'No items match your filter.')}</p>
              ) : (
                <>
                  <p>{t('conversationList.noItemsYet', 'No projects yet.')}</p>
                  <p className="text-xs mt-1">
                    {t('conversationList.getStarted', 'Create a project to get started.')}
                  </p>
                </>
              )}
            </div>
          )}
          {!isLoading &&
            rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = flattenedVisibleItems[virtualItem.index];
              if (!item) return null;

              if (item.type === "project-section") {
                const sectionItem = item.data as ProjectSectionItem;
                const isActive =
                  selectedItemId === sectionItem.project.id &&
                  selectedItemType === "project" &&
                  ((sectionItem.section === "chats" &&
                    workspaceMode === "chat") ||
                    (sectionItem.section === "wiki" &&
                      workspaceMode === "documents"));

                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="px-1"
                  >
                    <ProjectSectionRow
                      item={sectionItem}
                      level={item.level}
                      isActive={isActive}
                      onOpen={handleOpenProjectSection}
                    />
                  </div>
                );
              }

              if (item.type === "wiki-folder") {
                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="px-1"
                  >
                    <WikiFolderRow
                      item={item.data as WikiFolderItem}
                      level={item.level}
                    />
                  </div>
                );
              }

              if (item.type === "wiki-doc") {
                const wikiItem = item.data as WikiDocumentItem;
                const activePath =
                  documentProjects[wikiItem.project.id]?.activePath ?? null;
                const isActive =
                  selectedProjectIdForRail === wikiItem.project.id &&
                  workspaceMode === "documents" &&
                  activePath === wikiItem.doc.path;

                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="px-1"
                  >
                    <WikiDocumentRow
                      item={wikiItem}
                      level={item.level}
                      isActive={isActive}
                      onOpen={handleOpenWikiDocument}
                    />
                  </div>
                );
              }

              if (item.type === "wiki-sync") {
                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="px-1"
                  >
                    <WikiSyncRow
                      item={item.data as WikiSyncItem}
                      level={item.level}
                    />
                  </div>
                );
              }

              // Reconstruct the SidebarItem to include the itemType property, which the
              // VirtualListItem's `data` object lacks.
              const itemForRenderer: SidebarItem = {
                ...(item.data as any), // Use as any to bypass intermediate type checking
                itemType: item.type,
              };

              return (
                <div
                  key={item.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="px-1"
                >
                  <ConversationItemRenderer
                    item={itemForRenderer}
                    level={item.level}
                    selectedItemId={selectedItemId}
                    conversationSyncStatus={conversationSyncStatus}
                    repoNameMap={repoNameMap}
                    onSelectItem={handleSelectItem}
                    onDeleteItem={handleDeleteItem}
                    onMoveConversation={handleMoveConversation}
                    onExportConversation={handleExportConversation}
                    onExportProject={handleExportProject}
                    onCreateProjectPage={handleCreateProjectPage}
                    onCreateProjectFolder={handleCreateProjectFolder}
                    expandedProjects={expandedProjects}
                    toggleProjectExpansion={toggleProjectExpansion}
                    editingItemId={editingItemId}
                    editingItemType={editingItemType}
                    handleStartEditing={handleStartEditing}
                    handleSaveEdit={handleSaveEdit}
                    handleCancelEdit={handleCancelEdit}
                    isSavingEdit={isSavingEdit}
                    originalNameToCompare={originalNameToCompare}
                  />
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
    </>
  );
};
