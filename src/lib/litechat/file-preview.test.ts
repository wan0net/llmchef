import { describe, expect, it } from "vitest";
import {
  HTML_PREVIEW_CSP,
  HTML_PREVIEW_SANDBOX,
  buildSandboxedHtmlPreviewDocument,
  createPreviewBlob,
  decodePreviewText,
  inferFilePreviewDescriptor,
  inferPreviewKind,
} from "./file-preview";

describe("file-preview", () => {
  it("classifies common previewable file types", () => {
    expect(inferPreviewKind("index.html", "text/html")).toBe("html");
    expect(inferPreviewKind("README.md", "text/markdown")).toBe("markdown");
    expect(inferPreviewKind("data.json", "application/json")).toBe("json");
    expect(inferPreviewKind("diagram.svg", "image/svg+xml")).toBe("svg");
    expect(inferPreviewKind("photo.png", "image/png")).toBe("image");
    expect(inferPreviewKind("clip.mp4", "video/mp4")).toBe("video");
    expect(inferPreviewKind("sound.mp3", "audio/mpeg")).toBe("audio");
    expect(inferPreviewKind("app.ts", "text/typescript")).toBe("code");
    expect(inferPreviewKind("notes.txt", "text/plain")).toBe("text");
  });

  it("builds preview descriptors with sandbox requirements", () => {
    const html = inferFilePreviewDescriptor({
      path: "/project/index.html",
      mimeType: "text/html",
      size: 42,
    });
    const markdown = inferFilePreviewDescriptor({
      name: "README.md",
      mimeType: "text/markdown",
    });

    expect(html).toMatchObject({
      kind: "html",
      name: "index.html",
      path: "/project/index.html",
      canPreview: true,
      requiresSandbox: true,
    });
    expect(markdown).toMatchObject({
      kind: "markdown",
      canPreview: true,
      requiresSandbox: false,
    });
  });

  it("marks unknown binary files as unsupported", () => {
    const descriptor = inferFilePreviewDescriptor({
      name: "archive.zip",
      mimeType: "application/zip",
    });

    expect(descriptor.canPreview).toBe(false);
    expect(descriptor.kind).toBe("unsupported");
    expect(descriptor.reason).toContain("not previewable");
  });

  it("creates preview blobs with stable mime types", async () => {
    const descriptor = inferFilePreviewDescriptor({ name: "data.json" });
    const blob = createPreviewBlob("{\"ok\":true}", descriptor);

    expect(blob.type).toBe("application/json");
    expect(blob.size).toBe("{\"ok\":true}".length);
  });

  it("decodes bytes for text-like previews", () => {
    const data = new TextEncoder().encode("hello");
    expect(decodePreviewText(data)).toBe("hello");
    expect(decodePreviewText("already text")).toBe("already text");
  });

  it("wraps HTML fragments with a restrictive CSP document", () => {
    const document = buildSandboxedHtmlPreviewDocument("<h1>Hello</h1>");

    expect(document).toContain("<!doctype html>");
    expect(document).toContain("Content-Security-Policy");
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain("<h1>Hello</h1>");
  });

  it("injects CSP into existing HTML documents and omits same-origin sandboxing", () => {
    const document = buildSandboxedHtmlPreviewDocument(
      "<html><head><title>x</title></head><body></body></html>"
    );

    expect(document).toContain(HTML_PREVIEW_CSP.replace(/"/g, "&quot;"));
    expect(document.indexOf("Content-Security-Policy")).toBeLessThan(
      document.indexOf("<title>x</title>")
    );
    expect(HTML_PREVIEW_SANDBOX).not.toContain("allow-same-origin");
  });
});
