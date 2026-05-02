import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { PersistenceService } from "@/services/persistence.service";
import type { Skill, SkillInstallState } from "@/types/llmchef/skill";
import {
  parseSkillPackage,
  serializeSkillPackage,
  validateSkillManifest,
} from "@/lib/llmchef/skill-package";

interface SkillState {
  skills: Skill[];
  loading: boolean;
  error: string | null;
}

interface SkillActions {
  loadSkills: () => Promise<void>;
  createSkill: (
    manifest: unknown,
    files?: { path: string; content: string }[]
  ) => Promise<string>;
  importSkillPackage: (
    files: { path: string; content: string }[],
    source?: Skill["source"]
  ) => Promise<string>;
  updateSkill: (
    id: string,
    updates: Partial<Omit<Skill, "id" | "createdAt" | "updatedAt">>
  ) => Promise<void>;
  setSkillInstallState: (id: string, installState: SkillInstallState) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  exportSkillPackage: (id: string) => { path: string; content: string }[];
  getSkillBySlug: (slug: string) => Skill | undefined;
}

export const useSkillStore = create(
  immer<SkillState & SkillActions>((set, get) => ({
    skills: [],
    loading: false,
    error: null,

    loadSkills: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const skills = await PersistenceService.loadSkills();
        set((state) => {
          state.skills = skills;
          state.loading = false;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load skills";
        set((state) => {
          state.loading = false;
          state.error = message;
        });
        toast.error(message);
      }
    },

    createSkill: async (manifestInput, files = []) => {
      const manifest = validateSkillManifest(manifestInput);
      return get().importSkillPackage(
        [
          {
            path: "skill.json",
            content: `${JSON.stringify(manifest, null, 2)}\n`,
          },
          ...files.filter((file) => file.path !== "skill.json"),
        ],
        { type: "local" }
      );
    },

    importSkillPackage: async (files, source = { type: "local" }) => {
      const parsed = parseSkillPackage(files, source);
      const now = new Date();
      const existing = get().skills.find((skill) => skill.slug === parsed.slug);
      const skill: Skill = {
        id: existing?.id ?? nanoid(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...parsed,
      };

      set((state) => {
        const index = state.skills.findIndex((item) => item.id === skill.id);
        if (index === -1) {
          state.skills.push(skill);
        } else {
          state.skills[index] = skill;
        }
      });

      try {
        await PersistenceService.saveSkill(skill);
        toast.success(`Skill "${skill.name}" saved.`);
        return skill.id;
      } catch (error) {
        await get().loadSkills();
        const message = error instanceof Error ? error.message : "Failed to save skill";
        toast.error(message);
        throw error;
      }
    },

    updateSkill: async (id, updates) => {
      const existing = get().skills.find((skill) => skill.id === id);
      if (!existing) throw new Error("Skill not found.");

      const updated: Skill = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      set((state) => {
        const index = state.skills.findIndex((skill) => skill.id === id);
        if (index !== -1) state.skills[index] = updated;
      });

      try {
        await PersistenceService.saveSkill(updated);
      } catch (error) {
        await get().loadSkills();
        throw error;
      }
    },

    setSkillInstallState: async (id, installState) => {
      await get().updateSkill(id, {
        installState,
        installedAt: installState === "installed" ? new Date() : null,
      });
    },

    deleteSkill: async (id) => {
      const existing = get().skills.find((skill) => skill.id === id);
      set((state) => {
        state.skills = state.skills.filter((skill) => skill.id !== id);
      });

      try {
        await PersistenceService.deleteSkill(id);
        if (existing) toast.success(`Skill "${existing.name}" deleted.`);
      } catch (error) {
        await get().loadSkills();
        throw error;
      }
    },

    exportSkillPackage: (id) => {
      const skill = get().skills.find((item) => item.id === id);
      if (!skill) throw new Error("Skill not found.");
      return serializeSkillPackage(skill);
    },

    getSkillBySlug: (slug) => {
      return get().skills.find((skill) => skill.slug === slug);
    },
  }))
);
