// src/controls/modules/GeneralSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import { createLazySettingTab } from "@/controls/components/settings/LazySettingTab";
import i18next from 'i18next';
import type { ControlModuleConstructor } from '@/types/llmchef/control';

const SettingsGeneral = createLazySettingTab(() =>
  import("@/controls/components/general-settings/SettingsGeneral")
);

export class GeneralSettingsModule implements ControlModule {
  readonly id = "core-settings-general";
  private unregisterCallback: (() => void) | null = null;

  async initialize(): Promise<void> {
    // console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LLMChefModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerSettingsTab({
      id: "general",
      title: i18next.t("controls:settings.tabs.general"),
      component: SettingsGeneral,
      order: 10,
    });
    // console.log(`[${this.id}] Settings tab registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}

(GeneralSettingsModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.general": "General"
    }
  },
  fr: {
    controls: {
      "settings.tabs.general": "Général"
    }
  }
};
