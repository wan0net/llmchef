import { redactSecrets } from "./redaction";

export interface McpPackageImportDraft {
  name: string;
  packageName: string;
  command: "npx" | "npm exec";
  args: string[];
  envKeys: string[];
  source: "command" | "json";
  sourceLabel?: string;
  endpointUrl?: string;
  warnings: string[];
}

export interface McpHttpServerDraft {
  name: string;
  url: string;
  headers?: Record<string, string>;
  description?: string;
}

export interface McpImportParseResult {
  packageImports: McpPackageImportDraft[];
  serverDrafts: McpHttpServerDraft[];
  warnings: string[];
}

const HTTP_URL_PATTERN = /^https?:\/\//i;
const SECRET_KEY_PATTERN = /\b(token|secret|password|api[_-]?key|authorization|bearer|client[_-]?secret)\b/i;

export const parseMcpImportInput = (input: string): McpImportParseResult => {
  const text = input.trim();
  if (!text) {
    throw new Error("Paste an npx/npm exec command or MCP JSON config first.");
  }

  const jsonResult = parseJsonConfig(text);
  if (jsonResult) return jsonResult;

  const commandDraft = parseCommand(text);
  if (commandDraft) {
    return {
      packageImports: [commandDraft],
      serverDrafts: draftServerFromEndpoint(commandDraft),
      warnings: commandDraft.warnings,
    };
  }

  throw new Error("Only npx/npm exec snippets and JSON MCP configs can be imported.");
};

const parseJsonConfig = (text: string): McpImportParseResult | null => {
  if (!text.startsWith("{")) return null;

  const parsed = JSON.parse(text);
  const servers = parsed?.mcpServers && typeof parsed.mcpServers === "object"
    ? parsed.mcpServers
    : parsed;

  if (!servers || typeof servers !== "object" || Array.isArray(servers)) {
    throw new Error("MCP JSON config must be an object.");
  }

  const result: McpImportParseResult = {
    packageImports: [],
    serverDrafts: [],
    warnings: [],
  };

  for (const [name, rawConfig] of Object.entries(servers)) {
    if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
      result.warnings.push(`Skipped ${name}: server config must be an object.`);
      continue;
    }

    const config = rawConfig as Record<string, unknown>;
    const url = typeof config.url === "string" ? config.url.trim() : "";
    if (HTTP_URL_PATTERN.test(url)) {
      result.serverDrafts.push({
        name,
        url,
        headers: normalizeStringRecord(config.headers),
        description: `Imported HTTP MCP endpoint from ${name}.`,
      });
      continue;
    }

    const command = String(config.command ?? "").trim();
    const args = Array.isArray(config.args) ? config.args.map(String) : [];
    const commandLine = [command, ...args].filter(Boolean).join(" ");
    const draft = parseCommand(commandLine, name, normalizeEnvKeys(config.env));
    if (draft) {
      draft.source = "json";
      draft.sourceLabel = name;
      result.packageImports.push(draft);
      result.serverDrafts.push(...draftServerFromEndpoint(draft));
      result.warnings.push(...draft.warnings);
    } else {
      result.warnings.push(`Skipped ${name}: only HTTP URLs and npx/npm exec package configs are supported.`);
    }
  }

  if (result.packageImports.length === 0 && result.serverDrafts.length === 0) {
    throw new Error("No supported MCP entries found.");
  }

  return result;
};

const parseCommand = (
  commandText: string,
  sourceLabel?: string,
  envKeys: string[] = [],
): McpPackageImportDraft | null => {
  const tokens = tokenizeCommand(commandText);
  if (tokens.length === 0) return null;

  const first = stripCommandPath(tokens[0]);
  const isNpx = first === "npx";
  const isNpmExec = first === "npm" && tokens[1] === "exec";
  if (!isNpx && !isNpmExec) return null;

  const command: "npx" | "npm exec" = isNpx ? "npx" : "npm exec";
  const startIndex = isNpx ? 1 : 2;
  const packageIndex = findPackageTokenIndex(tokens, startIndex);
  if (packageIndex === -1) {
    throw new Error(`${command} import is missing a package name.`);
  }

  const packageName = tokens[packageIndex].replace(/^--package=/, "");
  const args = tokens.slice(packageIndex + 1);
  const endpointUrl = tokens.find((token) => HTTP_URL_PATTERN.test(token));
  const warnings = [
    "Imported as package metadata only. LLMChef will not execute this command.",
  ];

  if (envKeys.some((key) => SECRET_KEY_PATTERN.test(key))) {
    warnings.push("Environment values were not imported; only variable names were kept for review.");
  }

  return {
    name: sourceLabel || packageNameToName(packageName),
    packageName,
    command,
    args: args.map((arg) => redactSecrets(arg)),
    envKeys,
    source: "command",
    sourceLabel,
    endpointUrl,
    warnings,
  };
};

const tokenizeCommand = (input: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (quote) throw new Error("Command contains an unterminated quote.");
  if (escaped) current += "\\";
  if (current) tokens.push(current);
  return tokens;
};

const findPackageTokenIndex = (tokens: string[], startIndex: number): number => {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--") continue;
    if (token === "-y" || token === "--yes") continue;
    if (token === "-q" || token === "--quiet") continue;
    if (token === "--package" || token === "-p") {
      return index + 1 < tokens.length ? index + 1 : -1;
    }
    if (token.startsWith("--package=")) return index;
    if (token.startsWith("-")) continue;
    return index;
  }
  return -1;
};

const stripCommandPath = (value: string): string => {
  const normalized = value.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
};

const packageNameToName = (packageName: string): string =>
  packageName
    .replace(/^--package=/, "")
    .replace(/^@/, "")
    .replace(/\//g, " / ")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeEnvKeys = (value: unknown): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).sort();
};

const normalizeStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const draftServerFromEndpoint = (draft: McpPackageImportDraft): McpHttpServerDraft[] => {
  if (!draft.endpointUrl || !HTTP_URL_PATTERN.test(draft.endpointUrl)) return [];
  return [{
    name: draft.name,
    url: draft.endpointUrl,
    description: `Imported from ${draft.command} package ${draft.packageName}. Review before enabling.`,
  }];
};
