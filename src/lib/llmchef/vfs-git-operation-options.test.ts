import { describe, expect, it, vi } from "vitest";

import type { GitSettingsSnapshot, PromptedGitCredentials } from "./vfs-git-runtime";
import { createGitOperationOptionsBuilder } from "./vfs-git-operation-options";

describe("vfs git operation options", () => {
  const settings: GitSettingsSnapshot = {
    corsProxyUrl: "https://cors.example.com",
    gitUserName: "Juni",
    gitUserEmail: "juni@example.com",
  };

  it("builds common remote options that proxy auth through the runtime with stored credentials", async () => {
    const runtime = {
      onAuth: vi.fn().mockResolvedValue({
        username: "runtime-user",
        password: "runtime-token",
        authScheme: "Basic",
      }),
      onAuthFailure: vi.fn().mockReturnValue(null),
      onAuthSuccess: vi.fn(),
    };
    const storedCreds: PromptedGitCredentials = {
      username: "stored-user",
      password: "stored-token",
    };

    const builder = createGitOperationOptionsBuilder({ settings, authRuntime: runtime });
    const remoteOptions = builder.buildRemoteOptions(storedCreds);

    expect(remoteOptions.corsProxy).toBe("https://cors.example.com");
    expect(await remoteOptions.onAuth("https://github.com/demo/repo.git")).toEqual({
      username: "runtime-user",
      password: "runtime-token",
      authScheme: "Basic",
    });
    expect(runtime.onAuth).toHaveBeenCalledWith(
      "https://github.com/demo/repo.git",
      storedCreds,
    );

    remoteOptions.onAuthFailure("https://github.com/demo/repo.git", { reason: "nope" });
    expect(runtime.onAuthFailure).toHaveBeenCalledWith(
      "https://github.com/demo/repo.git",
      { reason: "nope" },
    );

    remoteOptions.onAuthSuccess("https://github.com/demo/repo.git", { username: "ok" });
    expect(runtime.onAuthSuccess).toHaveBeenCalledWith(
      "https://github.com/demo/repo.git",
      { username: "ok" },
    );
  });

  it("builds commit author info from git settings", () => {
    const builder = createGitOperationOptionsBuilder({
      settings,
      authRuntime: {
        onAuth: vi.fn(),
        onAuthFailure: vi.fn(),
        onAuthSuccess: vi.fn(),
      },
    });

    expect(builder.buildAuthor()).toEqual({
      name: "Juni",
      email: "juni@example.com",
    });
  });
});
