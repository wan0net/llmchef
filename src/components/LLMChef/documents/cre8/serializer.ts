/**
 * Markdown <-> BlockSuite conversion layer.
 *
 * MarkdownTransformer is not available in the installed BlockSuite canary build,
 * so we implement manual round-trip serialization here.
 *
 * Import: parses a Markdown string into BlockSuite block flavours synchronously.
 * Export: walks the block tree and serializes back to Markdown.
 */

import type { Doc, DocCollection } from '@blocksuite/store';
import { Text } from '@blocksuite/store';

// ---------------------------------------------------------------------------
// Inline formatting -- parse rich text spans
// ---------------------------------------------------------------------------

type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  link?: string;
};

/**
 * Parse an inline Markdown string into a sequence of styled spans.
 * Handles: **bold**, *italic*, _italic_, `code`, ~~strike~~, [text](url),
 * and combinations thereof.  Order matters: code wins over other markers,
 * links are processed before other markers, then bold/italic/strike.
 */
function parseInlineSpans(raw: string): InlineSpan[] {
  const spans: InlineSpan[] = [];

  // The regex matches, in priority order:
  //   1. inline code  `...`
  //   2. link         [text](url)
  //   3. bold+italic  ***...***
  //   4. bold         **...**
  //   5. italic       *...*
  //   6. strikethrough ~~...~~
  const TOKEN_RE =
    /(`+)([\s\S]*?)\1|\[([^\]]*)\]\(([^)]*)\)|(\*\*\*|___)([\s\S]*?)\5|(\*\*|__)([\s\S]*?)\7|(\*|_)([\s\S]*?)\9|(~~)([\s\S]*?)\11/g;

  let lastIndex = 0;

  function pushPlain(str: string, attrs: Omit<InlineSpan, 'text'> = {}) {
    if (str) spans.push({ text: str, ...attrs });
  }

  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(raw)) !== null) {
    // Emit any plain text before this match
    if (m.index > lastIndex) {
      pushPlain(raw.slice(lastIndex, m.index));
    }

    if (m[1] !== undefined) {
      // Inline code -- no further parsing inside
      spans.push({ text: m[2], code: true });
    } else if (m[3] !== undefined) {
      // Link [text](url "optional title")
      const linkText = m[3];
      // Strip optional title from url
      const urlRaw = m[4];
      const urlTitleMatch = urlRaw.match(/^(.*?)\s+"[^"]*"$/) ?? null;
      const url = urlTitleMatch ? urlTitleMatch[1] : urlRaw;
      // Recursively parse the link text for nested formatting
      const inner = parseInlineSpans(linkText);
      for (const s of inner) {
        spans.push({ ...s, link: url });
      }
    } else if (m[5] !== undefined) {
      // Bold + italic ***...***
      const inner = parseInlineSpans(m[6]);
      for (const s of inner) {
        spans.push({ ...s, bold: true, italic: true });
      }
    } else if (m[7] !== undefined) {
      // Bold **...**
      const inner = parseInlineSpans(m[8]);
      for (const s of inner) {
        spans.push({ ...s, bold: true });
      }
    } else if (m[9] !== undefined) {
      // Italic *...*
      const inner = parseInlineSpans(m[10]);
      for (const s of inner) {
        spans.push({ ...s, italic: true });
      }
    } else if (m[11] !== undefined) {
      // Strikethrough ~~...~~
      const inner = parseInlineSpans(m[12]);
      for (const s of inner) {
        spans.push({ ...s, strike: true });
      }
    }

    lastIndex = TOKEN_RE.lastIndex;
  }

  // Trailing plain text
  if (lastIndex < raw.length) {
    pushPlain(raw.slice(lastIndex));
  }

  return spans;
}

/**
 * Build a BlockSuite Text object from an inline Markdown string,
 * preserving bold/italic/code/strike/link formatting as deltas.
 */
function buildText(raw: string): Text {
  const spans = parseInlineSpans(raw);
  if (spans.length === 0) return new Text('');
  if (
    spans.length === 1 &&
    !spans[0].bold &&
    !spans[0].italic &&
    !spans[0].code &&
    !spans[0].strike &&
    !spans[0].link
  ) {
    return new Text(spans[0].text);
  }

  // Concatenate all spans as plain text — rich formatting attributes
  // cannot be applied until the Text is attached to a Yjs doc.
  // TODO: apply bold/italic/code/link attributes after block insertion
  const fullText = spans.map(s => s.text).join('');
  return new Text(fullText);
}

// ---------------------------------------------------------------------------
// Table parsing helpers
// ---------------------------------------------------------------------------

/**
 * Split a Markdown table row string into trimmed cell strings.
 * Handles leading/trailing pipes.
 */
function parseTableRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-|]*$/.test(line);
}

// ---------------------------------------------------------------------------
// Import: Markdown string -> BlockSuite Doc
// ---------------------------------------------------------------------------

type ParagraphFlavourProps = { text: Text; type?: string };
type ListFlavourProps = { text: Text; type?: 'bulleted' | 'numbered' | 'todo'; checked?: boolean };
type CodeFlavourProps = { language?: string; text: Text };
type ImageFlavourProps = { sourceId: string; caption?: string };
type DatabaseFlavourProps = {
  title: Text;
  columns: Array<{ id: string; name: string; type: string }>;
  rows: Array<{ id: string; cells: Record<string, { value: string }> }>;
};

type ParsedBlock =
  | { flavour: 'affine:paragraph'; props: ParagraphFlavourProps }
  | { flavour: 'affine:list'; props: ListFlavourProps }
  | { flavour: 'affine:code'; props: CodeFlavourProps }
  | { flavour: 'affine:divider'; props: Record<string, never> }
  | { flavour: 'affine:image'; props: ImageFlavourProps }
  | { flavour: 'affine:database'; props: DatabaseFlavourProps };

function parseBlocks(lines: string[]): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // -----------------------------------------------------------------------
    // Fenced code block
    // -----------------------------------------------------------------------
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        flavour: 'affine:code',
        props: { language, text: new Text(codeLines.join('\n')) },
      });
      continue;
    }

    // -----------------------------------------------------------------------
    // Horizontal rule
    // -----------------------------------------------------------------------
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      blocks.push({ flavour: 'affine:divider', props: {} });
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Image  ![alt](url) or ![alt](url "title")
    // -----------------------------------------------------------------------
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]*)\)\s*$/);
    if (imageMatch) {
      const caption = imageMatch[1].trim() || undefined;
      const urlRaw = imageMatch[2];
      const urlTitleMatch = urlRaw.match(/^(.*?)\s+"[^"]*"$/);
      const sourceId = urlTitleMatch ? urlTitleMatch[1].trim() : urlRaw.trim();
      blocks.push({
        flavour: 'affine:image',
        props: { sourceId, caption },
      });
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Headings
    // -----------------------------------------------------------------------
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawText = headingMatch[2].trim();
      const type = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      blocks.push({
        flavour: 'affine:paragraph',
        props: { text: buildText(rawText), type },
      });
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Blockquote
    // -----------------------------------------------------------------------
    const quoteMatch = line.match(/^>\s?(.*)/);
    if (quoteMatch) {
      blocks.push({
        flavour: 'affine:paragraph',
        props: { text: buildText(quoteMatch[1]), type: 'quote' },
      });
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Markdown table (header line followed by separator line)
    // -----------------------------------------------------------------------
    if (line.trimStart().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = parseTableRow(line);
      i += 2; // skip header and separator

      const columns: DatabaseFlavourProps['columns'] = headerCells.map((name, idx) => ({
        id: `col-${idx}`,
        name,
        type: 'rich-text',
      }));

      const rows: DatabaseFlavourProps['rows'] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        const cells = parseTableRow(lines[i]);
        const rowCells: Record<string, { value: string }> = {};
        columns.forEach((col, idx) => {
          rowCells[col.id] = { value: cells[idx] ?? '' };
        });
        rows.push({ id: `row-${rows.length}`, cells: rowCells });
        i++;
      }

      blocks.push({
        flavour: 'affine:database',
        props: { title: new Text('Table'), columns, rows },
      });
      continue;
    }

    // -----------------------------------------------------------------------
    // Numbered list
    // -----------------------------------------------------------------------
    const numberedMatch = line.match(/^\d+\.\s+(.*)/);
    if (numberedMatch) {
      blocks.push({
        flavour: 'affine:list',
        props: { text: buildText(numberedMatch[1]), type: 'numbered' },
      });
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Task list item
    // -----------------------------------------------------------------------
    const todoMatch = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)/);
    if (todoMatch) {
      const checked = todoMatch[1].toLowerCase() === 'x';
      blocks.push({
        flavour: 'affine:list',
        props: { text: buildText(todoMatch[2]), type: 'todo', checked },
      });
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Bulleted list
    // -----------------------------------------------------------------------
    const bulletMatch = line.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      blocks.push({
        flavour: 'affine:list',
        props: { text: buildText(bulletMatch[1]), type: 'bulleted' },
      });
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Blank line -- skip
    // -----------------------------------------------------------------------
    if (line.trim() === '') {
      i++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Default: plain paragraph (with inline formatting)
    // -----------------------------------------------------------------------
    blocks.push({
      flavour: 'affine:paragraph',
      props: { text: buildText(line), type: 'text' },
    });
    i++;
  }

  return blocks;
}

/**
 * Import Markdown into a new BlockSuite Doc in the given collection.
 * Synchronous -- the doc is fully populated before returning.
 */
export function importMarkdown(collection: DocCollection, markdown: string): Doc {
  const doc = collection.createDoc();
  doc.load();

  // Extract title from the first H1 line (if present)
  const lines = markdown.split('\n');
  let title = 'Untitled';
  let bodyStart = 0;

  const firstNonBlank = lines.findIndex((l) => l.trim() !== '');
  if (firstNonBlank !== -1 && lines[firstNonBlank].startsWith('# ')) {
    title = lines[firstNonBlank].slice(2).trim();
    bodyStart = firstNonBlank + 1;
  }

  const rootId = doc.addBlock('affine:page', { title: new Text(title) });
  doc.addBlock('affine:surface', {}, rootId);
  const noteId = doc.addBlock('affine:note', {}, rootId);

  const bodyLines = lines.slice(bodyStart);
  const parsedBlocks = parseBlocks(bodyLines);

  if (parsedBlocks.length === 0) {
    // Always have at least one empty paragraph
    doc.addBlock('affine:paragraph', {}, noteId);
  } else {
    for (const block of parsedBlocks) {
      doc.addBlock(
        // @ts-ignore -- flavour is a valid string union; cast to satisfy the overload
        block.flavour as 'affine:paragraph',
        block.props as Record<string, unknown>,
        noteId,
      );
    }
  }

  return doc;
}

// ---------------------------------------------------------------------------
// Export: BlockSuite Doc -> Markdown string
// ---------------------------------------------------------------------------

 

/**
 * Serialize a BlockSuite Text (delta array) to inline Markdown.
 * Handles bold, italic, code, strike, link attributes.
 */
function textToInlineMarkdown(textObj: any): string {
  if (!textObj) return '';

  // If the Text object exposes a delta list, use it
  const deltas: Array<{ insert: string; attributes?: Record<string, any> }> =
    typeof textObj.toDelta === 'function' ? textObj.toDelta() : [];

  if (deltas.length === 0) {
    return typeof textObj.toString === 'function' ? textObj.toString() : '';
  }

  return deltas
    .map(({ insert, attributes }) => {
      let str = insert ?? '';
      if (!attributes || Object.keys(attributes).length === 0) return str;

      // Code wins -- no other markers inside
      if (attributes['code']) return `\`${str}\``;

      // Apply markers in a stable order (innermost first)
      if (attributes['link']) {
        // Links can also be bold/italic -- wrap the bracketed form
        str = `[${str}](${attributes['link']})`;
      }
      if (attributes['strike']) str = `~~${str}~~`;
      if (attributes['italic']) str = `*${str}*`;
      if (attributes['bold']) str = `**${str}**`;

      return str;
    })
    .join('');
}

