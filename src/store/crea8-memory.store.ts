import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { PersistenceService } from "@/services/persistence.service";
import { createMemoryProposal } from "@/lib/llmchef/crea8-memory";
import { applyMemoryProposalToConnector } from "@/lib/llmchef/crea8-memory-write";
import type {
  Crea8MemoryConnector,
  Crea8MemoryProposal,
  Crea8MemoryProposalStatus,
  Crea8MemoryScope,
  Crea8MemorySourceRef,
} from "@/types/llmchef/crea8-memory";

interface Crea8MemoryState {
  proposals: Crea8MemoryProposal[];
  loading: boolean;
  error: string | null;
}

interface Crea8MemoryActions {
  loadProposals: () => Promise<void>;
  proposeMemoryUpdate: (input: {
    scope: Crea8MemoryScope;
    title: string;
    reason: string;
    proposedContent: string;
    source: Crea8MemorySourceRef;
    confidence?: number;
  }) => Promise<string>;
  updateProposal: (
    id: string,
    updates: Partial<Omit<Crea8MemoryProposal, "id" | "createdAt">>
  ) => Promise<void>;
  resolveProposal: (
    id: string,
    status: Extract<Crea8MemoryProposalStatus, "accepted" | "rejected">,
    finalContent?: string
  ) => Promise<void>;
  acceptProposalWithConnector: (
    id: string,
    connector: Crea8MemoryConnector,
    finalContent?: string
  ) => Promise<void>;
  deleteProposal: (id: string) => Promise<void>;
}

export const useCrea8MemoryStore = create(
  immer<Crea8MemoryState & Crea8MemoryActions>((set, get) => ({
    proposals: [],
    loading: false,
    error: null,

    loadProposals: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const proposals = await PersistenceService.loadCrea8MemoryProposals();
        set((state) => {
          state.proposals = proposals;
          state.loading = false;
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load memory proposals";
        set((state) => {
          state.loading = false;
          state.error = message;
        });
        toast.error(message);
      }
    },

    proposeMemoryUpdate: async (input) => {
      const proposal: Crea8MemoryProposal = {
        id: nanoid(),
        ...createMemoryProposal(input),
      };

      set((state) => {
        state.proposals.unshift(proposal);
      });

      try {
        await PersistenceService.saveCrea8MemoryProposal(proposal);
        toast.success("Memory proposal saved.");
        return proposal.id;
      } catch (error) {
        await get().loadProposals();
        throw error;
      }
    },

    updateProposal: async (id, updates) => {
      const existing = get().proposals.find((proposal) => proposal.id === id);
      if (!existing) throw new Error("Memory proposal not found.");

      const updated: Crea8MemoryProposal = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      set((state) => {
        const index = state.proposals.findIndex((proposal) => proposal.id === id);
        if (index !== -1) state.proposals[index] = updated;
      });

      try {
        await PersistenceService.saveCrea8MemoryProposal(updated);
      } catch (error) {
        await get().loadProposals();
        throw error;
      }
    },

    resolveProposal: async (id, status, finalContent) => {
      await get().updateProposal(id, {
        status,
        finalContent,
        resolvedAt: new Date(),
      });
    },

    acceptProposalWithConnector: async (id, connector, finalContent) => {
      const existing = get().proposals.find((proposal) => proposal.id === id);
      if (!existing) throw new Error("Memory proposal not found.");

      try {
        const updated = await applyMemoryProposalToConnector({
          proposal: existing,
          connector,
          finalContent,
        });

        set((state) => {
          const index = state.proposals.findIndex((proposal) => proposal.id === id);
          if (index !== -1) state.proposals[index] = updated;
        });

        await PersistenceService.saveCrea8MemoryProposal(updated);
        toast.success("Memory proposal written to crea8.");
      } catch (error) {
        await get().loadProposals();
        throw error;
      }
    },

    deleteProposal: async (id) => {
      set((state) => {
        state.proposals = state.proposals.filter((proposal) => proposal.id !== id);
      });

      try {
        await PersistenceService.deleteCrea8MemoryProposal(id);
      } catch (error) {
        await get().loadProposals();
        throw error;
      }
    },
  }))
);
