import { nanoid } from "nanoid";
import { emitter } from "@/lib/llmchef/event-emitter";
import { APP_VFS_KEY } from "@/lib/llmchef/constants";
import { createMemoryProposal } from "@/lib/llmchef/crea8-memory";
import { createCrea8VfsConnector } from "@/lib/llmchef/crea8-vfs-connector";
import { dirname, joinPath } from "@/lib/llmchef/file-manager-utils";
import {
  initializeFsOp,
  readFileOp,
  writeFileOp,
} from "@/lib/llmchef/vfs-operations";
import { useCrea8MemoryStore } from "@/store/crea8-memory.store";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useVfsStore } from "@/store/vfs.store";
import { PersistenceService } from "@/services/persistence.service";
import { interactionEvent } from "@/types/llmchef/events/interaction.events";
import type { Interaction } from "@/types/llmchef/interaction";
import type {
  Crea8MemoryProposal,
  Crea8MemoryScope,
} from "@/types/llmchef/crea8-memory";

const AUTO_MEMORY_TYPES = new Set<Interaction["type"]>([
  "message.user_assistant",
  "message.assistant_regen",
]);
const MIN_RESPONSE_LENGTH = 180;
const MAX_CONTENT_LENGTH = 6000;
const MAX_TITLE_LENGTH = 80;
const GLOBAL_DOCUMENTS_ROOT = "/Documents";
const SECOND_BRAIN_SECTIONS = [
  "Findings",
  "Decisions",
  "Concepts",
  "Entities",
  "Sources",
  "Lessons",
  "Questions",
  "Contradictions",
];
const TOPIC_RULES: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "Security", pattern: /\b(security|secret|token|leak|sandbox|permission|auth|credential|policy)\b/ },
  { topic: "Architecture", pattern: /\b(architecture|module|store|service|runtime|design|interface|abstraction)\b/ },
  { topic: "Projects", pattern: /\b(project|workspace|folder|wiki|document|knowledge|memory|second brain)\b/ },
  { topic: "Sync", pattern: /\b(sync|git|github|s3|dropbox|onedrive|filesystem|export|import)\b/ },
  { topic: "MCP", pattern: /\b(mcp|tool|server|client|transport|package|registry)\b/ },
  { topic: "UI", pattern: /\b(ui|theme|button|toolbar|sidebar|layout|screen|ux|interface)\b/ },
  { topic: "Testing", pattern: /\b(test|e2e|lint|build|ci|quality|semgrep|trivy|playwright)\b/ },
  { topic: "Operations", pattern: /\b(deploy|release|gh-pages|performance|optimization|cache|bundle)\b/ },
  { topic: "Product", pattern: /\b(feature|workflow|user|experience|notebook|chat|recipe)\b/ },
];

const isMemoryWorthProposing = (response: string): boolean => {
  const trimmed = response.trim();
  if (trimmed.length < MIN_RESPONSE_LENGTH) return false;
  if (/^(error|failed|cancelled)\b/i.test(trimmed)) return false;
  return /[.!?]\s/.test(trimmed) || trimmed.includes("\n");
};