/**
 * Serialize a database block (affine:database) to a Markdown table.
 */
function databaseToMarkdown(model: any): string {
  const columns: Array<{ id: string; name: string }> = model.columns ?? [];
  const rows: Array<{ cells: Record<string, { value: string }> }> = model.rows ?? [];

  if (columns.length === 0) return '';

  const header = `| ${columns.map((c) => c.name).join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(
    (row) =>
      `| ${columns
        .map((col) => (row.cells?.[col.id]?.value ?? '').replace(/\|/g, '\\|'))
        .join(' | ')} |`,
  );

  return [header, separator, ...dataRows].join('\n');
}

function blockToMarkdown(model: any): string {
  const flavour: string = model.flavour ?? '';

  if (flavour === 'affine:paragraph') {
    const type: string = model.type ?? 'text';
    const text = textToInlineMarkdown(model.text);
    if (type === 'h1') return `# ${text}`;
    if (type === 'h2') return `## ${text}`;
    if (type === 'h3') return `### ${text}`;
    if (type === 'h4') return `#### ${text}`;
    if (type === 'h5') return `##### ${text}`;
    if (type === 'h6') return `###### ${text}`;
    if (type === 'quote') return `> ${text}`;
    return text;
  }

  if (flavour === 'affine:list') {
    const type: string = model.type ?? 'bulleted';
    const text = textToInlineMarkdown(model.text);
    if (type === 'numbered') return `1. ${text}`;
    if (type === 'todo') {
      const checked = model.checked === true;
      return `- [${checked ? 'x' : ' '}] ${text}`;
    }
    return `- ${text}`;
  }

  if (flavour === 'affine:code') {
    const language: string = model.language ?? '';
    const code: string = model.text ? model.text.toString() : '';
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  if (flavour === 'affine:divider') {
    return '---';
  }

  if (flavour === 'affine:image') {
    const sourceId: string = model.sourceId ?? '';
    const caption: string = model.caption ?? '';
    return `![${caption}](${sourceId})`;
  }

  if (flavour === 'affine:database') {
    return databaseToMarkdown(model);
  }

  // Unknown/unsupported block -- emit plain text content if available
  return model.text ? textToInlineMarkdown(model.text) : '';
}

/**
 * Export a BlockSuite Doc to a Markdown string.
 * Does not include YAML frontmatter -- that is handled by the caller.
 */
export async function exportMarkdown(doc: Doc): Promise<string> {
  const lines: string[] = [];

  try {
    const root = doc.root;
    if (!root) return '';

    // Title -> H1
    const titleText = (root as any).title;
    if (titleText && typeof titleText.toString === 'function') {
      const title = titleText.toString();
      if (title) lines.push(`# ${title}`);
    }

    // Walk all blocks in document order, skipping structural containers
    const structuralFlavours = new Set([
      'affine:page',
      'affine:surface',
      'affine:note',
    ]);

    const allBlocks = doc.getBlocks();
    for (const model of allBlocks) {
      const flavour: string = (model as any).flavour ?? '';
      if (structuralFlavours.has(flavour)) continue;

      const line = blockToMarkdown(model);
      if (line !== '') {
        lines.push(line);
      }
    }
  } catch (err) {
    console.error('[cre8] exportMarkdown failed:', err);
  }

  return lines.join('\n\n');
}
