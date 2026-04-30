import { describe, expect, it } from "vitest";
import {
  buildCodeBlockVfsPath,
  extensionForLanguage,
  mimeTypeForCodeBlock,
} from "./code-block-vfs";

describe("code-block-vfs", () => {
  it("uses relative fenced filepaths under Generated", () => {
    expect(
      buildCodeBlockVfsPath({
        filepath: "src/app.ts",
        language: "ts",
        blockId: "abc",
      })
    ).toBe("/Generated/src/app.ts");
  });

  it("preserves absolute VFS filepaths", () => {
    expect(buildCodeBlockVfsPath({ filepath: "/public/index.html" })).toBe(
      "/public/index.html"
    );
  });

  it("neutralizes traversal segments", () => {
    expect(buildCodeBlockVfsPath({ filepath: "../secrets.env" })).toBe(
      "/Generated/_/secrets.env"
    );
  });

  it("generates deterministic filenames from block metadata", () => {
    expect(
      buildCodeBlockVfsPath({ language: "python", blockId: "block:one" })
    ).toBe("/Generated/code-block-one.py");
  });

  it("maps language and path to preview-friendly mime types", () => {
    expect(extensionForLanguage("typescript")).toBe(".ts");
    expect(mimeTypeForCodeBlock("html", "/Generated/demo.html")).toBe(
      "text/html"
    );
    expect(mimeTypeForCodeBlock("python")).toBe("text/x-python");
  });
});
