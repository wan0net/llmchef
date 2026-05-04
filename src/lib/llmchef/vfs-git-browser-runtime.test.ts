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
      prompt: vi.fn(),
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

  it("notifies and aborts when the browser prompt does not provide a username", async () => {
    const prompt = vi.fn().mockReturnValueOnce(null);
    const notifyError = vi.fn();

    const runtime = createBrowserGitOperationRuntime({
      getSettingsState: () => ({
        corsProxyUrl: "",
        gitUserName: null,
        gitUserEmail: null,
      }),
      prompt,
      notifyError,
    });

    const auth = await runtime.onAuth("https://github.com/demo/repo.git");

    expect(auth).toBeNull();
    expect(prompt).toHaveBeenCalledWith(
      "Enter username for https://github.com/demo/repo.git",
    );
    expect(notifyError).toHaveBeenCalledWith(
      "Authentication cancelled: Username not provided.",
    );
  });

  it("notifies and aborts when the browser prompt does not provide a password", async () => {
    const prompt = vi
      .fn()
      .mockReturnValueOnce("demo-user")
      .mockReturnValueOnce("");
    const notifyError = vi.fn();

    const runtime = createBrowserGitOperationRuntime({
      getSettingsState: () => ({
        corsProxyUrl: "",
        gitUserName: null,
        gitUserEmail: null,
      }),
      prompt,
      notifyError,
    });

    const auth = await runtime.onAuth("https://github.com/demo/repo.git");

    expect(auth).toBeNull();
    expect(prompt).toHaveBeenNthCalledWith(
      2,
      "Enter password or token for demo-user@https://github.com/demo/repo.git",
    );
    expect(notifyError).toHaveBeenCalledWith(
      "Authentication cancelled: Password/token not provided.",
    );
  });
});
