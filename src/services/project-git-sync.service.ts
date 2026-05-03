import type { fs as FsType } from "@zenfs/core";
import * as VfsOps from "@/lib/llmchef/vfs-operations";
import { normalizePath } from "@/lib/llmchef/file-manager-utils";
import type { Project } from "@/types/llmchef/project";
import type { SyncRepo } from "@/types/llmchef/sync";

export interface ProjectGitSyncResult {
  branch: string;
  initialized: boolean;
  pulled: boolean;
  pushed: boolean;
}

const credentialsForRepo = (repo: SyncRepo) => ({
  username: repo.username,
  password: repo.password,
});

const isProjectFolderEmptyForClone = async (
  projectPath: string,
  fsInstance: typeof FsType,
): Promise<boolean> => {
  const entries = await VfsOps.listFilesOp(projectPath, { fsInstance });
  return entries.length === 0;
};

export class ProjectGitSyncService {
  static async pushProjectToRepo(input: {
    project: Project;
    repo: SyncRepo;
    fsInstance: typeof FsType;
  }): Promise<ProjectGitSyncResult> {
    const { project, repo, fsInstance } = input;
    const projectPath = normalizePath(project.path);
    const branch = repo.branch || "main";
    const credentials = credentialsForRepo(repo);
    const initialized = !(await VfsOps.isGitRepoOp(projectPath, { fsInstance }));
    let pulled = false;

    if (initialized) {
      await VfsOps.gitInitOp(projectPath, { fsInstance });
    } else {
      await VfsOps.gitEnsureBranchOp(projectPath, branch, { fsInstance });
      await VfsOps.gitEnsureRemoteOp(projectPath, repo.remoteUrl, "origin", {
        fsInstance,
      });
      await VfsOps.gitPullOp(projectPath, branch, credentials, { fsInstance });
      pulled = true;
    }

    await VfsOps.gitEnsureBranchOp(projectPath, branch, { fsInstance });
    await VfsOps.gitEnsureRemoteOp(projectPath, repo.remoteUrl, "origin", {
      fsInstance,
    });
    await VfsOps.gitCommitOp(
      projectPath,
      `Sync project workspace: ${project.name}`,
      { fsInstance },
    );
    await VfsOps.gitPushOp(projectPath, branch, credentials, { fsInstance });

    return {
      branch,
      initialized,
      pulled,
      pushed: true,
    };
  }

  static async pullProjectFromRepo(input: {
    project: Project;
    repo: SyncRepo;
    fsInstance: typeof FsType;
  }): Promise<ProjectGitSyncResult> {
    const { project, repo, fsInstance } = input;
    const projectPath = normalizePath(project.path);
    const branch = repo.branch || "main";
    const credentials = credentialsForRepo(repo);
    const initialized = !(await VfsOps.isGitRepoOp(projectPath, { fsInstance }));

    if (initialized) {
      if (!(await isProjectFolderEmptyForClone(projectPath, fsInstance))) {
        throw new Error(
          "Project folder has local files but is not a Git repository. Push it first, or pull into an empty project.",
        );
      }
      await VfsOps.gitCloneOp(projectPath, repo.remoteUrl, branch, credentials, {
        fsInstance,
      });
    } else {
      await VfsOps.gitEnsureBranchOp(projectPath, branch, { fsInstance });
      await VfsOps.gitEnsureRemoteOp(projectPath, repo.remoteUrl, "origin", {
        fsInstance,
      });
      await VfsOps.gitPullOp(projectPath, branch, credentials, { fsInstance });
    }

    return {
      branch,
      initialized,
      pulled: true,
      pushed: false,
    };
  }
}
