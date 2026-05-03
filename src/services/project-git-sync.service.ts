import type { fs as FsType } from "@zenfs/core";
import * as VfsOps from "@/lib/llmchef/vfs-operations";
import { normalizePath } from "@/lib/llmchef/file-manager-utils";
import type { Project } from "@/types/llmchef/project";
import type { SyncRepo } from "@/types/llmchef/sync";

export interface ProjectGitSyncResult {
  branch: string;
  initialized: boolean;
  pushed: boolean;
}

export class ProjectGitSyncService {
  static async pushProjectToRepo(input: {
    project: Project;
    repo: SyncRepo;
    fsInstance: typeof FsType;
  }): Promise<ProjectGitSyncResult> {
    const { project, repo, fsInstance } = input;
    const projectPath = normalizePath(project.path);
    const branch = repo.branch || "main";
    const credentials = { username: repo.username, password: repo.password };
    const initialized = !(await VfsOps.isGitRepoOp(projectPath, { fsInstance }));

    if (initialized) {
      await VfsOps.gitInitOp(projectPath, { fsInstance });
    } else {
      await VfsOps.gitEnsureBranchOp(projectPath, branch, { fsInstance });
      await VfsOps.gitEnsureRemoteOp(projectPath, repo.remoteUrl, "origin", {
        fsInstance,
      });
      await VfsOps.gitPullOp(projectPath, branch, credentials, { fsInstance });
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
      pushed: true,
    };
  }
}
