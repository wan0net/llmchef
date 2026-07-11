import { describe, expect, it, vi } from "vitest";

import { createBrowserGitOperationRuntime } from "./vfs-git-browser-runtime";

describe("vfs git browser runtime", () => {
  it("builds git settings and remote options from injected browser/store dependencies", async () => {
    const runtime = createBrowserGitOperationRuntime({
      getSettingsState: () => ({
        corsProxyUrl: "https://cors.example.com",
        gitUserName: "Juni",
        gitUserEmail: "juni@example.com",
      }),
      promptForCredentials: vi.fn(),
      notifyError: vi.fn(),
    });

    expect(runtime.getSettings()).toEqual({
      corsProxyUrl: "https://cors.example.com",
      gitUserName: "Juni",
      gitUserEmail: "juni@example.com",
    });

    const auth = await runtime.getOperationOptionsBuilder()
      .buildRemoteOptions({ username: "stored-user", password: "stored-token" })
      .onAuth("https://github.com/demo/repo.git");

    expect(auth).toEqual({
      username: "stored-user",
      password: "stored-token",
      authScheme: "Basic",
    });
  });

  it("notifies and aborts when the credential prompt does not provide credentials", async () => {
    const promptForCredentials = vi.fn().mockResolvedValueOnce(null);
    const notifyError = vi.fn();

    const runtime = createBrowserGitOperationRuntime({
      getSettingsState: () => ({
        corsProxyUrl: "",
        gitUserName: null,
        gitUserEmail: null,
      }),
      promptForCredentials,
      notifyError,
    });

    const auth = await runtime.onAuth("https://github.com/demo/repo.git");

    expect(auth).toBeNull();
    expect(promptForCredentials).toHaveBeenCalledWith(
      "https://github.com/demo/repo.git",
    );
    expect(notifyError).toHaveBeenCalledWith(
      "Authentication cancelled: Credentials not provided.",
    );
  });
});
