import { describe, expect, it } from "vitest";
import { sanitizeRichTextHtml } from "./render-sanitizer";

describe("sanitizeRichTextHtml", () => {
  it("adds noopener and noreferrer to target blank links", () => {
    const sanitized = sanitizeRichTextHtml(
      '<a href="https://example.com" target="_blank">Example</a>'
    );

    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
  });

  it("preserves existing rel tokens when normalizing links", () => {
    const sanitized = sanitizeRichTextHtml(
      '<a href="https://example.com" target="_blank" rel="author">Example</a>'
    );

    expect(sanitized).toContain('rel="author noopener noreferrer"');
  });
});
