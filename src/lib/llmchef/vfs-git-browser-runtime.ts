import { toast } from "sonner";

import { useSettingsStore } from "@/store/settings.store";

import {
  createGitAuthRuntime,
  createGitSettingsSnapshot,
  type GitSettingsSnapshot,
  type PromptedGitCredentials,
} from "./vfs-git-runtime";
import { createGitOperationOptionsBuilder } from "./vfs-git-operation-options";

export interface BrowserGitOperationRuntimeDependencies {
  getSettingsState: () => GitSettingsSnapshot;
  prompt: (message: string) => string | null;
  notifyError: (message: string) => void;
}

export const createBrowserGitOperationRuntime = ({
  getSettingsState,
  prompt,
  notifyError,
}: BrowserGitOperationRuntimeDependencies) => {
  const gitAuthRuntime = createGitAuthRuntime({
    promptForCredentials: async (url) => {
      const username = prompt(`Enter username for ${url}`);
      if (!username) {
        notifyError("Authentication cancelled: Username not provided.");
        return null;
      }

      const password = prompt(`Enter password or token for ${username}@${url}`);
      if (!password) {
        notifyError("Authentication cancelled: Password/token not provided.");
        return null;
      }

      return { username, password };
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
  prompt: (message) => window.prompt(message),
  notifyError: (message) => toast.error(message),
});
