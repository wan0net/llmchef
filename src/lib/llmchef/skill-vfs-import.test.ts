import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSkillPackagesInVfs } from "./skill-vfs-import";
import * as vfsOps from "./vfs-operations";

vi.mock("./vfs-operations", () => ({
  listFilesOp: vi.fn(),
  readFileOp: vi.fn(),
}));

const fsInstance = {} as any;

describe("findSkillPackagesInVfs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("imports a single VFS folder that contains skill.json", async () => {
    vi.mocked(vfsOps.readFileOp).mockImplementation(async (path) => {
      if (path === "/Skills/demo/skill.json") {
        return bytes('{"schemaVersion":1,"slug":"demo","name":"Demo","description":"Demo skill","version":"0.1.0"}');
      }
      if (path === "/Skills/demo/README.md") return bytes("# Demo");
      throw new Error("missing");
    });
    vi.mocked(vfsOps.listFilesOp).mockResolvedValue([
      entry("skill.json", "/Skills/demo/skill.json", false),
      entry("README.md", "/Skills/demo/README.md", false),
    ]);

    const packages = await findSkillPackagesInVfs("/Skills/demo", {
      fsInstance,
    });

    expect(packages).toEqual([
      {
        rootPath: "/Skills/demo",
        files: [
          {
            path: "README.md",
            content: "# Demo",
          },
          {
            path: "skill.json",
            content:
              '{"schemaVersion":1,"slug":"demo","name":"Demo","description":"Demo skill","version":"0.1.0"}',
          },
        ],
      },
    ]);
  });

  it("discovers cloned repo packages under .llmchef/skills", async () => {
    vi.mocked(vfsOps.readFileOp).mockImplementation(async (path) => {
      if (path === "/repo/.llmchef/skills/alpha/skill.json") {
        return bytes('{"schemaVersion":1,"slug":"alpha","name":"Alpha","description":"Alpha skill","version":"1.0.0"}');
      }
      if (path === "/repo/.llmchef/skills/beta/skill.json") {
        return bytes('{"schemaVersion":1,"slug":"beta","name":"Beta","description":"Beta skill","version":"1.0.0"}');
      }
      throw new Error("missing");
    });
    vi.mocked(vfsOps.listFilesOp).mockImplementation(async (path) => {
      if (path === "/repo") return [entry(".llmchef", "/repo/.llmchef", true)];
      if (path === "/repo/.llmchef/skills") {
        return [
          entry("beta", "/repo/.llmchef/skills/beta", true),
          entry("alpha", "/repo/.llmchef/skills/alpha", true),
        ];
      }
      if (path === "/repo/.llmchef/skills/alpha") {
        return [entry("skill.json", "/repo/.llmchef/skills/alpha/skill.json", false)];
      }
      if (path === "/repo/.llmchef/skills/beta") {
        return [entry("skill.json", "/repo/.llmchef/skills/beta/skill.json", false)];
      }
      return [];
    });

    const packages = await findSkillPackagesInVfs("/repo", { fsInstance });

    expect(packages.map((pkg) => pkg.rootPath)).toEqual([
      "/repo/.llmchef/skills/alpha",
      "/repo/.llmchef/skills/beta",
    ]);
  });
});

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const entry = (name: string, path: string, isDirectory: boolean) => ({
  name,
  path,
  isDirectory,
  size: isDirectory ? 0 : 1,
  lastModified: new Date(),
});
