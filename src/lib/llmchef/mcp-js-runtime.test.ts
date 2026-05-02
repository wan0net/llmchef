import { beforeAll, describe, expect, it } from "vitest";
import { init } from "es-module-lexer";
import {
  buildEsmPackageEntryUrl,
  packageSpecToEsmPath,
  parseJsonRpcLines,
  resolveEsmImportSpecifier,
  rewriteEsmImports,
} from "./mcp-js-runtime";

describe("mcp-js-runtime", () => {
  beforeAll(async () => {
    await init;
  });

  it("builds esm.sh package entry URLs for npm packages", () => {
    expect(buildEsmPackageEntryUrl("https://esm.sh", "@modelcontextprotocol/server-example")).toBe(
      "https://esm.sh/@modelcontextprotocol/server-example?bundle=&target=es2022&platform=browser",
    );
  });

  it("maps GitHub npx specs to esm.sh GitHub paths", () => {
    expect(packageSpecToEsmPath("github:example/mcp-server")).toBe("gh/example/mcp-server");
    expect(buildEsmPackageEntryUrl("https://esm.sh", "github:example/mcp-server")).toBe(
      "https://esm.sh/gh/example/mcp-server?bundle=&target=es2022&platform=browser",
    );
  });

  it("resolves dependency specifiers against the registry and importer", () => {
    const importer = "https://esm.sh/@scope/pkg?bundle=&target=es2022&platform=browser";

    expect(resolveEsmImportSpecifier("/stable/node/process.mjs", importer, "https://esm.sh")).toBe(
      "https://esm.sh/stable/node/process.mjs",
    );
    expect(resolveEsmImportSpecifier("./dep.mjs", importer, "https://esm.sh")).toBe("https://esm.sh/@scope/dep.mjs");
    expect(resolveEsmImportSpecifier("eventemitter3", importer, "https://esm.sh")).toBe("https://esm.sh/eventemitter3");
    expect(resolveEsmImportSpecifier("node:fs", importer, "https://esm.sh")).toBeNull();
  });

  it("rewrites static imports to cached module URLs", () => {
    const source = "import x from './x.js';\nexport { y } from \"/y.js\";\nconsole.log(x);";
    const rewritten = rewriteEsmImports(source, new Map([
      ["./x.js", "blob:x"],
      ["/y.js", "blob:y"],
    ]));

    expect(rewritten).toContain("import x from 'blob:x'");
    expect(rewritten).toContain("export { y } from \"blob:y\"");
  });

  it("parses newline-delimited JSON-RPC output and ignores logs", () => {
    expect(parseJsonRpcLines("log line\n{\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"tools\":[{\"name\":\"read\"}]}}\n")).toEqual([
      { jsonrpc: "2.0", id: 2, result: { tools: [{ name: "read" }] } },
    ]);
  });
});