const titleFromInteraction = (interaction: Interaction, response: string): string => {
  const promptTitle = interaction.prompt?.content
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const responseTitle = response
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^#{1,6}\s+/, ""))
    .find(Boolean);
  const rawTitle = promptTitle || responseTitle || "Assistant memory note";
  return rawTitle.length <= MAX_TITLE_LENGTH
    ? rawTitle
    : `${rawTitle.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
};

const scopeFromInteraction = (interaction: Interaction): Crea8MemoryScope =>
  interaction.prompt?.metadata?.activeRuleIds?.length ? "reference" : "project";

const projectForInteraction = (interaction: Interaction) => {
  const conversation = useConversationStore
    .getState()
    .getConversationById(interaction.conversationId);
  const project = useProjectStore
    .getState()
    .getProjectById(conversation?.projectId ?? null);
  return { conversation, project };
};

const slugSegment = (value: string): string =>
  value
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.join("-")
    .slice(0, 80) || "memory";

const taxonomyRootForInteraction = (interaction: Interaction): string => {
  const { project } = projectForInteraction(interaction);
  return joinPath(project?.path ?? GLOBAL_DOCUMENTS_ROOT, "Wiki", "Second Brain");
};

const classifyTaxonomySection = (
  interaction: Interaction,
  response: string,
  scope: Crea8MemoryScope,
): string => {
  const text = `${interaction.prompt?.content ?? ""}\n${response}`.toLowerCase();
  if (/\b(contradiction|conflict|inconsistent|disagree|mismatch)\b/.test(text)) {
    return "Contradictions";
  }
  if (/\b(decision|decided|we will|we chose|trade[- ]?off|rationale)\b/.test(text)) {
    return "Decisions";
  }
  if (/\b(error|failed|failure|bug|fix|root cause|regression|lesson)\b/.test(text)) {
    return "Lessons";
  }
  if (/\b(open question|unknown|unclear|to verify|needs research)\b/.test(text)) {
    return "Questions";
  }
  if (scope === "reference") return "Sources";
  if (/\b(concept|pattern|principle|method|model|taxonomy)\b/.test(text)) {
    return "Concepts";
  }
  return "Findings";
};

const classifyTopic = (interaction: Interaction, response: string): string => {
  const text = `${interaction.prompt?.content ?? ""}\n${response}`.toLowerCase();
  return TOPIC_RULES.find((rule) => rule.pattern.test(text))?.topic ?? "General";
};

const taxonomyPathForMemory = (
  interaction: Interaction,
  scope: Crea8MemoryScope,
  title: string,
  section: string,
  topic: string,
): string => {
  const date = new Date().toISOString().slice(0, 10);
  return joinPath(
    taxonomyRootForInteraction(interaction),
    section,
    topic,
    `${date}-${slugSegment(title)}-${interaction.id.slice(0, 8)}.md`,
  );
};

const buildMemoryContent = (
  interaction: Interaction,
  response: string,
  section: string,
  topic: string,
): string => {
  const { conversation, project } = projectForInteraction(interaction);
  const sourcePrompt = interaction.prompt?.content?.trim();
  const sourceLines = [
    `- Taxonomy: ${section}`,
    `- Topic: ${topic}`,
    `- Conversation: ${conversation?.title ?? interaction.conversationId}`,
    project ? `- Project: ${project.name}` : null,
    `- Interaction: ${interaction.id}`,
    `- Created: ${new Date().toISOString()}`,
  ].filter((line): line is string => Boolean(line));

  return [
    `## Summary`,
    response.slice(0, MAX_CONTENT_LENGTH).trim(),
    "",
    "## Curation",
    `- Placed under: [[${section}/${topic}]]`,
    "- Method: keep this note atomic, link it to related pages, and merge it upward when it becomes durable project knowledge.",
    "",
    "## Provenance",
    ...sourceLines,
    sourcePrompt ? "" : null,
    sourcePrompt ? "## Source Prompt" : null,
    sourcePrompt ? sourcePrompt.slice(0, 1200) : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
};

const writeIfMissing = async (
  path: string,
  content: string,
  fsInstance: NonNullable<Awaited<ReturnType<typeof initializeFsOp>>>,
): Promise<void> => {
  try {
    await readFileOp(path, { fsInstance, silent: true });
  } catch (error) {
    if (error instanceof Error && (error as any).code !== "ENOENT") throw error;
    await writeFileOp(path, content, { fsInstance });
  }
};

export class Crea8MemoryAutomationService {
  private static isInitialized = false;

  static initialize(): void {
    if (this.isInitialized) return;
    emitter.on(interactionEvent.completed, ({ interaction, status }) => {
      if (status !== "COMPLETED" || !interaction) return;
      void this.proposeFromInteraction(interaction);
    });
    this.isInitialized = true;
  }

  private static async proposeFromInteraction(interaction: Interaction): Promise<void> {
    if (!AUTO_MEMORY_TYPES.has(interaction.type)) return;
    if (interaction.parentId !== null) return;
    if (typeof interaction.response !== "string") return;

    const response = interaction.response.trim();
    if (!isMemoryWorthProposing(response)) return;

    try {
      const existing = await PersistenceService.loadCrea8MemoryProposals();
      if (
        existing.some(
          (proposal) => proposal.source.interactionId === interaction.id
        )
      ) {
        return;
      }

      await this.writeMemoryFromInteraction(interaction, response);
    } catch (error) {
      console.warn("[Crea8MemoryAutomationService] Auto memory write skipped.", error);
    }
  }

