import { describe, expect, it, beforeEach } from "vitest";
import {
  assertAllowedOutboundUrl,
  clearOutboundRequestLog,
  getOutboundHost,
  getOutboundRequestLog,
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
});
