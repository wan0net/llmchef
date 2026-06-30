import { create } from "zustand";

export type DocumentNavDoc = {
  kind: "crea8" | "file";
  name: string;
  path: string;
  type: string;
  updatedAt: Date;
  snippet: string;
  label: string;
  relativePath: string;
  previewKind: string;
  isWiki: boolean;
};

export type DocumentSyncState = {
  localFolderName: string | null;
  localFolderStatus: string | null;
  syncingLocalFolder: boolean;
  localSyncSupported: boolean;
  connectLocalFolder?: () => void;
  syncLocalFolderNow?: () => void;
};

type OpenDocumentRequest = {
  id: number;
  projectId: string;
  path: string;
};

type ProjectDocumentNavigation = {
  projectId: string;
  rootPath: string;
  rootLabel: string;
  docs: DocumentNavDoc[];
  loading: boolean;
  activePath: string | null;
  sync: DocumentSyncState | null;
};

type DocumentWorkspaceState = {
  projects: Record<string, ProjectDocumentNavigation>;
  openRequest: OpenDocumentRequest | null;
  setProjectNavigation: (
    projectId: string,
    navigation: Omit<ProjectDocumentNavigation, "projectId">,
  ) => void;
  setProjectActivePath: (projectId: string, activePath: string | null) => void;
  setProjectSyncState: (
    projectId: string,
    sync: DocumentSyncState | null,
  ) => void;
  setProjectLoading: (projectId: string, loading: boolean) => void;
  clearProjectNavigation: (projectId: string) => void;
  requestOpenDocument: (projectId: string, path: string) => void;
};

export const useDocumentWorkspaceStore = create<DocumentWorkspaceState>(
  (set) => ({
    projects: {},
    openRequest: null,
    setProjectNavigation: (projectId, navigation) =>
      set((state) => ({
        projects: {
          ...state.projects,
          [projectId]: {
            projectId,
            ...navigation,
            sync: navigation.sync ?? state.projects[projectId]?.sync ?? null,
          },
        },
      })),
    setProjectActivePath: (projectId, activePath) =>
      set((state) => {
        const current = state.projects[projectId];
        if (!current) return state;
        return {
          projects: {
            ...state.projects,
            [projectId]: { ...current, activePath },
          },
        };
      }),
    setProjectSyncState: (projectId, sync) =>
      set((state) => {
        const current = state.projects[projectId] ?? {
          projectId,
          rootPath: "/",
          rootLabel: "Project",
          docs: [],
          loading: false,
          activePath: null,
          sync: null,
        };
        return {
          projects: {
            ...state.projects,
            [projectId]: { ...current, sync },
          },
        };
      }),
    setProjectLoading: (projectId, loading) =>
      set((state) => {
        const current = state.projects[projectId];
        if (!current) return state;
        return {
          projects: {
            ...state.projects,
            [projectId]: { ...current, loading },
          },
        };
      }),
    clearProjectNavigation: (projectId) =>
      set((state) => {
        const projects = { ...state.projects };
        delete projects[projectId];
        return { projects };
      }),
    requestOpenDocument: (projectId, path) =>
      set((state) => ({
        openRequest: {
          id: (state.openRequest?.id ?? 0) + 1,
          projectId,
          path,
        },
      })),
  }),
);
