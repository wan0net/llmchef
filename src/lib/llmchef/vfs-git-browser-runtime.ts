import { toast } from "sonner";

import { useSettingsStore } from "@/store/settings.store";
import { GitCredentialDialogService } from "@/services/git-credential-dialog.service";

import {
  createGitAuthRuntime,
  createGitSettingsSnapshot,
  type GitSettingsSnapshot,
  type PromptedGitCredentials,
} from "./vfs-git-runtime";
import { createGitOperationOptionsBuilder } from "./vfs-git-operation-options";

export interface BrowserGitOperationRuntimeDependencies {
  getSettingsState: () => GitSettingsSnapshot;
  promptForCredentials?: (url: string) => Promise<{ username: string; password: string } | null>;
  notifyError: (message: string) => void;
}

export const createBrowserGitOperationRuntime = ({
  getSettingsState,
  promptForCredentials,
  notifyError,
}: BrowserGitOperationRuntimeDependencies) => {
  const gitAuthRuntime = createGitAuthRuntime({
    promptForCredentials: async (url) => {
      const credentials = promptForCredentials
        ? await promptForCredentials(url)
        : await GitCredentialDialogService.requestCredentials(url);

      if (!credentials) {
        notifyError("Authentication cancelled: Credentials not provided.");
        return null;
      }

      return credentials;
    },
  });

  const getSettings = () => createGitSettingsSnapshot(getSettingsState());

  return {
    getSettings,
    onAuth: (url: string, storedCreds?: PromptedGitCredentials) =>
      gitAuthRuntime.onAuth(url, storedCreds),
    onAuthFailure: (url: string, auth: unknown) =>
      gitAuthRuntime.onAuthFailure(url, auth),
    onAuthSuccess: (url: string, auth: PromptedGitCredentials) =>
      gitAuthRuntime.onAuthSuccess(url, auth),
    getOperationOptionsBuilder: () =>
      createGitOperationOptionsBuilder({
        settings: getSettings(),
        authRuntime: gitAuthRuntime,
      }),
  };
};

export const browserGitOperationRuntime = createBrowserGitOperationRuntime({
  getSettingsState: () => useSettingsStore.getState(),
  notifyError: (message) => toast.error(message),
});
