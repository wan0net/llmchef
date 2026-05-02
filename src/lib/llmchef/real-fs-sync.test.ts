import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeRealFsSyncResult,
  shouldIgnoreRealFsEntry,
  syncRealDirectoryToVfs,
  syncVfsToRealDirectory,
} from "./real-fs-sync";
import * as vfsOps from "./vfs-operations";

vi.mock("./vfs-operations", () => ({
  createDirectoryOp: vi.fn(),
  listFilesOp: vi.fn(),
  readFileOp: vi.fn(),
  writeFileOp: vi.fn(),
}));

type MockHandle = MockDirectoryHandle | MockFileHandle;

class MockDirectoryHandle {
  kind = "directory" as const;
  children = new Map<string, MockHandle>();

  constructor(public name: string) {}

  async *entries(): AsyncIterableIterator<[string, MockHandle]> {
    for (const entry of this.children.entries()) {
      yield entry;
    }
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MockDirectoryHandle> {
    const existing = this.children.get(name);
    if (existing instanceof MockDirectoryHandle) return existing;
    if (!options?.create) throw new Error("Directory does not exist.");

    const created = new MockDirectoryHandle(name);
    this.children.set(name, created);
    return created;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MockFileHandle> {
    const existing = this.children.get(name);
    if (existing instanceof MockFileHandle) return existing;
    if (!options?.create) throw new Error("File does not exist.");

    const created = new MockFileHandle(name);
    this.children.set(name, created);
    return created;
  }
}

class MockFileHandle {
  kind = "file" as const;
  data: Uint8Array | null = null;

  constructor(
    public name: string,
    private readonly file?: File
  ) {}

  async getFile(): Promise<File> {
    if (this.file) return this.file;
    if (this.data) return new File([this.data], this.name, { lastModified: 0 });
    throw new Error("File does not exist yet.");
  }

  async createWritable() {
    return {
      write: async (data: BufferSource | Blob | string) => {
        if (data instanceof Uint8Array) {
          this.data = data;
          return;
        }
        if (data instanceof Blob) {
          this.data = new Uint8Array(await data.arrayBuffer());
          return;
        }
        this.data = new TextEncoder().encode(String(data));
      },
      close: async () => {},
    };
  }
}

const createMockFile = (
  content: string,
  name: string,
  lastModified = 0
): File => {
  const encoded = new TextEncoder().encode(content);
  return {
    name,
    lastModified,
    arrayBuffer: async () => encoded.buffer,
  } as File;
};

const createMockFs = () => ({
  promises: {
    stat: vi.fn(async () => {
      const error = new Error("not found") as Error & { code: string };
      error.code = "ENOENT";
      throw error;
    }),
  },
});

describe("real-fs-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores noisy and sensitive local filesystem names", () => {
    expect(shouldIgnoreRealFsEntry(".git")).toBe(true);
    expect(shouldIgnoreRealFsEntry(".env")).toBe(true);
    expect(shouldIgnoreRealFsEntry("node_modules")).toBe(true);
    expect(shouldIgnoreRealFsEntry("src")).toBe(false);
  });

  it("imports real folder files into VFS and skips ignored entries", async () => {
    const root = new MockDirectoryHandle("root");
    root.children.set(
      "hello.txt",
      new MockFileHandle(
        "hello.txt",
        createMockFile("hello", "hello.txt", 1)
      )
    );
    root.children.set(".env", new MockFileHandle(".env", createMockFile("secret", ".env")));

    const result = await syncRealDirectoryToVfs({
      fsInstance: createMockFs() as any,
      vfsPath: "/project",
      directoryHandle: root as any,
    });

    expect(result.filesImported).toBe(1);
    expect(result.filesSkipped).toBe(1);
    expect(vfsOps.writeFileOp).toHaveBeenCalledWith(
      "/project/hello.txt",
      new Uint8Array(new TextEncoder().encode("hello")),
      expect.any(Object)
    );
  });

  it("exports VFS files into a real folder", async () => {
    vi.mocked(vfsOps.listFilesOp).mockResolvedValueOnce([
      {
        name: "hello.txt",
        path: "/project/hello.txt",
        isDirectory: false,
        size: 5,
        lastModified: new Date(1),
      },
    ]);
    vi.mocked(vfsOps.readFileOp).mockResolvedValueOnce(
      new Uint8Array(new TextEncoder().encode("hello"))
    );

    const root = new MockDirectoryHandle("root");
    const result = await syncVfsToRealDirectory({
      fsInstance: createMockFs() as any,
      vfsPath: "/project",
      directoryHandle: root as any,
    });

    const exported = root.children.get("hello.txt");
    expect(result.filesExported).toBe(1);
    expect(exported).toBeInstanceOf(MockFileHandle);
    expect((exported as MockFileHandle).data).toEqual(
      new Uint8Array(new TextEncoder().encode("hello"))
    );
  });

  it("summarizes sync results for toast messages", () => {
    expect(
      describeRealFsSyncResult("two-way", {
        filesImported: 1,
        filesExported: 2,
        directoriesCreated: 0,
        filesSkipped: 4,
      })
    ).toBe("Sync complete: 3 files changed, 4 skipped.");
  });
});
