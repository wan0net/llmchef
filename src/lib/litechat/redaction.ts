const SECRET_VALUE = "[REDACTED]";

const SECRET_ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|token|access[_-]?token|refresh[_-]?token|authorization|bearer|password|passwd|secret|client[_-]?secret)\b(\s*[:=]\s*)(["']?)([^"'\s,;}\]]{8,})(["']?)/gi;

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const BASIC_AUTH_URL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/gi;

const TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g,
];

export function redactSecrets(value: unknown): string {
  const text = value instanceof Error
    ? [value.name, value.message, value.stack].filter(Boolean).join("\n")
    : typeof value === "string"
      ? value
      : safeStringify(value);

  return TOKEN_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, SECRET_VALUE),
    text
      .replace(BEARER_PATTERN, `Bearer ${SECRET_VALUE}`)
      .replace(BASIC_AUTH_URL_PATTERN, `$1$2:${SECRET_VALUE}@`)
      .replace(
        SECRET_ASSIGNMENT_PATTERN,
        (_match, key: string, separator: string, quoteStart: string) =>
          `${key}${separator}${quoteStart}${SECRET_VALUE}${quoteStart}`
      )
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
