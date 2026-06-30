import React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import {
  useMarkdownParser,
  type MdxComponentData,
  type UniversalBlockData,
} from "@/lib/llmchef/useMarkdownParser";

const MermaidBlockRenderer = React.lazy(() =>
  import("@/components/LLMChef/common/MermaidBlockRenderer").then((module) => ({
    default: module.MermaidBlockRenderer,
  })),
);

type WikiMarkdownPreviewProps = {
  markdown: string;
  editable?: boolean;
  onChange?: (markdown: string) => void;
  onWikiLinkClick?: (label: string) => void;
};

type MarkdownSourceBlock = {
  source: string;
};

type MarkdownBlockKind =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "numberedList"
  | "quote"
  | "code"
  | "callout";

const BLOCK_KIND_OPTIONS: Array<{ value: MarkdownBlockKind; label: string }> = [
  { value: "paragraph", label: "Paragraph" },
  { value: "heading1", label: "Heading 1" },
  { value: "heading2", label: "Heading 2" },
  { value: "heading3", label: "Heading 3" },
  { value: "bulletList", label: "Bullet list" },
  { value: "numberedList", label: "Numbered list" },
  { value: "quote", label: "Quote" },
  { value: "code", label: "Code block" },
  { value: "callout", label: "Callout" },
];

const WIKI_LINK_PREFIX = "#wiki:";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderInlineWikiLinks = (line: string): string =>
  line.replace(/\[\[([^\]\n]+)\]\]/g, (match, rawLink: string) => {
    const [rawTarget, ...rawLabelParts] = rawLink.split("|");
    const target = rawTarget.trim();
    if (!target) return match;

    const label = (rawLabelParts.length > 0 ? rawLabelParts.join("|") : target).trim() || target;
    return `<a href="${WIKI_LINK_PREFIX}${encodeURIComponent(target)}">${escapeHtml(label)}</a>`;
  });

const renderWikiLinksForPreview = (source: string): string => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let fenceMarker: string | null = null;

  return lines
    .map((line) => {
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
      if (fenceMarker) {
        if (fenceMatch?.[1]?.startsWith(fenceMarker)) fenceMarker = null;
        return line;
      }
      if (fenceMatch) {
        fenceMarker = fenceMatch[1][0];
        return line;
      }
      if (/^\s*<\/?[A-Z][\w]*\b/.test(line)) return line;
      return renderInlineWikiLinks(line);
    })
    .join("\n");
};

const isSafeEmbedUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const splitMarkdownSourceBlocks = (markdown: string): MarkdownSourceBlock[] => {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: MarkdownSourceBlock[] = [];
  let current: string[] = [];
  let inFence = false;
  let mdxBlockName: string | null = null;

  const flush = () => {
    const source = current.join("\n").replace(/\n+$/g, "");
    if (source.trim()) blocks.push({ source });
    current = [];
  };

  for (const line of lines) {
    const isFence = /^\s*(```|~~~)/.test(line);
    if (isFence) inFence = !inFence;

    if (!inFence && !mdxBlockName) {
      const opening = line.trim().match(/^<([A-Z][\w]*)\b/);
      if (
        opening &&
        !/\/>\s*$/.test(line.trim()) &&
        !new RegExp(`</${opening[1]}>\\s*$`).test(line.trim())
      ) {
        mdxBlockName = opening[1];
      }
    }

    if (!inFence && !mdxBlockName && line.trim() === "") {
      flush();
      continue;
    }

    current.push(line);

    if (
      !inFence &&
      mdxBlockName &&
      new RegExp(`</${mdxBlockName}>\\s*$`).test(line.trim())
    ) {
      mdxBlockName = null;
    }
  }

  flush();
  return blocks;
};

const detectBlockKind = (source: string): MarkdownBlockKind => {
  const trimmed = source.trimStart();
  if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) return "code";
  if (/^<Callout\b/.test(trimmed)) return "callout";
  if (/^#\s+/.test(trimmed)) return "heading1";
  if (/^##\s+/.test(trimmed)) return "heading2";
  if (/^###\s+/.test(trimmed)) return "heading3";
  if (/^\s*[-*+]\s+/.test(source)) return "bulletList";
  if (/^\s*\d+[.)]\s+/.test(source)) return "numberedList";
  if (/^\s*>\s?/.test(source)) return "quote";
  return "paragraph";
};

const plainTextFromBlockSource = (source: string): string => {
  const kind = detectBlockKind(source);
  if (kind === "code") {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    if (/^\s*(```|~~~)/.test(lines[0] ?? "")) lines.shift();
    if (lines.length > 0 && /^\s*(```|~~~)\s*$/.test(lines[lines.length - 1])) {
      lines.pop();
    }
    return lines.join("\n");
  }
  if (kind === "callout") {
    const match = source.match(/^<Callout\b[^>]*>\n?([\s\S]*?)\n?<\/Callout>\s*$/);
    return match?.[1] ?? source;
  }
  if (kind === "heading1" || kind === "heading2" || kind === "heading3") {
    return source.replace(/^\s*#{1,6}\s+/, "");
  }
  if (kind === "bulletList") {
    return source
      .split("\n")
      .map((line) => line.replace(/^\s*[-*+]\s+/, ""))
      .join("\n");
  }
  if (kind === "numberedList") {
    return source
      .split("\n")
      .map((line) => line.replace(/^\s*\d+[.)]\s+/, ""))
      .join("\n");
  }
  if (kind === "quote") {
    return source
      .split("\n")
      .map((line) => line.replace(/^\s*>\s?/, ""))
      .join("\n");
  }
  return source;
};

const formatBlockSource = (content: string, kind: MarkdownBlockKind): string => {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.length > 0 ? normalized.split("\n") : [""];

  if (kind === "paragraph") return normalized;
  if (kind === "heading1") return `# ${normalized.replace(/\n+/g, " ").trimStart()}`;
  if (kind === "heading2") return `## ${normalized.replace(/\n+/g, " ").trimStart()}`;
  if (kind === "heading3") return `### ${normalized.replace(/\n+/g, " ").trimStart()}`;
  if (kind === "bulletList") {
    return lines.map((line) => `- ${line.replace(/^\s+/, "")}`).join("\n");
  }
  if (kind === "numberedList") {
    return lines.map((line, index) => `${index + 1}. ${line.replace(/^\s+/, "")}`).join("\n");
  }
  if (kind === "quote") return lines.map((line) => `> ${line}`).join("\n");
  if (kind === "code") return `\`\`\`text\n${normalized}\n\`\`\``;
  return `<Callout type="note" title="Note">\n${normalized}\n</Callout>`;
};

const joinMarkdownSourceBlocks = (blocks: MarkdownSourceBlock[]): string =>
  blocks
    .map((block) => block.source)
    .filter((source) => source.trim())
    .join("\n\n");

const RenderedMarkdownBlock: React.FC<{ source: string; itemKey: string }> = ({
  source,
  itemKey,
}) => {
  const parsedContent = useMarkdownParser(renderWikiLinksForPreview(source));

  return (
    <>
      {parsedContent.map((item, index) => {
        if (typeof item === "string") {
          if (!item.trim()) return null;
          return (
            <div
              key={`${itemKey}-html-${index}`}
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          );
        }

        if (item.type === "mdx-component") {
          return (
            <MdxComponentRenderer
              key={`${itemKey}-mdx-${index}`}
              component={item}
            />
          );
        }

        const block = item as UniversalBlockData;
        if (block.lang?.toLowerCase() === "mermaid") {
          return (
            <React.Suspense
              key={`${itemKey}-block-${index}`}
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
            key={`${itemKey}-block-${index}`}
            className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs"
          >
            <code>{block.code}</code>
          </pre>
        );
      })}
    </>
  );
};

const MdxComponentRenderer: React.FC<{ component: MdxComponentData }> = ({
  component,
}) => {
  if (component.component === "Embed") {
    const src = component.props.src;
    const title = component.props.title || src || "Embedded content";
    if (!isSafeEmbedUrl(src)) {
      return (
        <div className="llmchef-mdx-unsupported">
          Unsupported or unsafe embed source
          <pre>{component.source}</pre>
        </div>
      );
    }

    return (
      <figure className="llmchef-mdx-embed">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          sandbox="allow-popups"
          referrerPolicy="no-referrer"
        />
        <figcaption>
          <a href={src} target="_blank" rel="noreferrer">
            {title}
          </a>
        </figcaption>
      </figure>
    );
  }

  if (component.component === "File") {
    const path = component.props.path ?? "";
    const label = component.props.label || path || "File";
    return (
      <div className="llmchef-mdx-file">
        <span className="llmchef-mdx-file-icon" aria-hidden="true">
          #
        </span>
        <span className="llmchef-mdx-file-label">{label}</span>
        {path ? <code>{path}</code> : null}
      </div>
    );
  }

  if (component.component === "Callout") {
    const allowedTypes = new Set(["note", "tip", "warning", "danger"]);
    const type = allowedTypes.has(component.props.type)
      ? component.props.type
      : "note";
    const title =
      component.props.title ||
      (type === "tip"
        ? "Tip"
        : type === "warning"
          ? "Warning"
          : type === "danger"
            ? "Danger"
            : "Note");

    return (
      <aside className={`llmchef-mdx-callout llmchef-mdx-callout-${type}`}>
        <div className="llmchef-mdx-callout-title">{title}</div>
        {component.children ? (
          <div className="llmchef-mdx-callout-body">
            <RenderedMarkdownBlock
              source={component.children}
              itemKey={`callout-${type}-${title}`}
            />
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <div className="llmchef-mdx-unsupported">
      Unsupported MDX component
      <pre>{component.source}</pre>
    </div>
  );
};

const EditableMarkdownBlock: React.FC<{
  source: string;
  blockIndex: number;
  blockCount: number;
  onUpdate: (nextSource: string) => void;
  onInsertAfter: (source: string) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
}> = ({
  source,
  blockIndex,
  blockCount,
  onUpdate,
  onInsertAfter,
  onDelete,
  onMove,
}) => {
  const editorRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [insertKind, setInsertKind] = React.useState<MarkdownBlockKind>("paragraph");
  const blockKind = detectBlockKind(source);

  const applyInlineFormat = (marker: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = source.slice(start, end);
    const nextSource = `${source.slice(0, start)}${marker}${selected}${marker}${source.slice(end)}`;
    onUpdate(nextSource);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + marker.length, end + marker.length);
    });
  };

  const changeBlockKind = (nextKind: MarkdownBlockKind) => {
    onUpdate(formatBlockSource(plainTextFromBlockSource(source), nextKind));
  };

  return (
    <div className="llmchef-markdown-block is-editing">
      <div className="llmchef-markdown-block-toolbar">
        <label className="llmchef-markdown-block-select-label">
          <span>Type</span>
          <select
            value={blockKind}
            className="llmchef-markdown-block-select"
            onChange={(event) => changeBlockKind(event.target.value as MarkdownBlockKind)}
          >
            {BLOCK_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="llmchef-markdown-block-tools" aria-label={`Format block ${blockIndex + 1}`}>
          <button
            type="button"
            className="llmchef-markdown-block-icon-button"
            aria-label="Bold selected text"
            title="Bold"
            onClick={() => applyInlineFormat("**")}
          >
            <BoldIcon />
          </button>
          <button
            type="button"
            className="llmchef-markdown-block-icon-button"
            aria-label="Italic selected text"
            title="Italic"
            onClick={() => applyInlineFormat("*")}
          >
            <ItalicIcon />
          </button>
          <button
            type="button"
            className="llmchef-markdown-block-icon-button"
            aria-label="Code selected text"
            title="Inline code"
            onClick={() => applyInlineFormat("`")}
          >
            <CodeIcon />
          </button>
        </div>
        <div className="llmchef-markdown-block-tools llmchef-markdown-block-tools-right">
          <button
            type="button"
            className="llmchef-markdown-block-icon-button"
            aria-label="Move block up"
            title="Move up"
            disabled={blockIndex === 0}
            onClick={() => onMove("up")}
          >
            <ArrowUpIcon />
          </button>
          <button
            type="button"
            className="llmchef-markdown-block-icon-button"
            aria-label="Move block down"
            title="Move down"
            disabled={blockIndex === blockCount - 1}
            onClick={() => onMove("down")}
          >
            <ArrowDownIcon />
          </button>
          <button
            type="button"
            className="llmchef-markdown-block-icon-button"
            aria-label="Delete block"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2Icon />
          </button>
        </div>
      </div>
      <textarea
        ref={editorRef}
        value={source}
        onChange={(event) => onUpdate(event.target.value)}
        className="llmchef-markdown-block-editor"
        rows={Math.max(3, source.split("\n").length + 1)}
        aria-label={`Block ${blockIndex + 1} Markdown source`}
      />
      <div className="llmchef-markdown-block-add-row">
        <select
          value={insertKind}
          className="llmchef-markdown-block-select"
          aria-label="New block type"
          onChange={(event) => setInsertKind(event.target.value as MarkdownBlockKind)}
        >
          {BLOCK_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="llmchef-markdown-block-button"
          onClick={() => onInsertAfter(formatBlockSource("", insertKind))}
        >
          <PlusIcon aria-hidden="true" />
          Add block
        </button>
      </div>
    </div>
  );
};

const EmptyMarkdownBlockCreator: React.FC<{
  onCreate: (source: string) => void;
}> = ({ onCreate }) => {
  const [kind, setKind] = React.useState<MarkdownBlockKind>("paragraph");

  return (
    <div className="llmchef-markdown-empty-block">
      <select
        value={kind}
        className="llmchef-markdown-block-select"
        aria-label="First block type"
        onChange={(event) => setKind(event.target.value as MarkdownBlockKind)}
      >
        {BLOCK_KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="llmchef-markdown-block-button"
        onClick={() => onCreate(formatBlockSource("", kind))}
      >
        <PlusIcon aria-hidden="true" />
        Add first block
      </button>
    </div>
  );
};

const WikiMarkdownPreview: React.FC<WikiMarkdownPreviewProps> = ({
  markdown,
  editable = false,
  onChange,
  onWikiLinkClick,
}) => {
  const parsedContent = useMarkdownParser(renderWikiLinksForPreview(markdown));
  const sourceBlocks = React.useMemo(
    () => splitMarkdownSourceBlocks(markdown),
    [markdown],
  );
  const handleWikiLinkClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const link = target.closest<HTMLAnchorElement>(`a[href^="${WIKI_LINK_PREFIX}"]`);
      if (!link || !event.currentTarget.contains(link) || !onWikiLinkClick) return;

      event.preventDefault();
      const href = link.getAttribute("href") ?? "";
      onWikiLinkClick(decodeURIComponent(href.slice(WIKI_LINK_PREFIX.length)));
    },
    [onWikiLinkClick],
  );

  if (editable && onChange) {
    if (sourceBlocks.length === 0) {
      return (
        <article className="space-y-3 llmchef-markdown-editing-surface">
          <EmptyMarkdownBlockCreator onCreate={onChange} />
        </article>
      );
    }

    return (
      <article className="space-y-3 llmchef-markdown-editing-surface">
        {sourceBlocks.map((block, index) => {
          const updateBlocks = (nextBlocks: MarkdownSourceBlock[]) => {
            onChange(joinMarkdownSourceBlocks(nextBlocks));
          };

          return (
            <EditableMarkdownBlock
              key={`block-${index}`}
              source={block.source}
              blockIndex={index}
              blockCount={sourceBlocks.length}
              onUpdate={(nextSource) => {
                updateBlocks(
                  sourceBlocks.map((item, itemIndex) =>
                    itemIndex === index ? { source: nextSource } : item,
                  ),
                );
              }}
              onInsertAfter={(nextSource) => {
                updateBlocks([
                  ...sourceBlocks.slice(0, index + 1),
                  { source: nextSource },
                  ...sourceBlocks.slice(index + 1),
                ]);
              }}
              onDelete={() => {
                updateBlocks(sourceBlocks.filter((_, itemIndex) => itemIndex !== index));
              }}
              onMove={(direction) => {
                const targetIndex = direction === "up" ? index - 1 : index + 1;
                if (targetIndex < 0 || targetIndex >= sourceBlocks.length) return;
                const nextBlocks = [...sourceBlocks];
                [nextBlocks[index], nextBlocks[targetIndex]] = [
                  nextBlocks[targetIndex],
                  nextBlocks[index],
                ];
                updateBlocks(nextBlocks);
              }}
            />
          );
        })}
      </article>
    );
  }

  if (parsedContent.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        This wiki page is empty. Use edit mode to start writing.
      </div>
    );
  }

  return (
    <article className="space-y-4" onClick={handleWikiLinkClick}>
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

        if (item.type === "mdx-component") {
          return <MdxComponentRenderer key={`mdx-${index}`} component={item} />;
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