  private static async writeMemoryFromInteraction(
    interaction: Interaction,
    response: string,
  ): Promise<void> {
    const fs =
      useVfsStore.getState().fs ??
      (await initializeFsOp(APP_VFS_KEY));
    if (!fs) throw new Error("App VFS is not available.");

    const { conversation, project } = projectForInteraction(interaction);
    const scope = scopeFromInteraction(interaction);
    const title = titleFromInteraction(interaction, response);
    const section = classifyTaxonomySection(interaction, response, scope);
    const topic = classifyTopic(interaction, response);
    const rootPath = taxonomyRootForInteraction(interaction);
    const proposedContent = buildMemoryContent(interaction, response, section, topic);

    await this.ensureSecondBrainScaffold(rootPath, project?.name ?? "LLMChef");

    const proposal: Crea8MemoryProposal = {
      id: nanoid(),
      ...createMemoryProposal({
        scope,
        title,
        reason: "Automatically written from assistant response.",
        proposedContent,
        source: {
          conversationId: interaction.conversationId,
          interactionId: interaction.id,
          projectId: conversation?.projectId ?? undefined,
        },
        confidence: 0.72,
      }),
    };

    const connector = createCrea8VfsConnector({
      rootPath,
      fsInstance: fs,
    });
    const targetNote = await connector.create({
      title: proposal.title,
      content: proposal.proposedContent,
      scope: proposal.scope,
      tags: ["auto-memory", "second-brain", section.toLowerCase()],
      path: taxonomyPathForMemory(interaction, scope, title, section, topic),
      projectId: proposal.source.projectId ?? null,
      skillId: proposal.source.skillId ?? null,
    });
    const now = new Date();
    const written: Crea8MemoryProposal = {
      ...proposal,
      status: "accepted",
      finalContent: proposal.proposedContent,
      targetNote,
      resolvedAt: now,
      updatedAt: now,
    };

    await PersistenceService.saveCrea8MemoryProposal(written);
    useCrea8MemoryStore.setState((state) => ({
      proposals: [written, ...state.proposals],
    }));
  }

  private static async ensureSecondBrainScaffold(
    rootPath: string,
    projectName: string,
  ): Promise<void> {
    const fs =
      useVfsStore.getState().fs ??
      (await initializeFsOp(APP_VFS_KEY));
    if (!fs) throw new Error("App VFS is not available.");

    const wikiRoot = dirname(rootPath);
    const workspaceRoot = dirname(wikiRoot);

    await writeIfMissing(
      joinPath(workspaceRoot, "Home.md"),
      [
        `# ${projectName}`,
        "",
        "This is the human-facing home for the project knowledge base.",
        "",
        "## Start Here",
        "",
        "- [[Wiki/Second Brain/_index]]",
        "- [[Wiki/Second Brain/overview]]",
        "- [[Wiki]]",
        "",
        "## Working Notes",
        "",
        "- LLMChef automatically writes durable findings into the Second Brain.",
        "- Edit, merge, or move those Markdown notes as the project evolves.",
        "",
      ].join("\n"),
      fs,
    );

    await writeIfMissing(
      joinPath(rootPath, "_index.md"),
      [
        `# ${projectName} Second Brain`,
        "",
        "This folder is maintained by LLMChef and remains human-editable.",
        "Automatic memories are Markdown notes that should be reviewed, merged, and curated like any other wiki page.",
        "LLMChef files notes into a section and topic automatically; move them only when the human-facing map becomes clearer.",
        "",
        ...SECOND_BRAIN_SECTIONS.map((section) => `- [[${section}]]`),
        "- [[method]]",
        "",
      ].join("\n"),
      fs,
    );

    await writeIfMissing(
      joinPath(rootPath, "overview.md"),
      [
        `# ${projectName} Overview`,
        "",
        "Use this page as the human-facing map for the project knowledge base.",
        "",
        "## Current Shape",
        "",
        "- Findings capture notable discoveries.",
        "- Decisions capture choices and rationale.",
        "- Sources preserve provenance.",
        "- Questions and Contradictions keep uncertainty visible.",
        "",
      ].join("\n"),
      fs,
    );

    await writeIfMissing(
      joinPath(rootPath, "method.md"),
      [
        `# ${projectName} Second Brain Method`,
        "",
        "LLMChef treats this wiki as a human-readable second brain that AI can maintain.",
        "",
        "## Defaults",
        "",
        "- New durable findings are filed automatically by section and topic.",
        "- Notes should stay atomic enough to reuse in chat and broad enough to remain readable.",
        "- Project home pages are maps of content, not dumping grounds.",
        "",
        "## Curation Pattern",
        "",
        "- Capture: write the smallest useful Markdown note.",
        "- Connect: add wiki links to related pages, folders, source docs, and decisions.",
        "- Consolidate: merge repeated notes into overview or decision pages when a pattern stabilizes.",
        "",
      ].join("\n"),
      fs,
    );

    await Promise.all(
      SECOND_BRAIN_SECTIONS.map((section) =>
        writeIfMissing(
          joinPath(rootPath, section, "_index.md"),
          [
            `# ${section}`,
            "",
            `Automatically curated ${section.toLowerCase()} live here by topic.`,
            "",
            ...TOPIC_RULES.map((rule) => `- [[${rule.topic}]]`),
            "- [[General]]",
            "",
          ].join("\n"),
          fs,
        ),
      ),
    );
  }
}
