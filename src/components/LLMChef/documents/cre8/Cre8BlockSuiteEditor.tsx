import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BoldIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PaperclipIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  Table2Icon,
  Undo2Icon,
} from "lucide-react";
import { AffineSchemas } from "@blocksuite/blocks";
import { effects as blockEffects } from "@blocksuite/blocks/effects";
import { AffineEditorContainer } from "@blocksuite/presets";
import { effects as presetEffects } from "@blocksuite/presets/effects";
import { DocCollection, Schema, Text, type Doc } from "@blocksuite/store";
import { cn } from "@/lib/utils";
import { exportMarkdown, importMarkdown } from "./serializer";

type FormatCommand =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bulleted"
  | "numbered"
  | "todo"
  | "undo"
  | "redo";

type InsertType = "image" | "attachment" | "code" | "divider" | "table" | "link";

type Cre8BlockSuiteEditorProps = {
  markdown: string;
  onChange: (nextMarkdown: string) => void;
  className?: string;
};

let effectsRegistered = false;

const ensureBlockSuiteEffects = () => {
  if (effectsRegistered) return;
  blockEffects();
  presetEffects();
  effectsRegistered = true;
};

const createCollection = (): DocCollection => {
  ensureBlockSuiteEffects();
  const schema = new Schema();
  schema.register(AffineSchemas);

  const collection = new DocCollection({ schema });
  collection.meta.initialize();
  return collection;
};

const findNoteId = (doc: Doc): string | null => {
  const noteBlock = doc
    .getBlocks()
    .find((block) => block.flavour === "affine:note");
  return noteBlock?.id ?? null;
};

const dispatchEditorKey = (
  container: HTMLElement | null,
  init: KeyboardEventInit,
) => {
  container?.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
};

const toolbarTabs = [
  { id: "write", label: "Write" },
  { id: "insert", label: "Insert" },
] as const;

const Cre8ToolbarButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    type="button"
    className="cre8-toolbar-btn"
    title={title}
    aria-label={title}
    tabIndex={-1}
    onMouseDown={(event) => event.preventDefault()}
    onClick={(event) => {
      event.preventDefault();
      onClick();
    }}
  >
    {children}
  </button>
);

const Cre8ToolbarSep = () => <span className="cre8-toolbar-sep" aria-hidden="true" />;

