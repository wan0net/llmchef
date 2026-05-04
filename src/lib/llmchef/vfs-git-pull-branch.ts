export interface PullBranchGitOps {
  getCurrentBranch: () => Promise<string | null>;
  checkoutBranch: (branch: string) => Promise<void>;
  fetchBranchFromRemote: (branch: string) => Promise<unknown>;
  createAndCheckoutBranch: (branch: string) => Promise<void>;
}

export const ensureLocalPullBranch = async ({
  branch,
  gitOps,
  formatError,
}: {
  branch: string;
  gitOps: PullBranchGitOps;
  formatError: (error: unknown) => string;
}): Promise<void> => {
  const currentLocalBranch = await gitOps.getCurrentBranch();

  if (currentLocalBranch === branch) {
    return;
  }

  try {
    await gitOps.checkoutBranch(branch);
  } catch (checkoutError: any) {
    if (checkoutError?.code !== "NotFoundError") {
      throw new Error(
        `Failed to checkout branch "${branch}": ${formatError(checkoutError)}`,
      );
    }

    try {
      await gitOps.fetchBranchFromRemote(branch);
      await gitOps.createAndCheckoutBranch(branch);
    } catch (createBranchError) {
      throw new Error(
        `Failed to switch to or create local branch "${branch}": ${formatError(createBranchError)}`,
      );
    }
  }
};
