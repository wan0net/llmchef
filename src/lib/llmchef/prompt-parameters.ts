export type PromptParameters = Record<string, any>;

export const cleanPromptParameters = (
  parameters: PromptParameters
): PromptParameters => {
  const cleaned: PromptParameters = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }

  if ("temperature" in cleaned && "top_p" in cleaned) {
    delete cleaned.top_p;
  }

  return cleaned;
};
