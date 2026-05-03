import { describe, expect, it, beforeEach } from "vitest";
import {
  assertAllowedOutboundUrl,
  clearOutboundRequestLog,
  getOutboundHost,
  getOutboundRequestLog,
  isOutboundHostAllowed,
  subscribeOutboundRequestLog,
} from "./outbound-policy";

describe("outbound-policy", () => {
  beforeEach(() => {
    clearOutboundRequestLog();
  });

  it("allows and records HTTP(S) requests to allowed hosts", () => {
    const url = assertAllowedOutboundUrl(
      "https://api.openai.com/v1/models",
      "model-list",
      ["api.openai.com"],
    );

    expect(url).toBe("https://api.openai.com/v1/models");
    expect(getOutboundRequestLog()).toMatchObject([
      { host: "api.openai.com", purpose: "model-list" },
    ]);
  });

  it("blocks requests to hosts outside the allowlist", () => {
    expect(() =>
      assertAllowedOutboundUrl(
        "https://example.com/collect",
        "model-list",
        ["api.openai.com"],
      ),
    ).toThrow(/not in the allowed host list/);
    expect(getOutboundRequestLog()).toHaveLength(0);
  });

  it("blocks non-HTTP protocols", () => {
    expect(() => getOutboundHost("file:///etc/passwd")).toThrow(
      /Blocked non-HTTP outbound URL/,
    );
  });

  it("allows exact hosts and subdomains", () => {
    expect(isOutboundHostAllowed("api.openai.com", ["api.openai.com"])).toBe(true);
    expect(isOutboundHostAllowed("queue.fal.run", ["fal.run"])).toBe(true);
    expect(isOutboundHostAllowed("evilfal.run", ["fal.run"])).toBe(false);
  });

  it("notifies subscribers when the log changes", () => {
    let notifications = 0;
    const unsubscribe = subscribeOutboundRequestLog(() => {
      notifications += 1;
    });

    assertAllowedOutboundUrl("https://api.openai.com/v1/models", "model-list");
    clearOutboundRequestLog();
    unsubscribe();
    assertAllowedOutboundUrl("https://api.openai.com/v1/models", "model-list");

    expect(notifications).toBe(2);
  });

  it("keeps the log snapshot stable between changes", () => {
    const emptySnapshot = getOutboundRequestLog();

    expect(getOutboundRequestLog()).toBe(emptySnapshot);

    assertAllowedOutboundUrl("https://api.openai.com/v1/models", "model-list");
    const populatedSnapshot = getOutboundRequestLog();

    expect(populatedSnapshot).not.toBe(emptySnapshot);
    expect(getOutboundRequestLog()).toBe(populatedSnapshot);
  });
});
