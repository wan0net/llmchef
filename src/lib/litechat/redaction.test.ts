import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redaction";

describe("redactSecrets", () => {
  it("redacts common token and API key shapes", () => {
    const redacted = redactSecrets(
      'apiKey="sk-abcdefghijklmnopqrstuvwxyz123456" Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456'
    );

    expect(redacted).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).toContain("[REDACTED]");
  });

  it("redacts GitHub tokens and credentialed URLs", () => {
    const redacted = redactSecrets(
      "https://icd:ghp_abcdefghijklmnopqrstuvwxyz123456@github.com/wan0net/llmchef.git"
    );

    expect(redacted).toBe(
      "https://icd:[REDACTED]@github.com/wan0net/llmchef.git"
    );
  });
});
