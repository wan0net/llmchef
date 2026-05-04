import React from "react";
import {
  useMarkdownParser,
  type UniversalBlockData,
} from "@/lib/llmchef/useMarkdownParser";

const MermaidBlockRenderer = React.lazy(() =>
  import("@/components/LLMChef/common/MermaidBlockRenderer").then((module) => ({
    default: module.MermaidBlockRenderer,
  })),
);

const WikiMarkdownPreview: React.FC<{ markdown: string }> = ({ markdown }) => {
  const parsedContent = useMarkdownParser(markdown);

  if (parsedContent.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        This wiki page is empty. Switch to edit mode to start writing.
      </div>
    );
  }

  return (
    <article className="space-y-4">
      {parsedContent.map((item, index) => {
        if (typeof item === "string") {
          if (!item.trim()) return null;
          return (
            <div
              key={`html-${index}`}
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          );
        }

        const block = item as UniversalBlockData;
        if (block.lang?.toLowerCase() === "mermaid") {
          return (
            <React.Suspense
              key={`block-${index}`}
              fallback={
                <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Rendering diagram...
                </div>
              }
            >
              <MermaidBlockRenderer code={block.code} />
            </React.Suspense>
          );
        }

        return (
          <pre
            key={`block-${index}`}
            className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs"
          >
            <code>{block.code}</code>
          </pre>
        );
      })}
    </article>
  );
};

export default WikiMarkdownPreview;
