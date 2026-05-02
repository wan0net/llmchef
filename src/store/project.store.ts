// src/store/project.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project } from "@/types/llmchef/project";
import { PersistenceService } from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { normalizePath } from "@/lib/llmchef/file-manager-utils";
import { APP_VFS_KEY } from "@/lib/llmchef/constants";
import * as VfsOps from "@/lib/llmchef/vfs-operations";
import { useSettingsStore } from "./settings.store";
import { useProviderStore } from "./provider.store";
import { emitter } from "@/lib/llmchef/event-emitter";
import {
  projectEvent,
  ProjectEventPayloads,
} from "@/types/llmchef/events/project.events";
import type {
  RegisteredActionHandler,
  ActionHandler,
} from "@/types/llmchef/control";
import { conversationEvent } from "@/types/llmchef/events/conversation.events";
import { useVfsStore } from "./vfs.store";

const getProjectFolderName = (name: string, id: string) =>
  `${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project"}-${id.substring(0, 4)}`;

const ensureProjectFolder = async (path: string) => {
  const fsInstance = await useVfsStore
    .getState()
    .initializeVFS(APP_VFS_KEY, { force: true });
  await VfsOps.createDirectoryOp(path, { fsInstance });
};

const renameProjectFolder = async (oldPath: string, newPath: string) => {
  const fsInstance = await useVfsStore
    .getState()
    .initializeVFS(APP_VFS_KEY, { force: true });
  const parentPath = normalizePath(newPath.split("/").slice(0, -1).join("/") || "/");
  await VfsOps.createDirectoryOp(parentPath, { fsInstance });
  try {
    await fsInstance.promises.stat(oldPath);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await VfsOps.createDirectoryOp(newPath, { fsInstance });
      return;
    }
    throw err;
  }
  try {
    await fsInstance.promises.stat(newPath);
    throw new Error(`Project folder already exists at ${newPath}.`);
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
  }
  await VfsOps.renameOp(oldPath, newPath, { fsInstance });
};

