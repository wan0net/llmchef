import { type ControlModule } from "@/types/llmchef/control";
import {
  type LLMChefModApi,
  type ReadonlyChatContextSnapshot,
} from "@/types/llmchef/modding";
import { readFileOp, VFS } from "@/lib/llmchef/vfs-operations";
import { normalizePath } from "@/lib/llmchef/file-manager-utils";
import {
  extractDocumentText,
  extractSpreadsheetSheets,
  inspectDocument,
} from "@/lib/llmchef/document-extraction";
import { Tool } from "ai";
import { z } from "zod";

const DEFAULT_MAX_CHARS = 30000;
const DEFAULT_MAX_ITEMS = 50;
const DEFAULT_MAX_ROWS = 100;
const DEFAULT_MAX_CELLS = 2000;

const documentExtractTextSchema = z.object({
  path: z.string().describe("The VFS path of the document to extract text from."),
  maxChars: z
    .number()
    .optional()
    .default(DEFAULT_MAX_CHARS)
    .describe(`Maximum characters to return. Defaults to ${DEFAULT_MAX_CHARS}.`),
  includeMetadata: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include document metadata such as counts, sheet names, or page snippets."),
});

const documentInspectSchema = z.object({
  path: z.string().describe("The VFS path of the document to inspect."),
  maxItems: z
    .number()
    .optional()
    .default(DEFAULT_MAX_ITEMS)
    .describe(`Maximum structural items to return. Defaults to ${DEFAULT_MAX_ITEMS}.`),
});

const spreadsheetExtractSheetsSchema = z.object({
  path: z.string().describe("The VFS path of the .xlsx, .csv, or .tsv file."),
  sheets: z
    .array(z.string())
    .optional()
    .describe("Optional worksheet names to extract from .xlsx files."),
  maxRows: z
    .number()
    .optional()
    .default(DEFAULT_MAX_ROWS)
    .describe(`Maximum rows per sheet. Defaults to ${DEFAULT_MAX_ROWS}.`),
  maxCells: z
    .number()
    .optional()
    .default(DEFAULT_MAX_CELLS)
    .describe(`Maximum total cells to return. Defaults to ${DEFAULT_MAX_CELLS}.`),
});

type ToolContext = ReadonlyChatContextSnapshot & {
  fsInstance?: typeof VFS;
};

const DOCUMENT_READ_CONTROL_PROMPT = `Use documentExtractText, documentInspect, and spreadsheetExtractSheets when the user asks to read, summarize, inspect, import, or reason over DOCX, PPTX, XLSX, PDF, CSV, TSV, Markdown, JSON, or text files in the VFS.

These tools are read-only. They extract structured text, tables, sheets, slides, and pages from VFS files; they do not edit or write Office/PDF documents. For calculations or deeper analysis after extraction, pass the compact extracted content to pythonExecute.context.`;

export class DocumentReadToolsModule implements ControlModule {
  readonly id = "core-document-read-tools";
  private unregisterCallbacks: (() => void)[] = [];

  async initialize(): Promise<void> {
    console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LLMChefModApi): void {
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const documentExtractTextTool: Tool<typeof documentExtractTextSchema> = {
      description:
        "Read a VFS document and extract bounded text from DOCX, PPTX, XLSX, PDF, TXT, MD, JSON, CSV, or TSV files.",
      inputSchema: documentExtractTextSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "documentExtractText",
        documentExtractTextTool,
        async (
          { path, maxChars, includeMetadata }: z.infer<typeof documentExtractTextSchema>,
          context: ToolContext
        ) => {
          const normalizedPath = normalizePath(path);
          const bytes = await readVfsDocument(normalizedPath, context);
          if (!bytes.success) return bytes;

          try {
            const result = await extractDocumentText(normalizedPath, bytes.data, {
              maxChars,
              includeMetadata,
            });
            return { success: true, path: normalizedPath, ...result };
          } catch (error: any) {
            return toolError(normalizedPath, error);
          }
        }
      )
    );

    const documentInspectTool: Tool<typeof documentInspectSchema> = {
      description:
        "Inspect the high-level structure of a VFS document: DOCX paragraph/table counts, PPTX slides, XLSX sheets, PDF pages, or text snippets.",
      inputSchema: documentInspectSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "documentInspect",
        documentInspectTool,
        async (
          { path, maxItems }: z.infer<typeof documentInspectSchema>,
          context: ToolContext
        ) => {
          const normalizedPath = normalizePath(path);
          const bytes = await readVfsDocument(normalizedPath, context);
          if (!bytes.success) return bytes;

          try {
            const result = await inspectDocument(normalizedPath, bytes.data, {
              maxItems,
            });
            return { success: true, path: normalizedPath, ...result };
          } catch (error: any) {
            return toolError(normalizedPath, error);
          }
        }
      )
    );

    const spreadsheetExtractSheetsTool: Tool<typeof spreadsheetExtractSheetsSchema> = {
      description:
        "Extract bounded rows from VFS .xlsx worksheets or simple CSV/TSV files as arrays, with headers when available.",
      inputSchema: spreadsheetExtractSheetsSchema,
    };

    this.unregisterCallbacks.push(
      modApi.registerTool(
        "spreadsheetExtractSheets",
        spreadsheetExtractSheetsTool,
        async (
          { path, sheets, maxRows, maxCells }: z.infer<typeof spreadsheetExtractSheetsSchema>,
          context: ToolContext
        ) => {
          const normalizedPath = normalizePath(path);
          const bytes = await readVfsDocument(normalizedPath, context);
          if (!bytes.success) return bytes;

          try {
            const result = await extractSpreadsheetSheets(normalizedPath, bytes.data, {
              sheets,
              maxRows,
              maxCells,
            });
            return { success: true, path: normalizedPath, ...result };
          } catch (error: any) {
            return toolError(normalizedPath, error);
          }
        }
      )
    );

    this.unregisterCallbacks.push(
      modApi.registerRule({
        id: `${this.id}-control-rule`,
        name: "Document Read Tools Control",
        content: DOCUMENT_READ_CONTROL_PROMPT,
        description: "Guides use of read-only document extraction tools",
        type: "control",
        alwaysOn: true,
        moduleId: this.id,
      })
    );

    console.log(`[${this.id}] Document read tools registered.`);
  }

  destroy(): void {
    this.unregisterCallbacks.forEach((callback) => callback());
    this.unregisterCallbacks = [];
    console.log(`[${this.id}] Destroyed.`);
  }
}

const readVfsDocument = async (
  path: string,
  context: ToolContext
): Promise<{ success: true; data: Uint8Array } | { success: false; path: string; error: string }> => {
  const fsInstance = context?.fsInstance;
  if (!fsInstance) {
    return {
      success: false,
      path,
      error: "Filesystem instance not available in context.",
    };
  }

  try {
    const data = await readFileOp(path, { fsInstance, silent: true });
    return { success: true, data };
  } catch (error: any) {
    return toolError(path, error);
  }
};

const toolError = (
  path: string,
  error: unknown
): { success: false; path: string; error: string } => ({
  success: false,
  path,
  error: error instanceof Error ? error.message : String(error),
});
