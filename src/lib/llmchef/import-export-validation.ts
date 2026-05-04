import { nanoid } from "nanoid";
import { z } from "zod";

const dateLike = z.union([z.string(), z.number(), z.date()]).optional().nullable();

const promptTemplateSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().optional(),
  parentId: z.string().min(1).optional().nullable(),
  name: z.string().min(1),
  createdAt: dateLike,
  updatedAt: dateLike,
}).passthrough();

const workflowSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  metadata: z.unknown().optional(),
}).passthrough();

const interactionSchema = z.object({
  id: z.string().optional(),
  index: z.number(),
}).passthrough();

const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
}).passthrough();

const taggedEntitySchema = z.object({ id: z.string().min(1) }).passthrough();

export const promptTemplatesBundleSchema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().optional(),
  promptTemplates: z.array(promptTemplateSchema.refine((template) => !template.type || template.type === "prompt", {
    message: "Prompt template imports may only contain regular prompt templates.",
  })),
});

export const agentsBundleSchema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().optional(),
  agents: z.array(promptTemplateSchema.refine((template) => template.type === "agent" || template.type === "task", {
    message: "Agent imports may only contain agent and task templates.",
  })),
}).superRefine((value, ctx) => {
  const agentIds = new Set(value.agents.filter((template) => template.type === "agent").map((template) => template.id).filter(Boolean));
  value.agents.forEach((template, index) => {
    if (template.type === "task" && template.parentId && !agentIds.has(template.parentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Task ${template.name} references missing agent ${template.parentId}.`,
        path: ["agents", index, "parentId"],
      });
    }
  });
});

export const mcpServersBundleSchema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().optional(),
  mcpServers: z.array(z.unknown()),
});

export const workflowsBundleSchema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().optional(),
  workflows: z.array(workflowSchema),
});

export const conversationImportSchema = z.object({
  conversation: conversationSchema,
  interactions: z.array(interactionSchema),
});

export const fullExportDataSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  settings: z.record(z.string(), z.unknown()).optional(),
  apiKeys: z.array(taggedEntitySchema).optional(),
  providerConfigs: z.array(taggedEntitySchema).optional(),
  projects: z.array(projectSchema).optional(),
  conversations: z.array(conversationSchema).optional(),
  interactions: z.array(interactionSchema).optional(),
  rules: z.array(taggedEntitySchema).optional(),
  tags: z.array(taggedEntitySchema).optional(),
  tagRuleLinks: z.array(z.object({ tagId: z.string(), ruleId: z.string() }).passthrough()).optional(),
  mods: z.array(taggedEntitySchema).optional(),
  syncRepos: z.array(taggedEntitySchema).optional(),
  mcpServers: z.array(z.unknown()).optional(),
  promptTemplates: z.array(promptTemplateSchema).optional(),
  agents: z.array(promptTemplateSchema).optional(),
  workflows: z.array(workflowSchema).optional(),
  skills: z.array(taggedEntitySchema).optional(),
  crea8MemoryProposals: z.array(taggedEntitySchema).optional(),
});

export function normalizeImportedPromptTemplates<T extends z.infer<typeof promptTemplateSchema>>(templates: T[]): T[] {
  return templates.map((template) => ({
    ...template,
    id: template.id || nanoid(),
    createdAt: template.createdAt ?? new Date().toISOString(),
    updatedAt: template.updatedAt ?? new Date().toISOString(),
  }));
}

export function normalizeImportedAgentTemplates<T extends z.infer<typeof promptTemplateSchema>>(templates: T[]): T[] {
  const idMap = new Map<string, string>();
  for (const template of templates) {
    if (template.id) {
      idMap.set(template.id, template.id);
    }
  }

  for (const template of templates) {
    if (!template.id) {
      const syntheticKey = `${template.type ?? "template"}:${template.name}:${idMap.size}`;
      idMap.set(syntheticKey, nanoid());
      (template as T & { id: string }).id = idMap.get(syntheticKey)!;
    }
  }

  const agentIdSet = new Set<string>();
  for (const template of templates) {
    if (template.type === "agent" && template.id) {
      agentIdSet.add(template.id);
    }
  }

  return templates.map((template) => {
    const normalizedId = template.id!;
    const normalizedParentId = template.type === "task" && template.parentId
      ? idMap.get(template.parentId) ?? template.parentId
      : template.parentId;

    if (template.type === "task" && normalizedParentId && !agentIdSet.has(normalizedParentId)) {
      throw new Error(`Task ${template.name} references missing agent ${normalizedParentId}.`);
    }

    return {
      ...template,
      id: normalizedId,
      parentId: normalizedParentId ?? null,
      createdAt: template.createdAt ?? new Date().toISOString(),
      updatedAt: template.updatedAt ?? new Date().toISOString(),
    };
  });
}
