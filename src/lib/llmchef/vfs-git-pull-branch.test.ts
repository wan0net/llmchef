import { describe, expect, it, vi } from "vitest";

import { ensureLocalPullBranch } from "./vfs-git-pull-branch";

describe("vfs git pull branch helper", () => {
  it("does nothing when the requested branch is already checked out", async () => {
    const gitOps = {
      getCurrentBranch: vi.fn().mockResolvedValue("main"),
      checkoutBranch: vi.fn(),
      fetchBranchFromRemote: vi.fn(),
      createAndCheckoutBranch: vi.fn(),
    };

    await ensureLocalPullBranch({
      branch: "main",
      gitOps,
      formatError: (error) => String(error),
    });

    expect(gitOps.getCurrentBranch).toHaveBeenCalledTimes(1);
    expect(gitOps.checkoutBranch).not.toHaveBeenCalled();
    expect(gitOps.fetchBranchFromRemote).not.toHaveBeenCalled();
    expect(gitOps.createAndCheckoutBranch).not.toHaveBeenCalled();
  });

  it("fetches and creates the branch when checkout fails with NotFoundError", async () => {
    const checkoutError = Object.assign(new Error("missing local branch"), {
      code: "NotFoundError",
    });
    const gitOps = {
      getCurrentBranch: vi.fn().mockResolvedValue("develop"),
      checkoutBranch: vi.fn().mockRejectedValue(checkoutError),
      fetchBranchFromRemote: vi.fn().mockResolvedValue(undefined),
      createAndCheckoutBranch: vi.fn().mockResolvedValue(undefined),
    };

    await ensureLocalPullBranch({
      branch: "main",
      gitOps,
      formatError: (error) => String(error),
    });

    expect(gitOps.checkoutBranch).toHaveBeenCalledWith("main");
    expect(gitOps.fetchBranchFromRemote).toHaveBeenCalledWith("main");
    expect(gitOps.createAndCheckoutBranch).toHaveBeenCalledWith("main");
  });

  it("wraps checkout failures that are not missing-branch errors", async () => {
    const checkoutError = new Error("boom");
    const gitOps = {
      getCurrentBranch: vi.fn().mockResolvedValue("develop"),
      checkoutBranch: vi.fn().mockRejectedValue(checkoutError),
      fetchBranchFromRemote: vi.fn(),
      createAndCheckoutBranch: vi.fn(),
    };

    await expect(
      ensureLocalPullBranch({
        branch: "main",
        gitOps,
        formatError: () => "formatted checkout boom",
      }),
    ).rejects.toThrow('Failed to checkout branch "main": formatted checkout boom');

    expect(gitOps.fetchBranchFromRemote).not.toHaveBeenCalled();
    expect(gitOps.createAndCheckoutBranch).not.toHaveBeenCalled();
  });

  it("wraps remote branch creation failures after fetch", async () => {
    const checkoutError = Object.assign(new Error("missing local branch"), {
      code: "NotFoundError",
    });
    const createError = new Error("remote missing too");
    const gitOps = {
      getCurrentBranch: vi.fn().mockResolvedValue("develop"),
      checkoutBranch: vi.fn().mockRejectedValue(checkoutError),
      fetchBranchFromRemote: vi.fn().mockResolvedValue(undefined),
      createAndCheckoutBranch: vi.fn().mockRejectedValue(createError),
    };

    await expect(
      ensureLocalPullBranch({
        branch: "main",
        gitOps,
        formatError: () => "formatted create boom",
      }),
    ).rejects.toThrow(
      'Failed to switch to or create local branch "main": formatted create boom',
    );
  });
});
