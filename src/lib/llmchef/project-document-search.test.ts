import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProjectDocumentSearchContext } from "./project-document-search";
import * as vfsOps from "./vfs-operations";

vi.mock("./vfs-operations", () => ({
  listFilesOp: vi.fn(),
  readFileOp: vi.fn(),
}));

const encoder = new TextEncoder();

const fileBytes = (text: string): Uint8Array => encoder.encode(text);

const appFiles = new Map<string, string>([
  [
    "/llmchef/package.json",
    JSON.stringify({
      name: "llmchef",
      scripts: {
        build: "vite build",
      },
    }),
  ],
  [
    "/llmchef/system-prompt.txt",
    "LLMChef may attach project-documents-search.md automatically for project grounding.",
  ],
  [
    "/llmchef/src/lib/llmchef/project-document-search.ts",
    "export const buildProjectDocumentSearchContext = async () => 'project document search context';",
  ],
]);

describe("project-document-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vfsOps.listFilesOp).mockImplementation(async (path: string) => {
      if (path === "/llmchef") {
        return [
          {
            name: "package.json",
            path: "/llmchef/package.json",
            isDirectory: false,
            size: appFiles.get("/llmchef/package.json")!.length,
            lastModified: new Date(0),
          },
          {
            name: "system-prompt.txt",
            path: "/llmchef/system-prompt.txt",
            isDirectory: false,
            size: appFiles.get("/llmchef/system-prompt.txt")!.length,
            lastModified: new Date(0),
          },
          {
            name: "src",
            path: "/llmchef/src",
            isDirectory: true,
            size: 0,
            lastModified: new Date(0),
          },
        ];
      }
      if (path === "/llmchef/src") {
        return [
          {
            name: "lib",
            path: "/llmchef/src/lib",
            isDirectory: true,
            size: 0,
            lastModified: new Date(0),
          },
        ];
      }
      if (path === "/llmchef/src/lib") {
        return [
          {
            name: "llmchef",
            path: "/llmchef/src/lib/llmchef",
            isDirectory: true,
            size: 0,
            lastModified: new Date(0),
          },
        ];
      }
      if (path === "/llmchef/src/lib/llmchef") {
        return [
          {
            name: "project-document-search.ts",
            path: "/llmchef/src/lib/llmchef/project-document-search.ts",
            isDirectory: false,
            size: appFiles.get("/llmchef/src/lib/llmchef/project-document-search.ts")!.length,
            lastModified: new Date(0),
          },
        ];
      }
      return [];
    });
    vi.mocked(vfsOps.readFileOp).mockImplementation(async (path: string) => {
      const text = appFiles.get(path);
      if (text === undefined) throw new Error(`Missing fixture for ${path}`);
      return fileBytes(text);
    });
  });

  it("builds local retrieval context from LLMChef source files", async () => {
    const context = await buildProjectDocumentSearchContext({
      projectPath: "/llmchef",
      query: "How does project document search context work?",
      fsInstance: {} as any,
    });

    expect(context.docCount).toBe(3);
    expect(context.chunkCount).toBeGreaterThan(0);
    expect(context.content).toContain("project-document-search.ts");
    expect(context.content).toContain("/llmchef/src/lib/llmchef/project-document-search.ts");
    expect(context.content).toContain("project document search context");
  });
});
