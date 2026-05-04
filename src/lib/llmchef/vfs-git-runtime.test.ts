import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGitAuthRuntime,
  createGitSettingsSnapshot,
} from "./vfs-git-runtime";

describe("vfs git runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a git settings snapshot from store-like state", () => {
    expect(
      createGitSettingsSnapshot({
        corsProxyUrl: "https://cors.example.com",
        gitUserName: "Juni",
        gitUserEmail: "juni@example.com",
      }),
    ).toEqual({
      corsProxyUrl: "https://cors.example.com",
      gitUserName: "Juni",
      gitUserEmail: "juni@example.com",
    });
  });

  it("prefers stored credentials over prompting the user", async () => {
    const promptForCredentials = vi.fn();
    const runtime = createGitAuthRuntime({ promptForCredentials });

    const auth = await runtime.onAuth("https://github.com/demo/repo.git", {
      username: "stored-user",
      password: "stored-token",
    });

    expect(auth).toEqual({
      username: "stored-user",
      password: "stored-token",
      authScheme: "Basic",
    });
    expect(promptForCredentials).not.toHaveBeenCalled();
  });

  it("reuses prompted session credentials for the same origin and clears them on auth failure", async () => {
    const promptForCredentials = vi
      .fn()
      .mockResolvedValueOnce({ username: "prompt-user", password: "prompt-token" });
    const runtime = createGitAuthRuntime({ promptForCredentials });

    const firstAuth = await runtime.onAuth("https://github.com/demo/repo.git");
    const secondAuth = await runtime.onAuth("https://github.com/another/repo.git");

    expect(firstAuth).toEqual({
      username: "prompt-user",
      password: "prompt-token",
      authScheme: "Basic",
    });
    expect(secondAuth).toEqual(firstAuth);
    expect(promptForCredentials).toHaveBeenCalledTimes(1);

    runtime.onAuthFailure("https://github.com/demo/repo.git", firstAuth);

    await runtime.onAuth("https://github.com/third/repo.git");
    expect(promptForCredentials).toHaveBeenCalledTimes(2);
  });

  it("stores successful auth credentials for later requests on the same origin", async () => {
    const promptForCredentials = vi.fn().mockResolvedValue(null);
    const runtime = createGitAuthRuntime({ promptForCredentials });

    runtime.onAuthSuccess("https://github.com/demo/repo.git", {
      username: "cached-user",
      password: "cached-token",
    });

    const auth = await runtime.onAuth("https://github.com/demo/repo.git");

    expect(auth).toEqual({
      username: "cached-user",
      password: "cached-token",
      authScheme: "Basic",
    });
    expect(promptForCredentials).not.toHaveBeenCalled();
  });
});
