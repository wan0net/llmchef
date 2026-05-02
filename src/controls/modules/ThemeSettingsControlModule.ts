// src/controls/modules/ThemeSettingsControlModule.ts
// NEW FILE
import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import { createLazySettingTab } from "@/controls/components/settings/LazySettingTab";
import i18next from 'i18next';
import type { ControlModuleConstructor } from '@/types/llmchef/control';

const SettingsTheme = createLazySettingTab(() =>
  import("@/controls/components/theme-settings/SettingsTheme").then((module) => ({
    default: module.SettingsTheme,
  }))
);

export class ThemeSettingsControlModule implements ControlModule {
  readonly id = "core-settings-theme";
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
      id: "theme",
      title: i18next.t("controls:settings.tabs.theme"),
      component: SettingsTheme,
      order: 20,
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

(ThemeSettingsControlModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.theme": "Theme"
    }
  },
  fr: {
    controls: {
      "settings.tabs.theme": "Thème"
    }
  }
};
