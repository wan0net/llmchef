import React from "react";
import { createLazyControlComponent } from "@/controls/components/LazyControlComponent";
import {
  buildSkillPromptContext,
  skillPromptRefs,
} from "@/lib/llmchef/skill-prompt-context";
import { useSkillStore } from "@/store/skill.store";
import type { ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { Skill } from "@/types/llmchef/skill";

const SkillsPromptControl = createLazyControlComponent<any>(
  () =>
    import("@/controls/components/skills/SkillsPromptControl").then((module) => ({
      default: module.SkillsPromptControl,
    })),
  "Loading skills...",
);

export class SkillsPromptControlModule implements ControlModule {
  readonly id = "core-skills-prompt";
  private unregisterCallback: (() => void) | null = null;
  private selectedSkillIds: string[] = [];
  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(): Promise<void> {}

  public loadSkills = async (): Promise<void> => {
    await useSkillStore.getState().loadSkills();
    this.notifyComponentUpdate?.();
  };

  public getInstalledSkills = (): Skill[] =>
    useSkillStore
      .getState()
      .skills.filter((skill) => skill.installState === "installed")
      .sort((a, b) => a.name.localeCompare(b.name));

  public getSelectedSkillIds = (): string[] => this.selectedSkillIds;

  public toggleSkill = (id: string): void => {
    this.selectedSkillIds = this.selectedSkillIds.includes(id)
      ? this.selectedSkillIds.filter((skillId) => skillId !== id)
      : [...this.selectedSkillIds, id];
    this.notifyComponentUpdate?.();
  };

  public clearSelectedSkills = (): void => {
    if (this.selectedSkillIds.length === 0) return;
    this.selectedSkillIds = [];
    this.notifyComponentUpdate?.();
  };

  public setNotifyCallback = (cb: (() => void) | null): void => {
    this.notifyComponentUpdate = cb;
  };

  public getStatus = (): "ready" | "loading" | "error" => {
    const skillState = useSkillStore.getState();
    if (skillState.loading) return "loading";
    if (skillState.error) return "error";
    return "ready";
  };

  register(modApi: LLMChefModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      status: this.getStatus,
      triggerRenderer: () =>
        React.createElement(SkillsPromptControl, { module: this }),
      getMetadata: () => {
        const selectedSkills = this.getInstalledSkills().filter((skill) =>
          this.selectedSkillIds.includes(skill.id)
        );
        const skillPromptContext = buildSkillPromptContext(selectedSkills);
        if (!skillPromptContext) return undefined;
        return {
          skillRefs: skillPromptRefs(selectedSkills),
          skillPromptContext,
        };
      },
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.notifyComponentUpdate = null;
  }
}
