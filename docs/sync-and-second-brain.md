# LLMChef Sync and Second Brain Direction

LLMChef is local-first: the browser VFS is the working source of truth, and the user chooses if and where data syncs. Sync targets are explicit capabilities, not hidden background egress.

## Second Brain Shape

The whole LLMChef workspace should behave like one second brain, with each project as a high-level folder inside it. Projects remain independently useful, but the master workspace can search, browse, lint, and sync across all projects.

Recommended layout:

```text
/
  _home.md
  Projects/
    <project>/
      _home.md
      raw/
      crea8/
        Second Brain/
          _index.md
          overview.md
          Findings/
          Decisions/
          Concepts/
          Entities/
          Sources/
          Lessons/
          Questions/
          Contradictions/
      output/
      recipes/
  Areas/
  Resources/
  Archives/
```

Project folders should be pleasant for humans first: `_home.md`, `overview.md`, readable names, browseable trees, previews, and explicit source links. The AI should use the same files as its durable context, not a parallel hidden index.

## Sync Targets

### Local Filesystem

Use the browser File System Access API where available. It supports direct user-granted access to local folders in secure browser contexts and gives us folder handles we can persist in IndexedDB with user permission. Continuous sync should be write-driven from LLMChef operations, with periodic reconciliation as a fallback.

Implementation notes:
- Store the chosen folder handle per workspace/project.
- Mirror VFS writes to disk after successful VFS writes.
- Queue retries if the folder permission is missing or the browser is offline.
- Never sync newly imported files outward without making the destination visible in settings.

Source: MDN File System API, https://developer.mozilla.org/en-US/docs/Web/API/File_System_API

### Git and GitHub

Use LLMChef's existing `isomorphic-git` stack for real Git repositories in browser JavaScript. The app already wraps clone, init, commit, pull, push, branch, status, and remotes in `src/lib/llmchef/vfs-git-operations.ts`; new Git-backed sync features should extend those wrappers rather than introducing another Git library.

Recommended approach:
- Existing `VfsOps.git*` wrappers for full project snapshot/version sync.
- `@octokit/rest` for GitHub-specific setup, repo creation, issue/PR metadata, and simple file updates.
- Keep Git credentials as explicit secrets and redact from exports by default.

Current implementation:
- Project settings can push the selected project folder directly as a Git repository using the configured Sync Repository.
- Project settings can pull a linked repository into an empty project folder, or pull updates for an existing project Git working tree.
- The project VFS folder itself becomes the Git working tree, so human-readable wiki files, raw sources, recipes, and outputs are what Git sees.
- Project sync status is stored in project metadata, including repository, branch, last pushed/pulled time, last action, and the last error.
- `.git` and `.llmchef` are hidden from the Documents/Wiki tree.
- Connected local folders reconcile every minute and now also queue a short debounced sync after VFS writes, deletes, moves, and renames under the project folder.

Sources:
- isomorphic-git, https://isomorphic-git.org/
- Octokit REST, https://github.com/octokit/rest.js

### S3-Compatible Storage

Use AWS SDK v3 for S3-compatible object storage. For large browser uploads, `@aws-sdk/lib-storage` supports multipart upload, and presigned URLs can keep long-lived cloud credentials out of the browser. S3-compatible targets can include AWS S3, Cloudflare R2, MinIO, Backblaze B2 S3 API, and other compatible stores.

Recommended approach:
- Prefer presigned URL/session flow when a user has any signing backend.
- Allow direct S3-compatible credentials only as an advanced mode with clear warnings.
- Store objects as workspace snapshots or path-addressed files plus a manifest.

Source: AWS SDK for JavaScript S3 considerations, https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-s3.html

### Dropbox

Use the official Dropbox JavaScript SDK for OAuth-backed file upload/download/listing. This should be an optional connector with explicit folder scoping.

Recommended approach:
- OAuth/PKCE for browser auth.
- App-folder permission where possible.
- Write LLMChef workspace files under a visible `LLMChef/` folder.

Source: Dropbox JavaScript SDK, https://www.dropbox.com/developers/documentation/javascript

### OneDrive

Use Microsoft Graph from the browser for OneDrive. Microsoft provides JavaScript guidance for listing, downloading, and uploading files from single-page apps, and Graph supports resumable uploads for large files.

Recommended approach:
- Microsoft identity OAuth flow.
- App folder or user-selected drive folder.
- Chunked upload sessions for large snapshots.

Source: Microsoft Graph JavaScript file module, https://learn.microsoft.com/en-us/training/modules/msgraph-manage-files/

## Sync Policy

Every sync connector should expose the same local contract:

```ts
type SyncTarget = {
  id: string;
  label: string;
  direction: "push" | "pull" | "bidirectional";
  capabilities: {
    list: boolean;
    read: boolean;
    write: boolean;
    delete: boolean;
    versioned: boolean;
  };
};
```

Sync must feed the outbound ledger. Anything outside the browser-local filesystem is network egress and should be visible, deduplicated, cancellable, and scoped to a configured provider.

## Prompting Rules

The assistant should maintain the second brain with these defaults:
- Capture important new findings automatically.
- Update existing pages before creating duplicates.
- Keep raw sources separate from synthesized wiki pages.
- Write for the human reader first.
- Add provenance links and confidence where relevant.
- Maintain `_home.md`, `_index.md`, and `overview.md` pages as navigational surfaces.
- Record contradictions and open questions as first-class pages.
- Treat memories as user-owned editable knowledge, not hidden model memory.

Current automation:
- Completed assistant responses can create accepted crea8 markdown memories automatically when they look durable enough.
- Auto memories are written with provenance, source prompt excerpts, tags, and a taxonomy path.
- The memory automation seeds `_index.md` and `overview.md` in the project second-brain folder without overwriting human edits.
- Responses are classified into Findings, Decisions, Lessons, Questions, Contradictions, Sources, or Concepts using local heuristics; the AI prompt still guides richer human-quality edits during chat.
