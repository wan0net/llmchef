import type {
  GitAuthResult,
  GitSettingsSnapshot,
  PromptedGitCredentials,
} from "./vfs-git-runtime";

export interface GitAuthRuntimeLike {
  onAuth: (
    url: string,
    storedCreds?: PromptedGitCredentials,
  ) => Promise<GitAuthResult | null>;
  onAuthFailure: (url: string, auth: unknown) => unknown;
  onAuthSuccess: (url: string, auth: PromptedGitCredentials) => void;
}

export interface GitAuthor {
  name: string;
  email: string;
}

export const createGitOperationOptionsBuilder = ({
  settings,
  authRuntime,
}: {
  settings: GitSettingsSnapshot;
  authRuntime: GitAuthRuntimeLike;
}) => ({
  buildRemoteOptions(storedCreds?: PromptedGitCredentials) {
    return {
      corsProxy: settings.corsProxyUrl,
      onAuth: (url: string) => authRuntime.onAuth(url, storedCreds),
      onAuthFailure: (url: string, auth: unknown) =>
        authRuntime.onAuthFailure(url, auth),
      onAuthSuccess: (url: string, auth: PromptedGitCredentials) =>
        authRuntime.onAuthSuccess(url, auth),
    };
  },

  buildAuthor(): GitAuthor {
    return {
      name: settings.gitUserName ?? "",
      email: settings.gitUserEmail ?? "",
    };
  },
});
