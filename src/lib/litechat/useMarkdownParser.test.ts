import { describe, expect, it } from "vitest";
import { parseMarkdownContent } from "./useMarkdownParser";

describe("parseMarkdownContent", () => {
  it("sanitizes raw HTML in markdown output", () => {
    const [html] = parseMarkdownContent(
      'hello <img src=x onerror="alert(1)"><script>alert(2)</script>'
    );

    expect(typeof html).toBe("string");
    expect(html).toContain("hello");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
  });

  it("preserves fenced code as block data", () => {
    const parsed = parseMarkdownContent("```ts:src/example.ts\nconst ok = true;\n```");

    expect(parsed).toEqual([
      {
        type: "block",
        lang: "ts",
        filepath: "src/example.ts",
        code: "const ok = true;\n",
      },
    ]);
  });
});
