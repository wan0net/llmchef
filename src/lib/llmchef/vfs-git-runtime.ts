export interface GitSettingsSnapshot {
  corsProxyUrl: string;
  gitUserName: string | null | undefined;
  gitUserEmail: string | null | undefined;
}

export interface PromptedGitCredentials {
  username?: string | null;
  password?: string | null;
}

export interface GitAuthResult {
  username: string;
  password: string;
  authScheme: "Basic";
}

export interface GitAuthRuntimeOptions {
  promptForCredentials: (url: string) => Promise<PromptedGitCredentials | null>;
}

export const createGitSettingsSnapshot = (
  state: GitSettingsSnapshot,
): GitSettingsSnapshot => ({
  corsProxyUrl: state.corsProxyUrl,
  gitUserName: state.gitUserName,
  gitUserEmail: state.gitUserEmail,
});

export const createGitAuthRuntime = ({
  promptForCredentials,
}: GitAuthRuntimeOptions) => {
  const sessionCredentials = new Map<string, { username: string; password: string }>();

  const toAuthResult = (
    creds?: PromptedGitCredentials | null,
  ): GitAuthResult | null => {
    if (!creds?.username || !creds?.password) {
      return null;
    }

    return {
      username: creds.username,
      password: creds.password,
      authScheme: "Basic",
    };
  };

  return {
    async onAuth(
      url: string,
      storedCreds?: PromptedGitCredentials,
    ): Promise<GitAuthResult | null> {
      const directAuth = toAuthResult(storedCreds);
      if (directAuth) {
        return directAuth;
      }

      const urlOrigin = new URL(url).origin;
      const sessionAuth = toAuthResult(sessionCredentials.get(urlOrigin));
      if (sessionAuth) {
        return sessionAuth;
      }

      const prompted = await promptForCredentials(url);
      const promptedAuth = toAuthResult(prompted);
      if (!promptedAuth) {
        return null;
      }

      sessionCredentials.set(urlOrigin, {
        username: promptedAuth.username,
        password: promptedAuth.password,
      });

      return promptedAuth;
    },

    onAuthFailure(url: string, _auth: unknown): null {
      sessionCredentials.delete(new URL(url).origin);
      return null;
    },

    onAuthSuccess(url: string, auth: PromptedGitCredentials): void {
      const successfulAuth = toAuthResult(auth);
      if (!successfulAuth) {
        return;
      }

      const urlOrigin = new URL(url).origin;
      if (!sessionCredentials.has(urlOrigin)) {
        sessionCredentials.set(urlOrigin, {
          username: successfulAuth.username,
          password: successfulAuth.password,
        });
      }
    },
  };
};