const deleteProjectFolder = async (path: string) => {
  const fsInstance = await useVfsStore
    .getState()
    .initializeVFS(APP_VFS_KEY, { force: true });
  await VfsOps.rmdirRecursive(path, { fsInstance });
};

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectActions {
  loadProjects: () => Promise<void>;
  addProject: (
    projectData: Partial<Omit<Project, "id" | "createdAt" | "path">> & {
      name: string;
      parentId?: string | null;
    }
  ) => Promise<string>;
  updateProject: (
    id: string,
    updates: Partial<Omit<Project, "id" | "createdAt" | "path">>
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectById: (id: string | null) => Project | undefined;
  getTopLevelProjectId: (id: string | null) => string | null;
  getEffectiveProjectSettings: (projectId: string | null) => {
    systemPrompt: string | null;
    modelId: string | null;
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
    topK: number | null;
    presencePenalty: number | null;
    frequencyPenalty: number | null;
    defaultTagIds: string[] | null;
    defaultRuleIds: string[] | null;
  };
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

export const useProjectStore = create(
  immer<ProjectState & ProjectActions>((set, get) => ({
    projects: [],
    isLoading: false,
    error: null,

    loadProjects: async () => {
      set({ isLoading: true, error: null });
      try {
        const dbProjects = await PersistenceService.loadProjects();
        await Promise.all(
          dbProjects.map((project) => ensureProjectFolder(project.path))
        );
        set({ projects: dbProjects, isLoading: false });
        emitter.emit(projectEvent.loaded, { projects: dbProjects });
      } catch (e) {
        console.error("ProjectStore: Error loading projects", e);
        set({ error: "Failed to load projects", isLoading: false });
        emitter.emit(projectEvent.loadingStateChanged, {
          isLoading: false,
          error: "Failed to load projects",
        });
      }
    },

    addProject: async (projectData) => {
      const newId = nanoid();
      const now = new Date();
      const parentPath = projectData.parentId
        ? get().getProjectById(projectData.parentId)?.path ?? "/"
        : "/";
      const newPath = normalizePath(
        `${parentPath}/${getProjectFolderName(projectData.name, newId)}`
      );

      const newProject: Project = {
        id: newId,
        path: newPath,
        createdAt: now,
        updatedAt: now,
        name: projectData.name,
        parentId: projectData.parentId ?? null,
        systemPrompt: projectData.systemPrompt ?? null,
        modelId: projectData.modelId ?? null,
        temperature: projectData.temperature ?? null,
        maxTokens: projectData.maxTokens ?? null,
        topP: projectData.topP ?? null,
        topK: projectData.topK ?? null,
        presencePenalty: projectData.presencePenalty ?? null,
        frequencyPenalty: projectData.frequencyPenalty ?? null,
        defaultTagIds: projectData.defaultTagIds ?? null,
        defaultRuleIds: projectData.defaultRuleIds ?? null,
        metadata: projectData.metadata ?? {},
      };

      try {
        await ensureProjectFolder(newProject.path);
        await PersistenceService.saveProject(newProject);
        set((state) => {
          state.projects.unshift(newProject);
          state.projects.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          );
        });
        emitter.emit(projectEvent.added, { project: newProject });
        return newId;
      } catch (e) {
        console.error("ProjectStore: Error adding project", e);
        set({ error: "Failed to save new project" });
        throw e;
      }
    },

    updateProject: async (id, updates) => {
      const originalProject = get().getProjectById(id);
      if (!originalProject) {
        console.warn(`ProjectStore: Project ${id} not found for update.`);
        return;
      }
      if (updates.parentId === id) {
        throw new Error("A project cannot be moved inside itself.");
      }
      const descendantIds = new Set<string>();
      const collectDescendants = (projectId: string) => {
        get()
          .projects.filter((p) => p.parentId === projectId)
          .forEach((child) => {
            descendantIds.add(child.id);
            collectDescendants(child.id);
          });
      };
      collectDescendants(id);
      if (updates.parentId && descendantIds.has(updates.parentId)) {
        throw new Error("A project cannot be moved inside one of its subprojects.");
      }
      if (updates.parentId && !get().getProjectById(updates.parentId)) {
        throw new Error("Cannot move project into a missing parent project.");
      }

      const updatedProjectData: Project = {
        ...originalProject,
        ...updates,
        updatedAt: new Date(),
      };

      if (
        (updates.name && updates.name !== originalProject.name) ||
        (updates.parentId !== undefined && updates.parentId !== originalProject.parentId)
      ) {
        const parentPath = updatedProjectData.parentId
          ? get().getProjectById(updatedProjectData.parentId)?.path ?? "/"
          : "/";
        updatedProjectData.path = normalizePath(
          `${parentPath}/${getProjectFolderName(updatedProjectData.name, id)}`
        );
      }

      let folderMoved = false;
      try {
        const projectsToSave = [updatedProjectData];
        if (updatedProjectData.path !== originalProject.path) {
          await renameProjectFolder(originalProject.path, updatedProjectData.path);
          folderMoved = true;
          const oldPrefix = `${originalProject.path}/`;
          const childProjects = get().projects.filter((p) =>
            p.path.startsWith(oldPrefix)
          );
          for (const child of childProjects) {
            projectsToSave.push({
              ...child,
              path: normalizePath(
                `${updatedProjectData.path}/${child.path.slice(oldPrefix.length)}`
              ),
              updatedAt: new Date(),
            });
          }
        }

        await Promise.all(
          projectsToSave.map((project) => PersistenceService.saveProject(project))
        );
        set((state) => {
          for (const project of projectsToSave) {
            const index = state.projects.findIndex((p) => p.id === project.id);
            if (index !== -1) {
              state.projects[index] = project;
            }
          }
          if (projectsToSave.length > 0) {
            state.projects.sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
            );
          }
        });
        emitter.emit(projectEvent.updated, {
          projectId: id,
          updates: updatedProjectData,
        });
      } catch (e) {
        console.error("ProjectStore: Error updating project", e);
        if (folderMoved) {
          try {
            await renameProjectFolder(updatedProjectData.path, originalProject.path);
          } catch (rollbackError) {
            console.error(
              "ProjectStore: Failed to roll back project folder rename",
              rollbackError
            );
          }
        }
        set({ error: "Failed to save project update" });
        throw e;
      }
    },

    deleteProject: async (id) => {
      const projectToDelete = get().projects.find((p) => p.id === id);
      if (!projectToDelete) return;

      const projectsToDeleteIds = new Set<string>();
      const findDescendants = (currentId: string) => {
        projectsToDeleteIds.add(currentId);
        get()
          .projects.filter((p) => p.parentId === currentId)
          .forEach((child) => findDescendants(child.id));
      };
      findDescendants(id);

      try {
        await deleteProjectFolder(projectToDelete.path);
        await PersistenceService.deleteProject(id); // This handles recursive DB deletion
        set((state) => ({
          projects: state.projects.filter(
            (p) => !projectsToDeleteIds.has(p.id)
          ),
        }));
        // Emit an event to notify ConversationStore to unlink conversations
        // This is a temporary solution. Ideally, ConversationStore would listen to project.deleted.
        emitter.emit(conversationEvent.loadConversationsRequest, undefined);
        emitter.emit(projectEvent.deleted, { projectId: id });
        toast.success(
          `Project "${projectToDelete.name}" and its contents deleted.`
        );
      } catch (e) {
        console.error("ProjectStore: Error deleting project", e);
        set({ error: "Failed to delete project" });
        throw e;
      }
    },

    getProjectById: (id) => {
      if (!id) return undefined;
      return get().projects.find((p) => p.id === id);
    },

    getTopLevelProjectId: (id) => {
      if (!id) return null;
      let current = get().getProjectById(id);
      if (!current) return null;
      while (current.parentId) {
        const parent = get().getProjectById(current.parentId);
        if (!parent) break;
        current = parent;
      }
      return current.id;
    },

    getEffectiveProjectSettings: (projectId) => {
      const globalSettings = useSettingsStore.getState();
      const globalModelId = useProviderStore.getState().selectedModelId;

      const defaults = {
        systemPrompt: globalSettings.globalSystemPrompt,
        modelId: globalModelId,
        temperature: globalSettings.temperature,
        maxTokens: globalSettings.maxTokens,
        topP: globalSettings.topP,
        topK: globalSettings.topK,
        presencePenalty: globalSettings.presencePenalty,
        frequencyPenalty: globalSettings.frequencyPenalty,
        defaultTagIds: null,
        defaultRuleIds: null,
      };

      if (!projectId) {
        return defaults;
      }

      const project = get().getProjectById(projectId);
      if (!project) {
        return defaults;
      }

      const parentSettings = project.parentId
        ? get().getEffectiveProjectSettings(project.parentId)
        : defaults;

      return {
        systemPrompt:
          project.systemPrompt !== null && project.systemPrompt !== undefined
            ? project.systemPrompt
            : parentSettings.systemPrompt,
        modelId:
          project.modelId !== null && project.modelId !== undefined
            ? project.modelId
            : parentSettings.modelId,
        temperature:
          project.temperature !== null && project.temperature !== undefined
            ? project.temperature
            : parentSettings.temperature,
        maxTokens:
          project.maxTokens !== null && project.maxTokens !== undefined
            ? project.maxTokens
            : parentSettings.maxTokens,
        topP:
          project.topP !== null && project.topP !== undefined
            ? project.topP
            : parentSettings.topP,
        topK:
          project.topK !== null && project.topK !== undefined
            ? project.topK
            : parentSettings.topK,
        presencePenalty:
          project.presencePenalty !== null &&
          project.presencePenalty !== undefined
            ? project.presencePenalty
            : parentSettings.presencePenalty,
        frequencyPenalty:
          project.frequencyPenalty !== null &&
          project.frequencyPenalty !== undefined
            ? project.frequencyPenalty
            : parentSettings.frequencyPenalty,
        defaultTagIds:
          project.defaultTagIds !== null && project.defaultTagIds !== undefined
            ? project.defaultTagIds
            : parentSettings.defaultTagIds,
        defaultRuleIds:
          project.defaultRuleIds !== null &&
          project.defaultRuleIds !== undefined
            ? project.defaultRuleIds
            : parentSettings.defaultRuleIds,
      };
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "projectStore";
      const actions = get();
      const wrapPromiseString =
        <P>(fn: (payload: P) => Promise<string>): ActionHandler<P> =>
        async (payload: P) => {
          await fn(payload);
        };

      return [
        {
          eventName: projectEvent.loadProjectsRequest,
          handler: actions.loadProjects,
          storeId,
        },
        {
          eventName: projectEvent.addProjectRequest,
          handler: wrapPromiseString(actions.addProject),
          storeId,
        },
        {
          eventName: projectEvent.updateProjectRequest,
          handler: (
            p: ProjectEventPayloads[typeof projectEvent.updateProjectRequest]
          ) => actions.updateProject(p.id, p.updates),
          storeId,
        },
        {
          eventName: projectEvent.deleteProjectRequest,
          handler: (
            p: ProjectEventPayloads[typeof projectEvent.deleteProjectRequest]
          ) => actions.deleteProject(p.id),
          storeId,
        },
      ];
    },
  }))
);
