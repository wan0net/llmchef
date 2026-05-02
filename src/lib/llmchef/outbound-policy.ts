export interface OutboundRequestRecord {
  url: string;
  host: string;
  purpose: string;
  timestamp: string;
}

const MAX_OUTBOUND_LOG_ENTRIES = 200;
const outboundRequestLog: OutboundRequestRecord[] = [];
const outboundLogListeners = new Set<() => void>();

const notifyOutboundLogListeners = (): void => {
  outboundLogListeners.forEach((listener) => listener());
};

const parseHttpUrl = (url: string): URL => {
  const parsed = new URL(url, globalThis.location?.origin ?? "http://localhost");
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Blocked non-HTTP outbound URL: ${parsed.protocol}`);
  }
  return parsed;
};

export const getOutboundHost = (url: string): string => parseHttpUrl(url).host;

const hostMatchesAllowed = (host: string, allowedHost: string): boolean =>
  host === allowedHost || host.endsWith(`.${allowedHost}`);

export const isOutboundHostAllowed = (
  host: string,
  allowedHosts: readonly string[],
): boolean => allowedHosts.some((allowedHost) => hostMatchesAllowed(host, allowedHost));

export const recordOutboundRequest = (
  url: string,
  purpose: string,
): OutboundRequestRecord => {
  const parsed = parseHttpUrl(url);
  const record: OutboundRequestRecord = {
    url: parsed.toString(),
    host: parsed.host,
    purpose,
    timestamp: new Date().toISOString(),
  };

  outboundRequestLog.unshift(record);
  if (outboundRequestLog.length > MAX_OUTBOUND_LOG_ENTRIES) {
    outboundRequestLog.length = MAX_OUTBOUND_LOG_ENTRIES;
  }

  notifyOutboundLogListeners();
  return record;
};

export const assertAllowedOutboundUrl = (
  url: string,
  purpose: string,
  allowedHosts?: readonly string[],
): string => {
  const parsed = parseHttpUrl(url);
  if (allowedHosts?.length && !isOutboundHostAllowed(parsed.host, allowedHosts)) {
    throw new Error(
      `Blocked outbound request for ${purpose}: ${parsed.host} is not in the allowed host list.`,
    );
  }
  recordOutboundRequest(parsed.toString(), purpose);
  return parsed.toString();
};

export const getOutboundRequestLog = (): OutboundRequestRecord[] => [
  ...outboundRequestLog,
];

export const clearOutboundRequestLog = (): void => {
  outboundRequestLog.length = 0;
  notifyOutboundLogListeners();
};

export const subscribeOutboundRequestLog = (
  listener: () => void,
): (() => void) => {
  outboundLogListeners.add(listener);
  return () => {
    outboundLogListeners.delete(listener);
  };
};
