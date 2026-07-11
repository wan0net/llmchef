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
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script");
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

  it("does not parse MDX-like tags inside fenced TSX code blocks", () => {
    const parsed = parseMarkdownContent(
      '```tsx\n<Embed src="https://example.com" />\n```',
    );

    expect(parsed).toEqual([
      {
        type: "block",
        lang: "tsx",
        code: '<Embed src="https://example.com" />\n',
      },
    ]);
  });

  it("parses prose-level Embed as a safe MDX component", () => {
    const parsed = parseMarkdownContent(
      '<Embed src="https://example.com" title="Example" />',
    );

    expect(parsed).toEqual([
      {
        type: "mdx-component",
        component: "Embed",
        props: {
          src: "https://example.com",
          title: "Example",
        },
        source: '<Embed src="https://example.com" title="Example" />',
      },
    ]);
  });

  it("parses paired Callout with markdown children as a safe MDX component", () => {
    const parsed = parseMarkdownContent(
      '<Callout type="tip" title="Try this">\n**Ship** the slice.\n</Callout>',
    );

    expect(parsed).toEqual([
      {
        type: "mdx-component",
        component: "Callout",
        props: {
          type: "tip",
          title: "Try this",
        },
        children: "**Ship** the slice.",
        source:
          '<Callout type="tip" title="Try this">\n**Ship** the slice.\n</Callout>',
      },
    ]);
  });
});
