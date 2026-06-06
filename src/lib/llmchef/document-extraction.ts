import JSZip from "jszip";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

export type DocumentKind =
  | "docx"
  | "pptx"
  | "xlsx"
  | "pdf"
  | "text"
  | "csv"
  | "tsv";

export type ExtractMetadata = Record<string, unknown>;

export type TextExtractionResult = {
  kind: DocumentKind;
  text: string;
  metadata?: ExtractMetadata;
  truncated?: boolean;
};

export type InspectResult = {
  kind: DocumentKind;
  metadata?: ExtractMetadata;
  truncated?: boolean;
};

export type SpreadsheetSheet = {
  name: string;
  rows: string[][];
  headers?: string[];
  rowCount?: number;
  columnCount?: number;
  truncated?: boolean;
};

export type SpreadsheetExtractionResult = {
  kind: "xlsx" | "csv" | "tsv";
  sheets: SpreadsheetSheet[];
  truncated?: boolean;
};

type SheetRef = {
  name: string;
  path: string;
};

type XlsxCell = {
  ref?: string;
  value: string;
  row: number;
  col: number;
};

const DEFAULT_MAX_CHARS = 30000;
const DEFAULT_MAX_ITEMS = 50;
const DEFAULT_MAX_ROWS = 100;
const DEFAULT_MAX_CELLS = 2000;

const XML_NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const decoder = new TextDecoder();

export const getDocumentKind = (path: string): DocumentKind | null => {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "docx":
    case "pptx":
    case "xlsx":
    case "pdf":
      return ext;
    case "txt":
    case "md":
    case "json":
      return "text";
    case "csv":
      return "csv";
    case "tsv":
      return "tsv";
    default:
      return null;
  }
};

export const extractDocumentText = async (
  path: string,
  bytes: Uint8Array,
  options: { maxChars?: number; includeMetadata?: boolean } = {}
): Promise<TextExtractionResult> => {
  const kind = getDocumentKind(path);
  if (!kind) {
    throw new Error(`Unsupported document type for "${path}".`);
  }

  const maxChars = positiveLimit(options.maxChars, DEFAULT_MAX_CHARS);
  const includeMetadata = options.includeMetadata === true;

  if (kind === "text" || kind === "csv" || kind === "tsv") {
    const limited = limitText(decoder.decode(bytes), maxChars);
    return {
      kind,
      text: limited.text,
      metadata: includeMetadata ? { bytes: bytes.byteLength } : undefined,
      truncated: limited.truncated,
    };
  }

  if (kind === "docx") {
    const docx = await extractDocx(bytes);
    const sections = [
      ...docx.paragraphs,
      ...docx.tables.map((table, index) => tableToMarkdown(table, `Table ${index + 1}`)),
    ];
    const limited = limitText(sections.filter(Boolean).join("\n\n"), maxChars);
    return {
      kind,
      text: limited.text,
      metadata: includeMetadata
        ? {
            paragraphs: docx.paragraphs.length,
            tables: docx.tables.length,
            headings: docx.headings,
          }
        : undefined,
      truncated: limited.truncated,
    };
  }

  if (kind === "pptx") {
    const pptx = await extractPptx(bytes);
    const text = pptx.slides
      .map((slide) => [`Slide ${slide.number}: ${slide.title || "(untitled)"}`, slide.text].join("\n"))
      .join("\n\n");
    const limited = limitText(text, maxChars);
    return {
      kind,
      text: limited.text,
      metadata: includeMetadata ? { slides: pptx.slides.length } : undefined,
      truncated: limited.truncated,
    };
  }

  if (kind === "xlsx") {
    const sheets = await extractXlsxSheets(bytes, {});
    const text = sheets.sheets
      .map((sheet) => tableToMarkdown(sheet.rows, `Sheet: ${sheet.name}`))
      .join("\n\n");
    const limited = limitText(text, maxChars);
    return {
      kind,
      text: limited.text,
      metadata: includeMetadata
        ? {
            sheets: sheets.sheets.map((sheet) => ({
              name: sheet.name,
              rowCount: sheet.rowCount,
              columnCount: sheet.columnCount,
            })),
          }
        : undefined,
      truncated: limited.truncated || sheets.truncated,
    };
  }

  const pdf = await extractPdf(bytes, { maxChars });
  return {
    kind,
    text: pdf.text,
    metadata: includeMetadata
      ? {
          pages: pdf.pageCount,
          pageSnippets: pdf.pages.map((page) => ({
            page: page.page,
            text: limitText(page.text, 500).text,
          })),
        }
      : undefined,
    truncated: pdf.truncated,
  };
};

