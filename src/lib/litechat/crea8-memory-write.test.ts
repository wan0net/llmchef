import { describe, expect, it, vi } from "vitest";
import { applyMemoryProposalToConnector } from "./crea8-memory-write";
import type {
  Crea8MemoryConnector,
  Crea8MemoryProposal,
} from "@/types/litechat/crea8-memory";

const makeProposal = (
  overrides: Partial<Crea8MemoryProposal> = {}
): Crea8MemoryProposal => ({
  id: "proposal-1",
  status: "pending",
  scope: "project",
  title: "Deployment Notes",
  reason: "The assistant learned deployment details.",
  proposedContent: "LiteChat deploys through Cloudflare Pages.",
  confidence: 0.8,
  source: {
    conversationId: "conversation-1",
    interactionId: "interaction-1",
    projectId: "project-alpha",
  },
  createdAt: new Date("2026-04-30T00:00:00.000Z"),
  updatedAt: new Date("2026-04-30T00:01:00.000Z"),
  resolvedAt: null,
  ...overrides,
});

const makeConnector = (): Crea8MemoryConnector => ({
  id: "connector-1",
  name: "Test connector",
  backend: "markdown-workspace",
  search: vi.fn(),
  read: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
});

describe("applyMemoryProposalToConnector", () => {
  it("creates a note for proposals without a target note", async () => {
    const now = new Date("2026-04-30T01:00:00.000Z");
    const proposal = makeProposal();
    const connector = makeConnector();
    const ref = {
      backend: "markdown-workspace" as const,
      id: "note-1",
      title: "Deployment Notes",
      path: "/Memory/Projects/deployment-notes.md",
    };
    vi.mocked(connector.create).mockResolvedValueOnce(ref);

    const updated = await applyMemoryProposalToConnector({
      proposal,
      connector,
      finalContent: "  Final deployment note.  ",
      now,
    });

    expect(connector.create).toHaveBeenCalledWith({
      title: "Deployment Notes",
      content: "Final deployment note.",
      scope: "project",
      tags: [],
      projectId: "project-alpha",
      skillId: null,
    });
    expect(connector.update).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      id: proposal.id,
      status: "accepted",
      finalContent: "Final deployment note.",
      targetNote: ref,
      resolvedAt: now,
      updatedAt: now,
      source: proposal.source,
      reason: proposal.reason,
      confidence: proposal.confidence,
    });
    expect(updated.createdAt).toBe(proposal.createdAt);
  });

  it("updates the target note with the proposal patch", async () => {
    const now = new Date("2026-04-30T02:00:00.000Z");
    const targetNote = {
      backend: "markdown-workspace" as const,
      id: "note-1",
      title: "Old Deployment Notes",
      path: "/Memory/Projects/old-deployment-notes.md",
    };
    const proposal = makeProposal({
      targetNote,
      finalContent: "  Existing final content.  ",
      source: {
        conversationId: "conversation-1",
        interactionId: "interaction-1",
        skillId: "skill-alpha",
      },
    });
    const connector = makeConnector();
    const updatedRef = {
      ...targetNote,
      title: "Deployment Notes",
    };
    vi.mocked(connector.update).mockResolvedValueOnce(updatedRef);

    const updated = await applyMemoryProposalToConnector({
      proposal,
      connector,
      now,
    });

    expect(connector.update).toHaveBeenCalledWith(targetNote, {
      title: "Deployment Notes",
      content: "Existing final content.",
      scope: "project",
      projectId: null,
      skillId: "skill-alpha",
    });
    expect(connector.create).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      status: "accepted",
      finalContent: "Existing final content.",
      targetNote: updatedRef,
      resolvedAt: now,
      updatedAt: now,
    });
  });

  it("throws when resolved content is empty", async () => {
    const proposal = makeProposal({
      proposedContent: "   ",
      finalContent: "   ",
    });
    const connector = makeConnector();

    await expect(
      applyMemoryProposalToConnector({
        proposal,
        connector,
        finalContent: "   ",
      })
    ).rejects.toThrow("Memory proposal content cannot be empty.");

    expect(connector.create).not.toHaveBeenCalled();
    expect(connector.update).not.toHaveBeenCalled();
  });
});
