import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Crea8MemoryNote } from "@/types/litechat/crea8-memory";
import { serializeCrea8MarkdownNote } from "./crea8-memory";
import { createCrea8VfsConnector } from "./crea8-vfs-connector";
import * as vfsOps from "./vfs-operations";

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "generated-id"),
}));

vi.mock("./vfs-operations", () => ({
  listFilesOp: vi.fn(),
  readFileOp: vi.fn(),
  writeFileOp: vi.fn(),
}));

const encoder = new TextEncoder();

const noteMarkdown = (note: Crea8MemoryNote): Uint8Array => {
  return encoder.encode(serializeCrea8MarkdownNote(note));
};

const makeNote = (
  overrides: Partial<Crea8MemoryNote> = {}
): Crea8MemoryNote => ({
  id: "note-1",
  title: "Deployment Notes",
  content: "LiteChat deploys through Cloudflare Pages for project alpha.",
  scope: "project",
  tags: ["deploy", "cloudflare"],
  projectId: "project-alpha",
  skillId: null,
  path: "/Memory/Projects/deployment-notes.md",
  createdAt: new Date("2026-04-30T00:00:00.000Z"),
  updatedAt: new Date("2026-04-30T01:00:00.000Z"),
  ...overrides,
});

describe("crea8-vfs-connector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("recursively searches markdown notes and filters by text, scope, and project", async () => {
    const connector = createCrea8VfsConnector();
    const projectNote = makeNote();
    const userNote = makeNote({
      id: "note-2",
      title: "Personal Preferences",
      content: "Prefer dense UI.",
      scope: "user",
      tags: ["ui"],
      projectId: null,
      path: "/Memory/User/personal-preferences.md",
    });

    vi.mocked(vfsOps.listFilesOp)
      .mockResolvedValueOnce([
        {
          name: "Projects",
          path: "/Memory/Projects",
          isDirectory: true,
          size: 0,
          lastModified: new Date(0),
        },
        {
          name: "User",
          path: "/Memory/User",
          isDirectory: true,
          size: 0,
          lastModified: new Date(0),
        },
      ])
      .mockResolvedValueOnce([
        {
          name: "deployment-notes.md",
          path: "/Memory/Projects/deployment-notes.md",
          isDirectory: false,
          size: 1,
          lastModified: new Date(1),
        },
      ])
      .mockResolvedValueOnce([
        {
          name: "personal-preferences.md",
          path: "/Memory/User/personal-preferences.md",
          isDirectory: false,
          size: 1,
          lastModified: new Date(1),
        },
      ]);
    vi.mocked(vfsOps.readFileOp)
      .mockResolvedValueOnce(noteMarkdown(projectNote))
      .mockResolvedValueOnce(noteMarkdown(userNote));

    const results = await connector.search({
      text: "cloudflare",
      scopes: ["project"],
      projectId: "project-alpha",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      note: {
        backend: "markdown-workspace",
        id: "note-1",
        title: "Deployment Notes",
        path: "/Memory/Projects/deployment-notes.md",
      },
      snippet: expect.stringContaining("Cloudflare"),
      scope: "project",
      tags: ["deploy", "cloudflare"],
    });
  });

  it("skips invalid markdown notes during search", async () => {
    const connector = createCrea8VfsConnector();
    const validNote = makeNote({ id: "valid-note" });

    vi.mocked(vfsOps.listFilesOp).mockResolvedValueOnce([
      {
        name: "invalid.md",
        path: "/Memory/invalid.md",
        isDirectory: false,
        size: 1,
        lastModified: new Date(1),
      },
      {
        name: "valid.md",
        path: "/Memory/valid.md",
        isDirectory: false,
        size: 1,
        lastModified: new Date(1),
      },
    ]);
    vi.mocked(vfsOps.readFileOp)
      .mockResolvedValueOnce(encoder.encode("---\ntitle: Missing id\n---\n\nNo id."))
      .mockResolvedValueOnce(noteMarkdown(validNote));

    const results = await connector.search({ text: "cloudflare" });

    expect(results).toHaveLength(1);
    expect(results[0].note.id).toBe("valid-note");
  });

  it("reads and parses a note at ref.path", async () => {
    const connector = createCrea8VfsConnector();
    const note = makeNote();

    vi.mocked(vfsOps.readFileOp).mockResolvedValueOnce(noteMarkdown(note));

    const parsed = await connector.read({
      backend: "markdown-workspace",
      id: note.id,
      title: note.title,
      path: note.path,
    });

    expect(parsed).toMatchObject({
      id: note.id,
      title: note.title,
      scope: "project",
      path: note.path,
    });
    expect(vfsOps.readFileOp).toHaveBeenCalledWith(note.path, {
      fsInstance: undefined,
      silent: true,
    });
  });

  it("creates a note at a default scope path and returns a markdown-workspace ref", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T03:00:00.000Z"));
    const connector = createCrea8VfsConnector();

    const ref = await connector.create({
      title: "Cloudflare Deploy!",
      content: "Publish from the workspace.",
      scope: "project",
      tags: ["deploy"],
      projectId: "project-alpha",
      skillId: null,
    });

    expect(ref).toEqual({
      backend: "markdown-workspace",
      id: "generated-id",
      title: "Cloudflare Deploy!",
      path: "/Memory/Projects/cloudflare-deploy.md",
    });
    const [path, data, options] = vi.mocked(vfsOps.writeFileOp).mock.calls[0];
    expect(path).toBe("/Memory/Projects/cloudflare-deploy.md");
    expect(ArrayBuffer.isView(data)).toBe(true);
    expect(options).toEqual({ fsInstance: undefined });

    const markdown = new TextDecoder().decode(data as Uint8Array);
    expect(markdown).toContain('crea8-id: "generated-id"');
    expect(markdown).toContain('litechat-project-id: "project-alpha"');
    expect(markdown).toContain("Publish from the workspace.");
  });

  it("updates a note by merging patches, preserving id and createdAt, and writing markdown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T04:00:00.000Z"));
    const connector = createCrea8VfsConnector();
    const existing = makeNote();

    vi.mocked(vfsOps.readFileOp).mockResolvedValueOnce(noteMarkdown(existing));

    const ref = await connector.update(
      {
        backend: "markdown-workspace",
        id: existing.id,
        title: existing.title,
        path: existing.path,
      },
      {
        title: "Updated Deployment Notes",
        content: "Updated content.",
        tags: ["updated"],
      }
    );

    expect(ref).toEqual({
      backend: "markdown-workspace",
      id: existing.id,
      title: "Updated Deployment Notes",
      path: existing.path,
    });
    const [path, data, options] = vi.mocked(vfsOps.writeFileOp).mock.calls[0];
    expect(path).toBe(existing.path);
    expect(ArrayBuffer.isView(data)).toBe(true);
    expect(options).toEqual({ fsInstance: undefined });

    const markdown = new TextDecoder().decode(data as Uint8Array);
    expect(markdown).toContain('crea8-id: "note-1"');
    expect(markdown).toContain('created: "2026-04-30T00:00:00.000Z"');
    expect(markdown).toContain('updated: "2026-04-30T04:00:00.000Z"');
    expect(markdown).toContain("Updated content.");
  });
});