export const inspectDocument = async (
  path: string,
  bytes: Uint8Array,
  options: { maxItems?: number } = {}
): Promise<InspectResult> => {
  const kind = getDocumentKind(path);
  if (!kind) {
    throw new Error(`Unsupported document type for "${path}".`);
  }

  const maxItems = positiveLimit(options.maxItems, DEFAULT_MAX_ITEMS);

  if (kind === "docx") {
    const docx = await extractDocx(bytes);
    return {
      kind,
      metadata: {
        paragraphs: docx.paragraphs.length,
        tables: docx.tables.length,
        headings: docx.headings.slice(0, maxItems),
      },
      truncated: docx.headings.length > maxItems,
    };
  }

  if (kind === "pptx") {
    const pptx = await extractPptx(bytes);
    return {
      kind,
      metadata: {
        slides: pptx.slides.length,
        slideSnippets: pptx.slides.slice(0, maxItems).map((slide) => ({
          slide: slide.number,
          title: slide.title,
          text: limitText(slide.text, 500).text,
        })),
      },
      truncated: pptx.slides.length > maxItems,
    };
  }

  if (kind === "xlsx") {
    const workbook = await inspectXlsx(bytes, maxItems);
    return {
      kind,
      metadata: workbook,
      truncated: workbook.sheets.length >= maxItems && workbook.totalSheets > maxItems,
    };
  }

  if (kind === "pdf") {
    const pdf = await extractPdf(bytes, {
      maxChars: maxItems * 500,
      maxPages: maxItems,
    });
    return {
      kind,
      metadata: {
        pages: pdf.pageCount,
        pageSnippets: pdf.pages.map((page) => ({
          page: page.page,
          text: limitText(page.text, 500).text,
        })),
      },
      truncated: pdf.truncated || pdf.pageCount > maxItems,
    };
  }

  const text = decoder.decode(bytes);
  return {
    kind,
    metadata: {
      bytes: bytes.byteLength,
      lines: text.split(/\r\n|\r|\n/).length,
      snippet: limitText(text, 1000).text,
    },
    truncated: text.length > 1000,
  };
};

export const extractSpreadsheetSheets = async (
  path: string,
  bytes: Uint8Array,
  options: { sheets?: string[]; maxRows?: number; maxCells?: number } = {}
): Promise<SpreadsheetExtractionResult> => {
  const kind = getDocumentKind(path);
  const maxRows = positiveLimit(options.maxRows, DEFAULT_MAX_ROWS);
  const maxCells = positiveLimit(options.maxCells, DEFAULT_MAX_CELLS);

  if (kind === "xlsx") {
    return extractXlsxSheets(bytes, {
      sheets: options.sheets,
      maxRows,
      maxCells,
    });
  }

  if (kind === "csv" || kind === "tsv") {
    const delimiter = kind === "tsv" ? "\t" : ",";
    const rows = parseDelimitedText(decoder.decode(bytes), delimiter, maxRows, maxCells);
    return {
      kind,
      sheets: [
        {
          name: kind.toUpperCase(),
          rows: rows.rows,
          headers: rows.rows[0],
          rowCount: rows.totalRows,
          columnCount: rows.columnCount,
          truncated: rows.truncated,
        },
      ],
      truncated: rows.truncated,
    };
  }

  throw new Error(`Unsupported spreadsheet type for "${path}".`);
};

const extractDocx = async (bytes: Uint8Array) => {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await readZipText(zip, "word/document.xml");
  const document = parseXml(documentXml);
  const paragraphs = elementsByLocalName(document, "p")
    .map((paragraph) => textFromElement(paragraph, "t").trim())
    .filter(Boolean);
  const tables = elementsByLocalName(document, "tbl").map((table) =>
    elementsByLocalName(table, "tr").map((row) =>
      elementsByLocalName(row, "tc").map((cell) => textFromElement(cell, "t").trim())
    )
  );
  const headings = elementsByLocalName(document, "p")
    .filter((paragraph) =>
      elementsByLocalName(paragraph, "pStyle").some((style) =>
        (style.getAttribute("w:val") || style.getAttribute("val") || "")
          .toLowerCase()
          .startsWith("heading")
      )
    )
    .map((paragraph) => textFromElement(paragraph, "t").trim())
    .filter(Boolean);

  return { paragraphs, tables, headings };
};

