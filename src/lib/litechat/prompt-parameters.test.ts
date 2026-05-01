import { describe, expect, it } from "vitest";
import { cleanPromptParameters } from "./prompt-parameters";

describe("cleanPromptParameters", () => {
  it("removes null and undefined values", () => {
    expect(
      cleanPromptParameters({
        temperature: null,
        max_tokens: undefined,
        top_k: 40,
      })
    ).toEqual({ top_k: 40 });
  });

  it("drops top_p when temperature is also present", () => {
    expect(
      cleanPromptParameters({
        temperature: 0.7,
        top_p: 0.9,
      })
    ).toEqual({ temperature: 0.7 });
  });

  it("keeps top_p when temperature is disabled", () => {
    expect(
      cleanPromptParameters({
        temperature: null,
        top_p: 0.9,
      })
    ).toEqual({ top_p: 0.9 });
  });
});
