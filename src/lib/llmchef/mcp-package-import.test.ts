import { describe, expect, it } from "vitest";
import { parseMcpImportInput } from "./mcp-package-import";

describe("mcp-package-import", () => {
  it("imports npx package snippets as metadata only", () => {
    const result = parseMcpImportInput("npx -y @modelcontextprotocol/server-filesystem /tmp");

    expect(result.packageImports).toHaveLength(1);
    expect(result.packageImports[0]).toMatchObject({
      packageName: "@modelcontextprotocol/server-filesystem",
      command: "npx",
      args: ["/tmp"],
    });
    expect(result.packageImports[0].warnings[0]).toContain("will not execute");
  });

  it("imports npm exec snippets", () => {
    const result = parseMcpImportInput("npm exec @acme/mcp-server -- --endpoint https://mcp.example.com/mcp");

    expect(result.packageImports[0]).toMatchObject({
      packageName: "@acme/mcp-server",
      command: "npm exec",
    });
    expect(result.serverDrafts[0]).toMatchObject({
      url: "https://mcp.example.com/mcp",
    });
  });

  it("recognizes package flag snippets", () => {
    const result = parseMcpImportInput("npx --package=@acme/mcp-server acme-mcp");

    expect(result.packageImports[0].packageName).toBe("@acme/mcp-server");
  });

  it("imports GitHub package specs without execution", () => {
    const result = parseMcpImportInput("npx -y github:example/mcp-server --endpoint https://mcp.example.com/mcp");

    expect(result.packageImports[0]).toMatchObject({
      packageName: "github:example/mcp-server",
      command: "npx",
    });
    expect(result.serverDrafts[0].url).toBe("https://mcp.example.com/mcp");
  });

  it("imports Claude-style JSON configs", () => {
    const result = parseMcpImportInput(JSON.stringify({
      mcpServers: {
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {
            GITHUB_TOKEN: "ghp_secretsecretsecretsecretsecret",
          },
        },
        remote: {
          url: "https://mcp.example.com/mcp",
          headers: {
            Authorization: "Bearer test",
          },
        },
      },
    }));

    expect(result.packageImports.map((item) => item.packageName)).toEqual([
      "@modelcontextprotocol/server-github",
    ]);
    expect(result.packageImports[0].envKeys).toEqual(["GITHUB_TOKEN"]);
    expect(result.serverDrafts[0].url).toBe("https://mcp.example.com/mcp");
  });

  it("rejects unsupported commands", () => {
    expect(() => parseMcpImportInput("python server.py")).toThrow("Only npx/npm exec");
  });
});