const extractPptx = async (bytes: Uint8Array) => {
  const zip = await JSZip.loadAsync(bytes);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slides = await Promise.all(
    slidePaths.map(async (path) => {
      const xml = await readZipText(zip, path);
      const document = parseXml(xml);
      const lines = elementsByLocalName(document, "t")
        .map((node) => node.textContent ?? "")
        .join("\n")
        .split(/\r\n|\r|\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return {
        number: slideNumber(path),
        title: lines[0] ?? "",
        text: lines.join("\n"),
      };
    })
  );

  return { slides };
};

const extractXlsxSheets = async (
  bytes: Uint8Array,
  options: { sheets?: string[]; maxRows?: number; maxCells?: number }
): Promise<SpreadsheetExtractionResult> => {
  const zip = await JSZip.loadAsync(bytes);
  const maxRows = positiveLimit(options.maxRows, DEFAULT_MAX_ROWS);
  const maxCells = positiveLimit(options.maxCells, DEFAULT_MAX_CELLS);
  const requestedSheets = new Set(options.sheets ?? []);
  const sharedStrings = await readSharedStrings(zip);
  const sheetRefs = await readWorkbookSheetRefs(zip);
  const selectedSheetRefs =
    requestedSheets.size > 0
      ? sheetRefs.filter((sheet) => requestedSheets.has(sheet.name))
      : sheetRefs;
  const sheets: SpreadsheetSheet[] = [];
  let remainingCells = maxCells;
  let truncated = selectedSheetRefs.length !== sheetRefs.length;

  for (const sheetRef of selectedSheetRefs) {
    if (remainingCells <= 0) {
      truncated = true;
      break;
    }
    const sheet = await readSheet(zip, sheetRef, sharedStrings, {
      maxRows,
      maxCells: remainingCells,
    });
    remainingCells -= sheet.rows.reduce((total, row) => total + row.length, 0);
    truncated = truncated || sheet.truncated === true;
    sheets.push(sheet);
  }

  return { kind: "xlsx", sheets, truncated };
};

const inspectXlsx = async (bytes: Uint8Array, maxItems: number) => {
  const zip = await JSZip.loadAsync(bytes);
  const sharedStrings = await readSharedStrings(zip);
  const sheetRefs = await readWorkbookSheetRefs(zip);
  const sheets: Array<Record<string, unknown>> = [];

  for (const sheetRef of sheetRefs.slice(0, maxItems)) {
    const sheet = await readSheet(zip, sheetRef, sharedStrings, {
      maxRows: 1,
      maxCells: 200,
    });
    sheets.push({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      headers: sheet.headers,
    });
  }

  return {
    totalSheets: sheetRefs.length,
    sheets,
  };
};

const readWorkbookSheetRefs = async (zip: JSZip): Promise<SheetRef[]> => {
  const workbookXml = await readZipText(zip, "xl/workbook.xml");
  const workbook = parseXml(workbookXml);
  const rels = await readWorkbookRelationships(zip);
  return elementsByLocalName(workbook, "sheet")
    .map((sheet) => {
      const id =
        sheet.getAttributeNS(XML_NS_REL, "id") ||
        sheet.getAttribute("r:id") ||
        sheet.getAttribute("id") ||
        "";
      const name = sheet.getAttribute("name") || `Sheet ${sheet.getAttribute("sheetId") || ""}`.trim();
      const target = rels.get(id);
      if (!target) return null;
      return {
        name,
        path: normalizeZipPath(target.startsWith("xl/") ? target : `xl/${target}`),
      };
    })
    .filter((sheet): sheet is SheetRef => sheet !== null);
};

const readWorkbookRelationships = async (zip: JSZip): Promise<Map<string, string>> => {
  const relsXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");
  const rels = parseXml(relsXml);
  const map = new Map<string, string>();
  for (const rel of elementsByLocalName(rels, "Relationship")) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) {
      map.set(id, target);
    }
  }
  return map;
};

const readSharedStrings = async (zip: JSZip): Promise<string[]> => {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) return [];
  const xml = await file.async("text");
  const document = parseXml(xml);
  return elementsByLocalName(document, "si").map((item) => textFromElement(item, "t"));
};

const readSheet = async (
  zip: JSZip,
  sheetRef: SheetRef,
  sharedStrings: string[],
  options: { maxRows: number; maxCells: number }
): Promise<SpreadsheetSheet> => {
  const xml = await readZipText(zip, sheetRef.path);
  const document = parseXml(xml);
  const rowElements = elementsByLocalName(document, "row");
  const rows: string[][] = [];
  let columnCount = 0;
  let cellsRead = 0;
  let truncated = rowElements.length > options.maxRows;

  for (const rowElement of rowElements) {
    if (rows.length >= options.maxRows || cellsRead >= options.maxCells) {
      truncated = true;
      break;
    }
    const cells = elementsByLocalName(rowElement, "c")
      .map((cell) => readXlsxCell(cell, sharedStrings))
      .filter((cell): cell is XlsxCell => cell !== null);
    if (cells.length === 0) {
      rows.push([]);
      continue;
    }

    const rowIndex = cells[0]?.row || Number(rowElement.getAttribute("r")) || rows.length + 1;
    const row: string[] = [];
    for (const cell of cells) {
      if (cellsRead >= options.maxCells) {
        truncated = true;
        break;
      }
      row[cell.col - 1] = cell.value;
      columnCount = Math.max(columnCount, cell.col);
      cellsRead += 1;
    }
    while (rows.length < rowIndex - 1 && rows.length < options.maxRows) {
      rows.push([]);
    }
    rows.push(row.map((value) => value ?? ""));
  }

  return {
    name: sheetRef.name,
    rows,
    headers: rows[0],
    rowCount: rowElements.length,
    columnCount,
    truncated,
  };
};