export const Cre8BlockSuiteEditor: React.FC<Cre8BlockSuiteEditorProps> = ({
  markdown,
  onChange,
  className,
}) => {
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<AffineEditorContainer | null>(null);
  const docRef = useRef<Doc | null>(null);
  const collectionRef = useRef<DocCollection | null>(null);
  const markdownRef = useRef(markdown);
  const lastEmittedMarkdownRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<"write" | "insert">("write");

  useEffect(() => {
    markdownRef.current = markdown;
  }, [markdown]);

  useEffect(() => {
    if (markdown === lastEmittedMarkdownRef.current) return;

    const root = editorRootRef.current;
    if (!root) return;

    // First pass mirrors Cre8's markdown serializer; MDX/frontmatter round-trip as markdown text.
    const collection = createCollection();
    const doc = importMarkdown(collection, markdown);
    const editor = new AffineEditorContainer();
    editor.doc = doc;
    editor.autofocus = true;

    root.replaceChildren(editor);
    collectionRef.current = collection;
    docRef.current = doc;
    editorRef.current = editor;

    let initialized = false;
    const initializeTimer = window.setTimeout(() => {
      initialized = true;
    }, 500);

    const handleUpdate = () => {
      if (!initialized) return;
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(async () => {
        debounceRef.current = null;
        const currentDoc = docRef.current;
        if (!currentDoc) return;
        const nextMarkdown = await exportMarkdown(currentDoc);
        if (nextMarkdown === markdownRef.current) return;
        lastEmittedMarkdownRef.current = nextMarkdown;
        onChange(nextMarkdown);
      }, 400);
    };

    doc.spaceDoc.on("update", handleUpdate);

    return () => {
      window.clearTimeout(initializeTimer);
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      doc.spaceDoc.off("update", handleUpdate);
      editor.remove();
      root.replaceChildren();
      doc.dispose();
      collection.dispose();
      if (docRef.current === doc) docRef.current = null;
      if (collectionRef.current === collection) collectionRef.current = null;
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [markdown, onChange]);

  const addBlock = useCallback((flavour: string, props: Record<string, unknown> = {}) => {
    const doc = docRef.current;
    if (!doc) return;
    const noteId = findNoteId(doc);
    if (!noteId) return;
    doc.addBlock(flavour as never, props, noteId);
  }, []);

  const handleFormat = useCallback(
    (command: FormatCommand) => {
      const editorEl = editorRef.current;
      const keyMap: Partial<Record<FormatCommand, KeyboardEventInit>> = {
        bold: { key: "b", code: "KeyB", metaKey: true },
        italic: { key: "i", code: "KeyI", metaKey: true },
        strikethrough: { key: "d", code: "KeyD", metaKey: true, shiftKey: true },
        code: { key: "e", code: "KeyE", metaKey: true },
        undo: { key: "z", code: "KeyZ", metaKey: true },
        redo: { key: "z", code: "KeyZ", metaKey: true, shiftKey: true },
      };
      const keyCommand = keyMap[command];
      if (keyCommand) {
        dispatchEditorKey(editorEl, keyCommand);
        return;
      }

      if (command === "h1" || command === "h2" || command === "h3") {
        addBlock("affine:paragraph", {
          text: new Text(""),
          type: command,
        });
        return;
      }
      if (command === "quote") {
        addBlock("affine:paragraph", {
          text: new Text(""),
          type: "quote",
        });
        return;
      }
      if (command === "bulleted" || command === "numbered" || command === "todo") {
        addBlock("affine:list", {
          text: new Text(""),
          type: command === "bulleted" ? "bulleted" : command,
          checked: false,
        });
      }
    },
    [addBlock],
  );

  const handleInsert = useCallback(
    (type: InsertType) => {
      if (type === "divider") {
        addBlock("affine:divider");
        return;
      }
      if (type === "code") {
        addBlock("affine:code", { language: "text", text: new Text("") });
        return;
      }
      if (type === "table") {
        addBlock("affine:database", {});
        return;
      }
      if (type === "link") {
        const url = window.prompt("URL");
        if (url) addBlock("affine:bookmark", { url });
        return;
      }
      if (type === "attachment") {
        const input = document.createElement("input");
        input.type = "file";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          addBlock("affine:attachment", {
            name: file.name,
            size: file.size,
            type: file.type,
          });
        };
        input.click();
        return;
      }
      if (type === "image") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async () => {
          const file = input.files?.[0];
          const doc = docRef.current;
          if (!file || !doc) return;
          const sourceId = await doc.collection.blobSync.set(file);
          addBlock("affine:image", { sourceId });
        };
        input.click();
      }
    },
    [addBlock],
  );

  return (
    <div className={cn("llmchef-cre8-editor-shell", className)}>
      <div className="cre8-toolbar">
        <div className="cre8-toolbar-tabs">
          {toolbarTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn("cre8-toolbar-tab", activeTab === tab.id && "active")}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="cre8-toolbar-panels">
          <div
            className={cn("cre8-toolbar-panel", activeTab === "write" && "active")}
          >
            <Cre8ToolbarButton title="Bold" onClick={() => handleFormat("bold")}>
              <BoldIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Italic" onClick={() => handleFormat("italic")}>
              <ItalicIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton
              title="Strikethrough"
              onClick={() => handleFormat("strikethrough")}
            >
              <StrikethroughIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Inline code" onClick={() => handleFormat("code")}>
              <Code2Icon />
            </Cre8ToolbarButton>
            <Cre8ToolbarSep />
            <Cre8ToolbarButton title="Heading 1" onClick={() => handleFormat("h1")}>
              <Heading1Icon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Heading 2" onClick={() => handleFormat("h2")}>
              <Heading2Icon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Heading 3" onClick={() => handleFormat("h3")}>
              <Heading3Icon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Quote" onClick={() => handleFormat("quote")}>
              <QuoteIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarSep />
            <Cre8ToolbarButton title="Bullet list" onClick={() => handleFormat("bulleted")}>
              <ListIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Numbered list" onClick={() => handleFormat("numbered")}>
              <ListOrderedIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Todo list" onClick={() => handleFormat("todo")}>
              <ListTodoIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarSep />
            <Cre8ToolbarButton title="Undo" onClick={() => handleFormat("undo")}>
              <Undo2Icon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Redo" onClick={() => handleFormat("redo")}>
              <Redo2Icon />
            </Cre8ToolbarButton>
          </div>
          <div
            className={cn("cre8-toolbar-panel", activeTab === "insert" && "active")}
          >
            <span className="cre8-toolbar-label">Content</span>
            <Cre8ToolbarButton title="Image" onClick={() => handleInsert("image")}>
              <ImageIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton
              title="Attachment"
              onClick={() => handleInsert("attachment")}
            >
              <PaperclipIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Code block" onClick={() => handleInsert("code")}>
              <Code2Icon />
            </Cre8ToolbarButton>
            <Cre8ToolbarButton title="Divider" onClick={() => handleInsert("divider")}>
              <MinusIcon />
            </Cre8ToolbarButton>
            <Cre8ToolbarSep />
            <span className="cre8-toolbar-label">Data</span>
            <Cre8ToolbarButton title="Table" onClick={() => handleInsert("table")}>
              <Table2Icon />
            </Cre8ToolbarButton>
            <Cre8ToolbarSep />
            <span className="cre8-toolbar-label">Links</span>
            <Cre8ToolbarButton title="Bookmark" onClick={() => handleInsert("link")}>
              <LinkIcon />
            </Cre8ToolbarButton>
          </div>
        </div>
      </div>
      <div className="llmchef-cre8-editor-root" ref={editorRootRef} />
    </div>
  );
};

export default Cre8BlockSuiteEditor;