const readXlsxCell = (cell: Element, sharedStrings: string[]): XlsxCell | null => {
  const ref = cell.getAttribute("r") || undefined;
  const position = ref ? parseCellRef(ref) : undefined;
  const row = position?.row ?? 1;
  const col = position?.col ?? 1;
  const type = cell.getAttribute("t");
  let value = "";

  if (type === "inlineStr") {
    value = textFromElement(cell, "t");
  } else {
    const raw = firstTextByLocalName(cell, "v");
    if (raw == null) return null;
    if (type === "s") {
      value = sharedStrings[Number(raw)] ?? raw;
    } else if (type === "b") {
      value = raw === "1" ? "TRUE" : "FALSE";
    } else {
      value = raw;
    }
  }

  return { ref, value, row, col };
};

const extractPdf = async (
  bytes: Uint8Array,
  options: { maxChars: number; maxPages?: number }
) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({
    data: bytes.slice().buffer,
    useWorkerFetch: false,
  });
  const pdf = await task.promise;
  const pages: Array<{ page: number; text: string }> = [];
  let text = "";
  let truncated = false;
  const pageLimit = Math.min(pdf.numPages, options.maxPages ?? pdf.numPages);

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page: pageNumber, text: pageText });
    const nextText = [text, `Page ${pageNumber}\n${pageText}`].filter(Boolean).join("\n\n");
    if (nextText.length > options.maxChars) {
      text = limitText(nextText, options.maxChars).text;
      truncated = true;
      break;
    }
    text = nextText;
  }

  return {
    pageCount: pdf.numPages,
    pages,
    text,
    truncated: truncated || pageLimit < pdf.numPages,
  };
};

const parseDelimitedText = (
  text: string,
  delimiter: "," | "\t",
  maxRows: number,
  maxCells: number
) => {
  const parsedRows: string[][] = [];
  const lines = text.split(/\r\n|\r|\n/);
  let cellsRead = 0;
  let columnCount = 0;
  let truncated = lines.length > maxRows;

  for (const line of lines) {
    if (parsedRows.length >= maxRows || cellsRead >= maxCells) {
      truncated = true;
      break;
    }
    const row = delimiter === "," ? parseCsvLine(line) : line.split("\t");
    const remainingCells = maxCells - cellsRead;
    const limitedRow = row.slice(0, remainingCells);
    cellsRead += limitedRow.length;
    columnCount = Math.max(columnCount, limitedRow.length);
    parsedRows.push(limitedRow);
    if (limitedRow.length < row.length) {
      truncated = true;
      break;
    }
  }

  return {
    rows: parsedRows,
    totalRows: lines.length,
    columnCount,
    truncated,
  };
};

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
};

const tableToMarkdown = (rows: string[][], title?: string): string => {
  if (rows.length === 0) return title ?? "";
  const normalizedRows = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
  const header = normalizedRows[0] ?? [];
  const body = normalizedRows.slice(1);
  const table = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
  return title ? `${title}\n${table}` : table;
};

const textFromElement = (element: ParentNode, localName: string): string =>
  elementsByLocalName(element, localName)
    .map((node) => node.textContent ?? "")
    .join("");

const firstTextByLocalName = (element: ParentNode, localName: string): string | null =>
  elementsByLocalName(element, localName)[0]?.textContent ?? null;

const elementsByLocalName = (root: ParentNode, localName: string): Element[] => {
  const all = root instanceof Document ? root.getElementsByTagName("*") : root.querySelectorAll("*");
  return Array.from(all).filter((element) => element.localName === localName);
};

const parseXml = (xml: string): Document => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = document.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error(parserError.textContent || "Failed to parse document XML.");
  }
  return document;
};

const readZipText = async (zip: JSZip, path: string): Promise<string> => {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`Missing required OOXML part: ${path}`);
  }
  return file.async("text");
};

const normalizeZipPath = (path: string): string => path.replace(/^\/+/, "").replace(/\\/g, "/");

const slideNumber = (path: string): number => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);

const parseCellRef = (ref: string): { row: number; col: number } => {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!match) return { row: 1, col: 1 };
  const letters = match[1].toUpperCase();
  let col = 0;
  for (const letter of letters) {
    col = col * 26 + letter.charCodeAt(0) - 64;
  }
  return { row: Number(match[2]), col };
};

const limitText = (text: string, maxChars: number): { text: string; truncated: boolean } => {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxChars), truncated: true };
};

const positiveLimit = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value) || value == null || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
};
